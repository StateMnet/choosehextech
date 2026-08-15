import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBundle,
  DATA_MODE,
  loadAliasMap,
  loadPairMap,
  parseBundle,
  parseTsv,
} from '../packages/data-core/src/index.ts';
import type { SessionState } from '../packages/game-session/src/index.ts';
import { windowVisibilityFor } from '../apps/desktop/src/main/policy.ts';
import { loadDataBundle } from '../apps/desktop/src/main/data-loader.ts';
import {
  buildQuickChampionList,
  championByNameZh,
  championByNumericId,
  defaultBuildName,
  searchChampions,
} from '../apps/desktop/src/renderer/src/lib/select.ts';
import { augmentPlaceholderIcon, hashString, resolveAugmentIcon, resolveChampionIcon, resolveItemIcon } from '../apps/desktop/src/renderer/src/lib/icons.ts';
import { isOverlayWindow } from '../apps/desktop/src/renderer/src/lib/overlay.ts';
import { clampOpacity, loadConfig, saveConfig } from '../apps/desktop/src/main/config.ts';

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

function makeState(overrides: Partial<SessionState>): SessionState {
  return {
    phase: 'None',
    queueId: null,
    isTargetMode: true,
    summonerName: null,
    localPlayerCellId: null,
    myChampionId: null,
    teammateChampionIds: [],
    enemyChampionIds: [],
    benchChampionIds: [],
    ...overrides,
  };
}

function loadFixtureBundle() {
  const dataDir = join(import.meta.dirname, '..', 'data');
  const { rows } = parseTsv(readFileSync(join(dataDir, 'champions.tsv'), 'utf8'));
  const aliases = loadAliasMap(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8'));
  const championIds = loadPairMap(readFileSync(join(dataDir, 'generated', 'champion-ids.csv'), 'utf8'), 'championId', '数字ID');
  return buildBundle(rows, { dataVersion: '0.1.0', gamePatch: '25.24', mode: DATA_MODE, aliases, championIds });
}

// ---- 窗口策略 ----
await check('客户端连接后选人阶段显示面板', () => {
  const visibility = windowVisibilityFor(makeState({ phase: 'ChampSelect', isTargetMode: true }), {
    overlayEnabled: false,
    panelManuallyOpen: false,
    overlayManuallyOpen: false,
  });
  assert.equal(visibility.panel, true);
  assert.equal(visibility.overlay, false);
});

await check('客户端连接后任意阶段显示面板（决策 #7/#22：游戏内隐藏）', () => {
  for (const phase of ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'WaitingForStats']) {
    const visibility = windowVisibilityFor(makeState({ phase: phase as SessionState['phase'], isTargetMode: false }), {
      overlayEnabled: false,
      panelManuallyOpen: false,
      overlayManuallyOpen: false,
    });
    assert.equal(visibility.panel, true, phase + ' 阶段面板应可见');
  }
  // 游戏中（InProgress）：面板自动隐藏，除非用户手动打开
  const inGame = makeState({ phase: 'InProgress', isTargetMode: false });
  assert.equal(
    windowVisibilityFor(inGame, { overlayEnabled: false, panelManuallyOpen: false, overlayManuallyOpen: false }).panel,
    false,
    '游戏中面板应自动隐藏',
  );
  assert.equal(
    windowVisibilityFor(inGame, { overlayEnabled: false, panelManuallyOpen: true, overlayManuallyOpen: false }).panel,
    true,
    '游戏中手动打开面板仍可见',
  );
});

await check('手动打开面板时任意阶段可见', () => {
  const visibility = windowVisibilityFor(makeState({ phase: 'Lobby' }), {
    overlayEnabled: false,
    panelManuallyOpen: true,
    overlayManuallyOpen: false,
  });
  assert.equal(visibility.panel, true);
  const inGame = windowVisibilityFor(makeState({ phase: 'InProgress' }), {
    overlayEnabled: false,
    panelManuallyOpen: true,
    overlayManuallyOpen: false,
  });
  assert.equal(inGame.panel, true);
});

await check('游戏中浮窗自动显示（目标队列）', () => {
  const state = makeState({ phase: 'InProgress', isTargetMode: true });
  assert.equal(windowVisibilityFor(state, { overlayEnabled: true, panelManuallyOpen: false, overlayManuallyOpen: false }).overlay, true);
  assert.equal(windowVisibilityFor(state, { overlayEnabled: false, panelManuallyOpen: false, overlayManuallyOpen: false }).overlay, false);
});

