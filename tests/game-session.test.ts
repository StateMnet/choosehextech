import assert from 'node:assert/strict';
import { createLcuClient } from '../packages/lcu-client/src/index.ts';
import {
  applyChampSelect,
  applyLobby,
  applyPhase,
  applySummoner,
  createInitialState,
  normalizePhase,
  SessionTracker,
  toPhaseDto,
  type ChampSelectSessionDto,
  type SessionState,
} from '../packages/game-session/src/index.ts';
import { waitFor } from './helpers.ts';
import { MockLcuServer, MOCK_PASSWORD } from './mock-lcu/mock-server.ts';
import { HEX_ARAM_QUEUE_ID, makeChampSelectSession, makeLobby } from './mock-lcu/scenario.ts';

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

const inProgressState = (): SessionState => ({ ...createInitialState(), phase: 'InProgress', myChampionId: 15 });

await check('normalizePhase 未知阶段归一为 Unknown', () => {
  assert.equal(normalizePhase('SomethingNew'), 'Unknown');
  assert.equal(normalizePhase('ChampSelect'), 'ChampSelect');
});

await check('toPhaseDto 兼容裸字符串与对象两种形态（国服实测）', () => {
  assert.deepEqual(toPhaseDto('Lobby'), { phase: 'Lobby' });
  assert.deepEqual(toPhaseDto({ phase: 'InProgress' }), { phase: 'InProgress' });
  assert.deepEqual(toPhaseDto({}), { phase: '' });
  assert.deepEqual(toPhaseDto(undefined), { phase: '' });
});

await check('进入新选人阶段清空己方英雄与 bench', () => {
  const next = applyPhase({ ...inProgressState(), benchChampionIds: [1, 2] }, { phase: 'ChampSelect' });
  assert.equal(next.myChampionId, null);
  assert.deepEqual(next.benchChampionIds, []);
});

await check('applyChampSelect 识别本地玩家英雄', () => {
  const state = applyChampSelect(createInitialState(), makeChampSelectSession());
  assert.equal(state.localPlayerCellId, 1);
  assert.equal(state.myChampionId, 15);
  assert.equal(state.benchChampionIds.length, 4);
});

await check('重roll 后英雄 ID 更新', () => {
  const first = applyChampSelect(createInitialState(), makeChampSelectSession());
  const second = applyChampSelect(first, makeChampSelectSession({
    myTeam: [
      { cellId: 1, championId: 222, puuid: 'p1' },
      { cellId: 2, championId: 99, puuid: 'p2' },
    ],
  }) as ChampSelectSessionDto);
  assert.equal(second.myChampionId, 222);
});

await check('applyChampSelect 提取队友/对手/备选池英雄', () => {
  const state = applyChampSelect(createInitialState(), makeChampSelectSession());
  assert.deepEqual(state.teammateChampionIds, [222, 99, 22]); // cells 2-5，championId=0 的被过滤
  assert.deepEqual(state.enemyChampionIds, [17, 55, 63, 101, 145]);
  assert.equal(state.benchChampionIds.length, 4);
  const inGame = applyChampSelect(state, null); // 进入游戏：队友/对手保留（本局不变），备选池清空
  assert.deepEqual(inGame.teammateChampionIds, [222, 99, 22]);
  assert.deepEqual(inGame.enemyChampionIds, [17, 55, 63, 101, 145]);
  assert.deepEqual(inGame.benchChampionIds, []);
});

await check('applyChampSelect 兼容国服字段（benchChampions/cellId 0）', () => {
  const dto = {
    actions: [[{ actorCellId: 0, type: 'pick', championId: 267, completed: true, isAllyAction: true }]],
    myTeam: [{ cellId: 0, championId: 267, puuid: 'p1' }],
    theirTeam: [],
    benchChampions: [{ championId: 68, isPriority: false }, { championId: 711, isPriority: false }],
    benchEnabled: true,
    localPlayerCellId: 0,
  };
  const state = applyChampSelect(createInitialState(), dto);
  assert.equal(state.myChampionId, 267);
  assert.equal(state.localPlayerCellId, 0);
  assert.deepEqual(state.benchChampionIds, [68, 711]);
});

