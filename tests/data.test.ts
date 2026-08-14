import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBundle,
  DATA_MODE,
  loadAliasMap,
  loadNameSet,
  loadPairMap,
  mergeRows,
  normalizeImportedEntry,
  parseBundle,
  ParseError,
  parseTsv,
  validateRows,
  type RawBuildRow,
} from '../packages/data-core/src/index.ts';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'data');

const HEADER = ['英雄', '套路名', '海克斯推荐', '装备推荐', '对局技巧', '作者', '适用版本'];

function makeTsv(rows: string[][]): string {
  return [HEADER.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n') + '\n';
}

function loadRealTables() {
  const aliases = loadAliasMap(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8'));
  const itemNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'items.tsv'), 'utf8'));
  const augmentNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'hextech.tsv'), 'utf8'));
  return { aliases, itemNames, augmentNames };
}

const VALID_ROW = ['希维尔', '示例-测试流', '攻击力强化、暴击强化', '海妖杀手、无尽之刃', '技巧一；技巧二', '', '25.24'];

// 极简测试运行器：纯断言脚本，直接由 node 执行，不依赖 test runner 的子进程模型
let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    throw error;
  }
}

check('占位数据全量通过严格校验', () => {
  const { aliases, itemNames, augmentNames } = loadRealTables();
  const { rows, warnings } = parseTsv(readFileSync(join(dataDir, 'champions.tsv'), 'utf8'));
  const result = validateRows(rows, { aliases, itemNames, augmentNames, strictNames: true });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.ok(new Set(rows.map((row) => row.champion)).size >= 100, '英雄数应覆盖全量');
  assert.equal(rows.filter((row) => row.champion === '希维尔').length, 3);
  assert.equal(warnings.length, 0);
});

check('未知英雄名报错', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(makeTsv([['不存在的英雄', '示例流', '攻击力强化', '海妖杀手', '技巧', '', '25.24']]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === '英雄'));
});

check('同一英雄套路名重复报错', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(makeTsv([VALID_ROW, VALID_ROW]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === '套路名' && issue.message.includes('重复')));
});

check('海克斯推荐为空报错', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(makeTsv([['希维尔', '示例流', '', '海妖杀手', '技巧', '', '25.24']]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === '海克斯推荐'));
});

check('单条技巧超过 60 字报错', () => {
  const { aliases } = loadRealTables();
  const longTip = '长'.repeat(61);
  const { rows } = parseTsv(makeTsv([['希维尔', '示例流', '攻击力强化', '海妖杀手', longTip, '', '25.24']]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === '对局技巧'));
});

check('适用版本格式错误报错', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(makeTsv([['希维尔', '示例流', '攻击力强化', '海妖杀手', '技巧', '', '25']]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === '适用版本'));
});

check('缺少必需列时抛 ParseError', () => {
  assert.throws(() => parseTsv('英雄\t套路名\n希维尔\t示例流\n'), ParseError);
});

check('作者列可空', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(makeTsv([VALID_ROW]));
  const result = validateRows(rows, { aliases });
  assert.equal(result.ok, true);
  assert.equal(rows[0].author, undefined);
});

check('打包产物结构与 zod 校验一致', () => {
  const { aliases } = loadRealTables();
  const { rows } = parseTsv(readFileSync(join(dataDir, 'champions.tsv'), 'utf8'));
  const release = JSON.parse(readFileSync(join(dataDir, 'meta', 'release.json'), 'utf8')) as {
    dataVersion: string;
    gamePatch: string;
  };
  const championIds = loadPairMap(
    readFileSync(join(dataDir, 'generated', 'champion-ids.csv'), 'utf8'),
    'championId',
    '数字ID',
  );
  const bundle = buildBundle(rows, {
    dataVersion: release.dataVersion,
    gamePatch: release.gamePatch,
    mode: DATA_MODE,
    aliases,
    championIds,
  });
  const parsed = parseBundle(bundle);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.mode, 'hextech-aram');
  assert.ok(parsed.champions.length >= 100, '数据包应覆盖全英雄');
  const withIcons = parseBundle({ ...bundle, augmentIcons: { 能量汲取: 'energy.png' } });
  assert.equal(withIcons.augmentIcons?.['能量汲取'], 'energy.png');

  const sivir = parsed.champions.find((champion) => champion.championId === 'Sivir');
  assert.ok(sivir);
  assert.equal(sivir.numericId, 15);
  assert.equal(sivir.builds.length, 3);
  // 占位数据已被社区采集的真实数据替换（collect/ 采集管线）
  assert.ok(sivir.builds.every((build) => !build.name.startsWith('示例-') && !build.name.includes('占位')));
  assert.equal(sivir.builds[0]?.updatedPatch, '26.16');
});

console.log('');
await check('normalizeImportedEntry 支持数组与分隔字符串两种写法', () => {
  const fromArrays = normalizeImportedEntry({
    champion: '娜美',
    buildName: '辅助奶流',
    hextech: ['治疗强化', '护盾强化'],
    items: ['月石再生器', '救赎'],
    tips: ['跟着AD走', 'Q技能预判走位'],
    patch: '25.24',
  });
  assert.ok(fromArrays);
  assert.deepEqual(fromArrays.hextech, ['治疗强化', '护盾强化']);
  assert.equal(fromArrays.author, undefined);

  const fromStrings = normalizeImportedEntry({
    nameZh: '娜美',
    build: '消耗流',
    hextech: '法强强化、技能急速',
    items: '卢登的伙伴、影焰',
    tips: '用W消耗；E给AD',
    author: 'AI',
    patch: '25.24',
  });
  assert.ok(fromStrings);
  assert.equal(fromStrings.buildName, '消耗流');
  assert.deepEqual(fromStrings.items, ['卢登的伙伴', '影焰']);
  assert.deepEqual(fromStrings.tips, ['用W消耗', 'E给AD']);
  assert.equal(fromStrings.author, 'AI');

  assert.equal(normalizeImportedEntry({ champion: '娜美' }), null);
  assert.equal(normalizeImportedEntry('不是对象'), null);
});

await check('mergeRows 按英雄整组替换，其余英雄保留', () => {
  const makeRow = (champion: string, buildName: string): RawBuildRow => ({
    champion,
    buildName,
    hextech: ['示例强化A'],
    items: ['示例装备A'],
    tips: ['占位技巧'],
    patch: '25.24',
  });
  const existing = [makeRow('娜美', 'A流'), makeRow('娜美', 'B流'), makeRow('阿狸', 'C流')];
  const merged = mergeRows(existing, [makeRow('娜美', '新套路')]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((row) => row.champion === '阿狸' && row.buildName === 'C流'));
  assert.ok(merged.some((row) => row.champion === '娜美' && row.buildName === '新套路'));
  assert.ok(!merged.some((row) => row.buildName === 'A流'));
});

console.log('全部通过：' + passed + ' 项 ✅');
