import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createLcuClient,
  discoverLcuFromLogs,
  extractLcuCredentialsFromLog,
  findLockfile,
  LcuHttpError,
  parseLockfile,
  parseUxCommandLine,
  probeLcuCredentials,
} from '../packages/lcu-client/src/index.ts';
import { sleep, waitFor } from './helpers.ts';
import { MockLcuServer, MOCK_PASSWORD } from './mock-lcu/mock-server.ts';

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    throw error;
  }
}

await check('parseLockfile 正常解析', () => {
  const data = parseLockfile('LeagueClient:12345:54321:abcdef1234567890:https');
  assert.equal(data.name, 'LeagueClient');
  assert.equal(data.pid, 12345);
  assert.equal(data.port, 54321);
  assert.equal(data.password, 'abcdef1234567890');
  assert.equal(data.protocol, 'https');
});

await check('parseLockfile 格式错误抛错', () => {
  assert.throws(() => parseLockfile('LeagueClient:123:54321'));
});

await check('findLockfile 在指定目录找到并解析', () => {
  const dir = join(import.meta.dirname, '..', '.tmp-test', 'install-a');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'lockfile'), 'LeagueClient:999:4567:pw123:https');
  try {
    const found = findLockfile({ installDirs: [dir] });
    assert.ok(found);
    assert.equal(found.data.port, 4567);
    assert.equal(found.data.password, 'pw123');
  } finally {
    rmSync(join(import.meta.dirname, '..', '.tmp-test'), { recursive: true, force: true });
  }
});

await check('findLockfile 目录不存在时返回 null', () => {
  const found = findLockfile({ installDirs: ['Z:/绝对不存在的目录/abc'] });
  assert.equal(found, null);
});

await check('findLockfile 跳过启动器（Riot Client）的 lockfile', () => {
  const dir = join(import.meta.dirname, '..', '.tmp-test', 'install-b');
  mkdirSync(dir, { recursive: true });
  // 国服 WeGame 场景：目录里只有启动器的 lockfile
  writeFileSync(join(dir, 'lockfile'), 'Riot Client:23608:7995:some-password:https');
  try {
    assert.equal(findLockfile({ installDirs: [dir] }), null);
  } finally {
    rmSync(join(import.meta.dirname, '..', '.tmp-test'), { recursive: true, force: true });
  }
});

await check('parseUxCommandLine 解析国服启动参数', () => {
  const sample =
    '"D:\\Software\\WeGameApps\\英雄联盟\\LeagueClient\\LeagueClientUx.exe" --riotclient-auth-token=xyz --riotclient-app-port=57123 --app-port=14203 --remoting-auth-token=abcDEF-1234 --app-name=LeagueClientUx --no-rads';
  const parsed = parseUxCommandLine(sample);
  assert.ok(parsed);
  assert.equal(parsed.port, 14203);
  assert.equal(parsed.token, 'abcDEF-1234');
  assert.equal(parseUxCommandLine('没有参数的普通字符串'), null);
});

await check('REST 请求与 Basic Auth 认证', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  try {
    server.setState({ phase: 'Lobby' });
    const client = createLcuClient({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' });
    const dto = await client.request<{ phase: string }>('GET', '/lol-gameflow/v1/gameflow-phase');
    assert.equal(dto.phase, 'Lobby');
    client.close();
  } finally {
    await server.stop();
  }
});

await check('REST 密码错误返回 401', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  try {
    const client = createLcuClient({ host: '127.0.0.1', port, password: 'wrong-password', protocol: 'http' });
    await assert.rejects(
      () => client.request('GET', '/lol-gameflow/v1/gameflow-phase'),
      (error: unknown) => error instanceof LcuHttpError && error.status === 401,
    );
    client.close();
  } finally {
    await server.stop();
  }
});

await check('REST 资源不存在返回 404', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  try {
    const client = createLcuClient({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' });
    await assert.rejects(
      () => client.request('GET', '/lol-lobby/v2/lobby'),
      (error: unknown) => error instanceof LcuHttpError && error.status === 404,
    );
    client.close();
  } finally {
    await server.stop();
  }
});

await check('WAMP 订阅收到 OnJsonApiEvent', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  try {
    const client = createLcuClient({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' });
    const events: { uri: string; data: unknown }[] = [];
    client.subscribe('/lol-gameflow/v1/gameflow-phase', (event) => {
      events.push({ uri: event.uri, data: event.data });
    });
    await waitFor(() => server.hasSubscribers('/lol-gameflow/v1/gameflow-phase'), '订阅送达 mock 服务器');
    server.emit('/lol-gameflow/v1/gameflow-phase', { phase: 'ChampSelect' });
    await waitFor(() => events.length === 1, '客户端收到事件');
    assert.equal(events[0].uri, '/lol-gameflow/v1/gameflow-phase');
    assert.deepEqual(events[0].data, { phase: 'ChampSelect' });
    client.close();
    await sleep(30);
  } finally {
    await server.stop();
  }
});

await check('extractLcuCredentialsFromLog 解析并取最后会话', () => {
  const text = [
    '000000.000|   OKAY| Command line arguments: --riotclient-auth-token=AAAA --riotclient-app-port=7995 --region=TENCENT',
    '000000.003| ALWAYS| Cef CommandLine: --app-name=LeagueClient --app-port=9585 --remoting-auth-token=X3-lVP8bmxFoQEMhXMO8OA --install-directory=...',
  ].join('\n');
  const parsed = extractLcuCredentialsFromLog(text);
  assert.ok(parsed);
  assert.equal(parsed.port, 9585);
  assert.equal(parsed.token, 'X3-lVP8bmxFoQEMhXMO8OA');
  assert.equal(extractLcuCredentialsFromLog('没有参数的日志'), null);
});

await check('discoverLcuFromLogs 从日志目录发现凭据（两种目录粒度）', () => {
  const rootDir = join(import.meta.dirname, '..', '.tmp-test', 'game-root');
  const logDir = join(rootDir, 'LeagueClient');
  mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, '2026-08-14T17-10-40_999_100_LeagueClientUx.log'), '--app-port=9585 --remoting-auth-token=TKN123');
  try {
    const fromRoot = discoverLcuFromLogs([rootDir]);
    assert.ok(fromRoot);
    assert.equal(fromRoot.port, 9585);
    assert.equal(fromRoot.password, 'TKN123');
    const fromLcDir = discoverLcuFromLogs([logDir]);
    assert.ok(fromLcDir);
    assert.equal(discoverLcuFromLogs(['Z:/不存在']), null);
  } finally {
    rmSync(join(import.meta.dirname, '..', '.tmp-test'), { recursive: true, force: true });
  }
});

await check('probeLcuCredentials 验证凭据可用性', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  try {
    assert.equal(await probeLcuCredentials({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' }), true);
    assert.equal(await probeLcuCredentials({ host: '127.0.0.1', port, password: 'wrong-password', protocol: 'http' }), false);
    assert.equal(await probeLcuCredentials({ host: '127.0.0.1', port: port + 1, password: MOCK_PASSWORD, protocol: 'http' }), false);
  } finally {
    await server.stop();
  }
});

console.log('lcu-client 全部通过：' + passed + ' 项 ✅');
