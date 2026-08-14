import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadAliasMap,
  loadNameSet,
  mergeRows,
  normalizeImportedEntry,
  parseTsv,
  validateRows,
} from '../../packages/data-core/src/index.ts';

// JSON 数据导入器：把外部模型采集的 JSON 数组合并进 data/champions.tsv
// 自动补充装备/海克斯名称表，全量校验通过才写入。
// 用法：node --experimental-strip-types scripts/dev/import-json.ts <数据.json> [--dry-run]
const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!inputPath || !existsSync(inputPath)) {
  console.error('用法：node --experimental-strip-types scripts/dev/import-json.ts <数据.json> [--dry-run]');
  process.exit(1);
}

const root = join(import.meta.dirname, '..', '..');
const dataDir = join(root, 'data');

const rawList: unknown = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!Array.isArray(rawList)) {
  console.error('JSON 文件必须是数组');
  process.exit(1);
}

const imported = rawList
  .map((entry) => normalizeImportedEntry(entry))
  .filter((row): row is NonNullable<typeof row> => row !== null);
if (imported.length !== rawList.length) {
  console.log('[警告] ' + (rawList.length - imported.length) + ' 条无法归一（字段缺失/格式错误），已跳过');
}
if (imported.length === 0) {
  console.error('没有可导入的数据行');
  process.exit(1);
}

const existingText = readFileSync(join(dataDir, 'champions.tsv'), 'utf8');
const existingRows = parseTsv(existingText).rows;
const merged = mergeRows(existingRows, imported);

// 装备/强化名称表自动补全（模型给出的真实名称大概率不在占位表里）
const itemNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'items.tsv'), 'utf8'));
const augmentNames = loadNameSet(readFileSync(join(dataDir, 'meta', 'hextech.tsv'), 'utf8'));
const newItems = new Set<string>();
const newAugments = new Set<string>();
for (const row of imported) {
  for (const item of row.items) if (!itemNames.has(item)) newItems.add(item);
  for (const augment of row.hextech) if (!augmentNames.has(augment)) newAugments.add(augment);
}
for (const name of newItems) itemNames.add(name);
for (const name of newAugments) augmentNames.add(name);

const aliases = loadAliasMap(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8'));
const result = validateRows(merged, { aliases, itemNames, augmentNames, strictNames: true });
for (const issue of result.issues) {
  console.log('[错误] 第 ' + issue.line + ' 行 · ' + issue.field + '：' + issue.message);
}
if (!result.ok) {
  console.error('校验未通过，未写入任何文件（可加 --dry-run 预览）');
  process.exit(1);
}

const champions = [...new Set(imported.map((row) => row.champion))];
if (dryRun) {
  console.log('校验通过（dry-run，未写入）。将导入 ' + imported.length + ' 行，覆盖英雄：' + champions.join('、'));
  process.exit(0);
}

// 写回主数据表（保留注释头）
const existingLines = existingText.split(/\r?\n/);
const headerLines = existingLines.filter((line) => line.startsWith('#') || line.trim() === '英雄\t套路名\t海克斯推荐\t装备推荐\t对局技巧\t作者\t适用版本');
const dataLines = merged.map((row) =>
  [row.champion, row.buildName, row.hextech.join('、'), row.items.join('、'), row.tips.join('；'), row.author ?? '', row.patch].join('\t'),
);
writeFileSync(join(dataDir, 'champions.tsv'), [...headerLines, ...dataLines].join('\n') + '\n', 'utf8');
if (newItems.size > 0) appendFileSync(join(dataDir, 'meta', 'items.tsv'), [...newItems].join('\n') + '\n', 'utf8');
if (newAugments.size > 0) appendFileSync(join(dataDir, 'meta', 'hextech.tsv'), [...newAugments].join('\n') + '\n', 'utf8');

console.log('已导入 ' + imported.length + ' 行（覆盖英雄：' + champions.join('、') + '），新增装备 ' + newItems.size + ' 项、海克斯强化 ' + newAugments.size + ' 项');
console.log('下一步：node --experimental-strip-types scripts/build-data.ts 重新打包数据');
