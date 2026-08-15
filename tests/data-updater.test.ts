import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  atomicWriteFile,
  checkAndUpdateData,
  compareDataVersions,
  parseManifest,
  readLocalManifest,
  sha256Hex,
  type DataUpdaterDeps,
} from '../apps/desktop/src/main/data-updater.ts';

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

/** 构造一个合法的数据包 JSON（满足 zod schema 的最小形态） */
function makeBundleJson(dataVersion: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    dataVersion,
    gamePatch: '26.16',
    mode: 'hextech-aram',
    champions: [
      {
        championId: 'Ahri',
        nameZh: '阿狸',
        builds: [
          { name: 'AP消耗流', hextech: ['能量汲取'], items: ['卢登的伙伴'], tips: ['前期用Q消耗'], updatedPatch: '26.16' },
        ],
      },
    ],
  });
}

function makeManifestJson(dataVersion: string, bundleJson: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    dataVersion,
    gamePatch: '26.16',
    mode: 'hextech-aram',
    file: 'data-' + dataVersion + '.json',
    sha256: sha256Hex(bundleJson),
    builtAt: '2026-08-15T09:07:26.500Z',
  });
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'chx-data-'));
}

function fakeDeps(manifestJson: string, bundleJson: string): DataUpdaterDeps {
  return {
    fetchText: async () => manifestJson,
    fetchBuffer: async () => Buffer.from(bundleJson, 'utf8'),
  };
}

const MANIFEST_URL = 'https://example.com/dist/manifest.json';

// ---- 纯函数 ----

await check('parseManifest 解析合法清单', () => {
  const m = parseManifest(JSON.parse(makeManifestJson('1.0.0', makeBundleJson('1.0.0'))));
  assert.equal(m.dataVersion, '1.0.0');
  assert.equal(m.file, 'data-1.0.0.json');
  assert.ok(m.sha256 && m.sha256.length === 64);
});

await check('parseManifest 拒绝缺 file / dataVersion 的清单', () => {
  assert.throws(() => parseManifest({ dataVersion: '1.0.0' }), /file/);
  assert.throws(() => parseManifest({ file: 'data.json' }), /dataVersion/);
  assert.throws(() => parseManifest('not-an-object'), /非法/);
});

await check('compareDataVersions 版本比较', () => {
  assert.equal(compareDataVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareDataVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareDataVersions('1.1.0', '1.0.9'), 1);
  assert.equal(compareDataVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareDataVersions('1.0.0', '1.0.0.1'), -1);
});

await check('sha256Hex 已知向量', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// ---- 更新流程 ----

await check('checkAndUpdateData：本地已是最新 → up-to-date 不下载', async () => {
  const dir = makeTempDir();
  try {
    const bundle = makeBundleJson('1.0.0');
    atomicWriteFile(join(dir, 'manifest.json'), makeManifestJson('1.0.0', bundle));
    atomicWriteFile(join(dir, 'data-1.0.0.json'), bundle);
    const result = await checkAndUpdateData(fakeDeps(makeManifestJson('1.0.0', bundle), makeBundleJson('2.0.0')), dir, MANIFEST_URL);
    assert.equal(result.status, 'up-to-date');
    assert.ok(!existsSync(join(dir, 'data-2.0.0.json')), '不应下载新数据');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('checkAndUpdateData：远端更新 → 下载并原子写入', async () => {
  const dir = makeTempDir();
  try {
    const oldBundle = makeBundleJson('1.0.0');
    atomicWriteFile(join(dir, 'manifest.json'), makeManifestJson('1.0.0', oldBundle));
    atomicWriteFile(join(dir, 'data-1.0.0.json'), oldBundle);

    const newBundle = makeBundleJson('2.0.0');
    const result = await checkAndUpdateData(fakeDeps(makeManifestJson('2.0.0', newBundle), newBundle), dir, MANIFEST_URL);

    assert.equal(result.status, 'updated');
    assert.equal(result.toVersion, '2.0.0');
    assert.ok(existsSync(join(dir, 'data-2.0.0.json')));
    const writtenManifest = readLocalManifest(dir);
    assert.equal(writtenManifest?.dataVersion, '2.0.0');
    assert.equal(readFileSync(join(dir, 'data-2.0.0.json'), 'utf8'), newBundle);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('checkAndUpdateData：sha256 不匹配 → 抛错且不落盘', async () => {
  const dir = makeTempDir();
  try {
    const newBundle = makeBundleJson('2.0.0');
    const badManifest = JSON.stringify({
      schemaVersion: 1,
      dataVersion: '2.0.0',
      gamePatch: '26.16',
      mode: 'hextech-aram',
      file: 'data-2.0.0.json',
      sha256: '0'.repeat(64),
      builtAt: '2026-08-15T09:07:26.500Z',
    });
    await assert.rejects(
      () => checkAndUpdateData(fakeDeps(badManifest, newBundle), dir, MANIFEST_URL),
      /sha256/,
    );
    assert.ok(!existsSync(join(dir, 'data-2.0.0.json')), '校验失败不应写入数据');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('checkAndUpdateData：数据包不合法 → 抛错且不落盘', async () => {
  const dir = makeTempDir();
  try {
    const badBundle = JSON.stringify({ schemaVersion: 1, dataVersion: '2.0.0' }); // 缺 champions 等
    await assert.rejects(
      () => checkAndUpdateData(fakeDeps(makeManifestJson('2.0.0', badBundle), badBundle), dir, MANIFEST_URL),
    );
    assert.ok(!existsSync(join(dir, 'data-2.0.0.json')), 'schema 校验失败不应写入数据');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('checkAndUpdateData：清单缺少 sha256 → 拒绝安装', async () => {
  const dir = makeTempDir();
  try {
    const newBundle = makeBundleJson('2.0.0');
    const noHash = JSON.stringify({
      schemaVersion: 1,
      dataVersion: '2.0.0',
      gamePatch: '26.16',
      mode: 'hextech-aram',
      file: 'data-2.0.0.json',
      builtAt: '2026-08-15T09:07:26.500Z',
    });
    await assert.rejects(
      () => checkAndUpdateData(fakeDeps(noHash, newBundle), dir, MANIFEST_URL),
      /sha256/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('readLocalManifest：缺失/损坏时返回 null', () => {
  const dir = makeTempDir();
  try {
    assert.equal(readLocalManifest(dir), null);
    atomicWriteFile(join(dir, 'manifest.json'), 'not-json');
    assert.equal(readLocalManifest(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log('data-updater 全部通过：' + passed + ' 项 ✅');
