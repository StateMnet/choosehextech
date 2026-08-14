import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildBundle,
  DATA_MODE,
  loadAliasMap,
  loadNameSet,
  loadPairMap,
  parseBundle,
  parseSimpleCsv,
  parseTsv,
  validateRows,
} from '../packages/data-core/src/index.ts';

/** 宽松加载 URL 映射表：从候选列名中挑选实际表头，找不到对应列或文件不存在返回 undefined */
function loadUrlMap(
  path: string,
  keyCandidates: string[],
  valueCandidates: string[],
): Record<string, string> | undefined {
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, 'utf8');
  const table = parseSimpleCsv(text);
  const key = keyCandidates.find((candidate) => table.headers.includes(candidate));
  const value = valueCandidates.find((candidate) => table.headers.includes(candidate));
  if (!key || !value) {
    console.warn('[警告] ' + path + ' 表头无法识别（实际：' + table.headers.join('、') + '），已跳过该映射');
    return undefined;
  }
  const map = new Map<string, string>();
  for (const row of table.rows) {
    const name = (row[key] ?? '').trim();
    const url = (row[value] ?? '').trim();
    if (name && url) map.set(name, url);
  }
  return Object.fromEntries(map);
}

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'data');

const release = JSON.parse(readFileSync(join(dataDir, 'meta', 'release.json'), 'utf8')) as {
  dataVersion: string;
  gamePatch: string;
};

const championsText = readFileSync(join(dataDir, 'champions.tsv'), 'utf8');
const aliases = loadAliasMap(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8'));
const itemNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'items.tsv'), 'utf8'));
const augmentNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'hextech.tsv'), 'utf8'));
const championIdsPath = join(dataDir, 'generated', 'champion-ids.csv');
const championIds = existsSync(championIdsPath)
  ? loadPairMap(readFileSync(championIdsPath, 'utf8'), 'championId', '数字ID', { numericValues: true })
  : undefined;
const augmentIconsPath = join(dataDir, 'meta', 'hextech-icons.csv');
const augmentIcons = loadUrlMap(augmentIconsPath, ['海克斯强化', '强化名'], ['图标URL', '图标']);
const championIconsPath = join(dataDir, 'meta', 'champion-icons.csv');
const championIcons = loadUrlMap(championIconsPath, ['英雄名', '名称'], ['头像URL', '图标URL', '图标']);
const itemIconsPath = join(dataDir, 'meta', 'item-icons.csv');
const itemIcons = loadUrlMap(itemIconsPath, ['装备名', '名称'], ['图标URL', '图标']);

const { rows } = parseTsv(championsText);
const result = validateRows(rows, { aliases, itemNames, augmentNames, strictNames: true });
if (!result.ok) {
  for (const issue of result.issues) {
    console.log('[错误] 第 ' + issue.line + ' 行 · ' + issue.field + '：' + issue.message);
  }
  console.log('校验未通过，已中止打包');
  process.exit(1);
}

const bundle = buildBundle(rows, {
  dataVersion: release.dataVersion,
  gamePatch: release.gamePatch,
  mode: DATA_MODE,
  aliases,
  championIds,
});
if (augmentIcons !== undefined) bundle.augmentIcons = augmentIcons;
if (championIcons !== undefined) bundle.championIcons = championIcons;
if (itemIcons !== undefined) bundle.itemIcons = itemIcons;
for (const champion of bundle.champions) {
  if (champion.numericId === undefined) {
    console.log('[警告] 英雄「' + champion.nameZh + '」缺少数字 ID 映射（data/generated/champion-ids.csv），桌面端无法自动识别该英雄');
  }
}
parseBundle(bundle); // 打包产物再过一遍 zod schema，双保险

const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });

const bundleFileName = 'data-' + release.dataVersion + '.json';
const bundleJson = JSON.stringify(bundle, null, 2);
writeFileSync(join(distDir, bundleFileName), bundleJson, 'utf8');

const sha256 = createHash('sha256').update(bundleJson, 'utf8').digest('hex');
const manifest = {
  schemaVersion: 1,
  dataVersion: release.dataVersion,
  gamePatch: release.gamePatch,
  mode: DATA_MODE,
  file: bundleFileName,
  sha256,
  builtAt: new Date().toISOString(),
};
writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('已生成 dist/' + bundleFileName + '（' + bundle.champions.length + ' 个英雄，' + rows.length + ' 个套路）');
console.log('已生成 dist/manifest.json，sha256: ' + sha256.slice(0, 16) + '…');