await check('championId 为 0（未选）时保持上次英雄', () => {
  const picked = applyChampSelect(createInitialState(), makeChampSelectSession());
  const unselected = applyChampSelect(picked, makeChampSelectSession({
    myTeam: [
      { cellId: 1, championId: 0, puuid: 'p1' },
      { cellId: 2, championId: 99, puuid: 'p2' },
    ],
  }) as ChampSelectSessionDto);
  assert.equal(unselected.myChampionId, 15);
});

await check('进入游戏保持英雄，回到大厅清空', () => {
  const picked = applyChampSelect(createInitialState(), makeChampSelectSession());
  const inGame = applyPhase(picked, { phase: 'InProgress' });
  assert.equal(inGame.myChampionId, 15);
  const lobby = applyPhase(inGame, { phase: 'Lobby' });
  assert.equal(lobby.myChampionId, null);
});

await check('applyLobby 按目标队列过滤', () => {
  const base = createInitialState();
  const filtered = applyLobby(base, makeLobby(1900), [450]);
  assert.equal(filtered.isTargetMode, false);
  const matched = applyLobby(base, makeLobby(450), [450]);
  assert.equal(matched.isTargetMode, true);
  const allModes = applyLobby(base, makeLobby(1900), null);
  assert.equal(allModes.isTargetMode, true);
  const noQueue = applyLobby(base, { gameConfig: { queueId: 0 } }, [450]);
  assert.equal(noQueue.queueId, null); // queueId 0 = 不在房间
});

await check('applyLobby 换房间同步目标队列：目标→非目标→离开房间', () => {
  const base = createInitialState();
  const target = applyLobby(base, makeLobby(3270), [3270]);
  assert.equal(target.isTargetMode, true);
  const nonTarget = applyLobby(target, makeLobby(450), [3270]);
  assert.equal(nonTarget.queueId, 450);
  assert.equal(nonTarget.isTargetMode, false);
  const left = applyLobby(nonTarget, null, [3270]);
  assert.equal(left.queueId, null); // 离开房间：清空队列
  const rejoined = applyLobby(left, makeLobby(3270), [3270]);
  assert.equal(rejoined.isTargetMode, true);
  const sameQueue = applyLobby(rejoined, makeLobby(3270), [3270]);
  assert.equal(sameQueue, rejoined); // 队列未变：引用不变（statesEqual 优化）
});

await check('applyLobby 兼容字符串 queueId（国服可能返回字符串）', () => {
  const base = createInitialState();
  const asString = applyLobby(base, { gameConfig: { queueId: '3270' } }, [3270]);
  assert.equal(asString.queueId, 3270); // 字符串归一为数字
  assert.equal(asString.isTargetMode, true);
  const empty = applyLobby(base, { gameConfig: { queueId: '' } }, [3270]);
  assert.equal(empty.queueId, null); // 空串 = 不在房间
  const nonNumeric = applyLobby(base, { gameConfig: { queueId: 'abc' } }, [3270]);
  assert.equal(nonNumeric.queueId, null);
});

await check('applySummoner 提取召唤师名字（displayName 优先）', () => {
  assert.equal(applySummoner(createInitialState(), { displayName: '  测试召唤师  ' }).summonerName, '测试召唤师');
  assert.equal(applySummoner(createInitialState(), { gameName: 'RiotID#CN' }).summonerName, 'RiotID#CN');
  assert.equal(applySummoner(createInitialState(), { displayName: '', internalName: '老内部名' }).summonerName, '老内部名');
  assert.equal(applySummoner(createInitialState(), null).summonerName, null);
  assert.equal(applySummoner(createInitialState(), {}).summonerName, null);
});