await check('浮窗手动开关：任意阶段可强制显示，离开游戏不自动隐藏', () => {
  const lobby = makeState({ phase: 'Lobby', isTargetMode: true });
  assert.equal(windowVisibilityFor(lobby, { overlayEnabled: true, panelManuallyOpen: false, overlayManuallyOpen: true }).overlay, true);
  const inGame = makeState({ phase: 'InProgress', isTargetMode: true });
  assert.equal(windowVisibilityFor(inGame, { overlayEnabled: true, panelManuallyOpen: false, overlayManuallyOpen: true }).overlay, true);
});

await check('未连接客户端时仅手动面板/浮窗可用', () => {
  assert.deepEqual(windowVisibilityFor(null, { overlayEnabled: true, panelManuallyOpen: false, overlayManuallyOpen: false }), { panel: false, overlay: false });
  assert.equal(windowVisibilityFor(null, { overlayEnabled: true, panelManuallyOpen: true, overlayManuallyOpen: false }).panel, true);
  assert.equal(windowVisibilityFor(null, { overlayEnabled: true, panelManuallyOpen: false, overlayManuallyOpen: true }).overlay, true);
});

// ---- 数据查询 ----
await check('select：数字 ID 与译名查询', () => {
  const bundle = loadFixtureBundle();
  assert.equal(championByNumericId(bundle, 15)?.championId, 'Sivir');
  assert.equal(championByNumericId(bundle, 999), undefined);
  assert.equal(championByNameZh(bundle, '希维尔')?.championId, 'Sivir');
  assert.equal(championByNameZh(bundle, '不存在的英雄'), undefined);
});

await check('select：默认选中第一个套路', () => {
  assert.equal(defaultBuildName([{ name: 'A' }, { name: 'B' }]), 'A');
  assert.equal(defaultBuildName([]), '');
});

await check('select：关键词搜索英雄名与套路名', () => {
  const bundle = loadFixtureBundle();
  const byXin = searchChampions(bundle, '希');
  assert.ok(byXin.length >= 3, '希维尔/艾希/希瓦娜等，实际 ' + byXin.length);
  assert.ok(byXin.some((champion) => champion.championId === 'Sivir'));
  assert.ok(byXin.some((champion) => champion.championId === 'Ashe'));
  assert.ok(searchChampions(bundle, '').length >= 100);
  const byBuild = searchChampions(bundle, '暴击');
  assert.ok(byBuild.some((champion) => champion.championId === 'Sivir'));
});

// ---- 数据加载 ----
await check('data-loader：找到并校验数据包', () => {
  const bundle = loadFixtureBundle();
  const dir = join(import.meta.dirname, '..', '.tmp-test', 'bundle-dir');
  mkdirSync(dir, { recursive: true });
  const fileName = 'data-0.1.0.json';
  writeFileSync(join(dir, fileName), JSON.stringify(parseBundle(bundle)));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ file: fileName }));
  try {
    const loaded = loadDataBundle([dir]);
    assert.ok(loaded);
    assert.equal(loaded.bundle.dataVersion, '0.1.0');
    assert.ok(loaded.bundle.champions.length >= 100);
  } finally {
    rmSync(join(import.meta.dirname, '..', '.tmp-test'), { recursive: true, force: true });
  }
});

await check('icons：同名同图与确定性占位', () => {
  assert.equal(augmentPlaceholderIcon('能量汲取'), augmentPlaceholderIcon('能量汲取'));
  assert.notEqual(augmentPlaceholderIcon('能量汲取'), augmentPlaceholderIcon('技能急速'));
  assert.ok(augmentPlaceholderIcon('能量汲取').startsWith('data:image/svg+xml'));
  assert.equal(hashString('abc'), hashString('abc'));
  assert.equal(resolveAugmentIcon('能量汲取'), augmentPlaceholderIcon('能量汲取')); // 无映射 → 占位
});