await check('集成（仅事件通道）：大厅→选人→重roll→游戏内→回大厅', async () => {
  const server = new MockLcuServer();
  const port = await server.start();
  const client = createLcuClient({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' });
  const tracker = new SessionTracker({
    fetchJson: (path) => client.request<unknown>('GET', path),
    subscribe: (endpoint, handler) => client.subscribe(endpoint, handler),
    pollIntervalMs: 0, // 仅靠事件通道
    targetQueueIds: null,
  });
  const changes: SessionState[] = [];
  tracker.onChange((state) => changes.push(state));
  try {
    server.setState({ phase: 'Lobby', lobby: makeLobby(HEX_ARAM_QUEUE_ID), session: null });
    tracker.start();
    await waitFor(() => tracker.getState().phase === 'Lobby', '初始大厅状态');
    await waitFor(() => tracker.getState().queueId === HEX_ARAM_QUEUE_ID, '队列 ID');
    await waitFor(() => tracker.getState().summonerName === '测试召唤师', '召唤师名字（mock current-summoner）');

    server.setState({ phase: 'ChampSelect', session: makeChampSelectSession() });
    server.emit('/lol-gameflow/v1/gameflow-phase', { phase: 'ChampSelect' });
    server.emit('/lol-champ-select/v1/session', {});
    await waitFor(() => tracker.getState().phase === 'ChampSelect' && tracker.getState().myChampionId === 15, '选人并识别英雄 15');

    server.setState({ session: makeChampSelectSession({
      myTeam: [
        { cellId: 1, championId: 222, puuid: 'p1' },
        { cellId: 2, championId: 99, puuid: 'p2' },
      ],
    }) as ChampSelectSessionDto });
    server.emit('/lol-champ-select/v1/session', {});
    await waitFor(() => tracker.getState().myChampionId === 222, '重roll 后英雄 222');

    server.setState({ phase: 'InProgress' });
    server.emit('/lol-gameflow/v1/gameflow-phase', { phase: 'InProgress' });
    await waitFor(
      () => tracker.getState().phase === 'InProgress' && tracker.getState().myChampionId === 222,
      '游戏内保持英雄 222',
    );

    server.setState({ phase: 'Lobby' });
    server.emit('/lol-gameflow/v1/gameflow-phase', { phase: 'Lobby' });
    await waitFor(() => tracker.getState().myChampionId === null, '回大厅清空英雄');

    assert.ok(changes.length >= 4, '状态变化事件至少 4 次，实际 ' + changes.length);
  } finally {
    tracker.stop();
    client.close();
    await server.stop();
  }
});

await check('集成（仅轮询通道，国服裸字符串 phase 形态）：完整流程', async () => {
  const server = new MockLcuServer();
  server.phaseShape = 'string';
  const port = await server.start();
  const client = createLcuClient({ host: '127.0.0.1', port, password: MOCK_PASSWORD, protocol: 'http' });
  const tracker = new SessionTracker({
    fetchJson: (path) => client.request<unknown>('GET', path),
    pollIntervalMs: 50,
    targetQueueIds: [HEX_ARAM_QUEUE_ID],
  });
  try {
    server.setState({ phase: 'Lobby', lobby: makeLobby(HEX_ARAM_QUEUE_ID), session: null });
    tracker.start();
    await waitFor(() => tracker.getState().isTargetMode === true, '目标队列识别');
    server.setState({ phase: 'ChampSelect', session: makeChampSelectSession() });
    await waitFor(() => tracker.getState().phase === 'ChampSelect', '轮询发现选人');
    await waitFor(() => tracker.getState().myChampionId === 15, '轮询识别英雄');
    server.setState({ phase: 'InProgress', session: null });
    await waitFor(() => tracker.getState().phase === 'InProgress' && tracker.getState().myChampionId === 15, '游戏内保持英雄');
  } finally {
    tracker.stop();
    client.close();
    await server.stop();
  }
});

console.log('game-session 全部通过：' + passed + ' 项 ✅');