await check('icons：海克斯映射命中 → 直链，未命中回落占位', () => {
  const url = resolveAugmentIcon('能量汲取', { 能量汲取: 'https://cdn.example.com/energy.png' });
  assert.equal(url, 'https://cdn.example.com/energy.png');
  assert.notEqual(url, augmentPlaceholderIcon('能量汲取'));
  assert.equal(resolveAugmentIcon('不存在的强化', { 能量汲取: 'https://cdn.example.com/energy.png' }), augmentPlaceholderIcon('不存在的强化'));
});

await check('icons：装备图标映射命中 → 直链，未命中回落占位', () => {
  assert.equal(resolveItemIcon('海妖杀手', { 海妖杀手: 'https://cdn.example.com/ks.png' }), 'https://cdn.example.com/ks.png');
  assert.notEqual(resolveItemIcon('海妖杀手', {}), resolveItemIcon('无尽之刃', {}));
  assert.ok(resolveItemIcon('海妖杀手', {}).startsWith('data:image/svg+xml'));
});

await check('select：选人阶段快捷英雄列表（我/队友/备选池，去重/分组）', () => {
  const bundle = loadFixtureBundle();
  const state = makeState({
    phase: 'ChampSelect',
    myChampionId: 15,
    teammateChampionIds: [222, 99],
    enemyChampionIds: [17], // 对手不进入快捷栏
    benchChampionIds: [68, 15], // 15 与己方重复 → 去重
  });
  const list = buildQuickChampionList(bundle, state);
  assert.equal(list.length, 4);
  assert.equal(list[0].group, 'me');
  assert.equal(list[0].championId, 'Sivir');
  assert.ok(list.some((c) => c.championId === 'Jinx' && c.group === 'team'));
  assert.ok(list.some((c) => c.championId === 'Lux' && c.group === 'team'));
  assert.ok(list.some((c) => c.championId === 'Rumble' && c.group === 'bench'));
  assert.ok(!list.some((c) => c.championId === 'Teemo'), '对手不应出现在快捷栏');
  assert.equal(buildQuickChampionList(bundle, makeState({ phase: 'Lobby', myChampionId: 15 })).length, 0);
});

await check('select：游戏内快捷列表只有我和队友（无备选池）', () => {
  const bundle = loadFixtureBundle();
  const state = makeState({
    phase: 'InProgress',
    myChampionId: 15,
    teammateChampionIds: [222, 99],
    benchChampionIds: [68], // 游戏内备选池无效，不应出现
  });
  const list = buildQuickChampionList(bundle, state);
  assert.equal(list.length, 3);
  assert.ok(list.every((c) => c.group === 'me' || c.group === 'team'));
  assert.ok(!list.some((c) => c.group === 'bench'));
});

await check('icons：英雄头像解析（爬取 URL 优先，缺失回退 Data Dragon）', () => {
  const crawled = resolveChampionIcon('安妮', 'Annie', { 安妮: 'https://cdn.example.com/annie.png' });
  assert.equal(crawled, 'https://cdn.example.com/annie.png');
  const fallback = resolveChampionIcon('安妮', 'Annie', {});
  assert.ok(fallback.includes('Annie.png'));
  assert.ok(fallback.includes('ddragon'));
});

await check('overlay：浮窗入口判定', () => {
  assert.equal(isOverlayWindow('?overlay=1'), true);
  assert.equal(isOverlayWindow(''), false);
});

await check('config：读写与透明度钳制', () => {
  const dir = join(import.meta.dirname, '..', '.tmp-test', 'config-dir');
  try {
    assert.deepEqual(loadConfig(dir), { overlay: { opacity: 0.88 }, update: {} }); // 不存在 → 默认
    saveConfig(dir, { overlay: { x: 100, y: 200, opacity: 0.6 }, update: {} });
    const loaded = loadConfig(dir);
    assert.equal(loaded.overlay.x, 100);
    assert.equal(loaded.overlay.opacity, 0.6);
    assert.equal(clampOpacity(2), 1);
    assert.equal(clampOpacity(0.1), 0.3);
    assert.equal(clampOpacity(undefined), 0.88);
  } finally {
    rmSync(join(import.meta.dirname, '..', '.tmp-test'), { recursive: true, force: true });
  }
});

await check('data-loader：目录缺失返回 null', () => {
  assert.equal(loadDataBundle(['Z:/绝对不存在的目录']), null);
});

console.log('desktop-logic 全部通过：' + passed + ' 项 ✅');
