import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAliasMap, loadNameSet, parseTsv, validateRows } from '../packages/data-core/src/index.ts';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'data');

const championsText = readFileSync(join(dataDir, 'champions.tsv'), 'utf8');
const aliases = loadAliasMap(readFileSync(join(dataDir, 'generated', 'aliases.csv'), 'utf8'));

const itemsPath = join(dataDir, 'meta', 'items.tsv');
const hextechPath = join(dataDir, 'meta', 'hextech.tsv');
const itemNames = existsSync(itemsPath) ? loadNameSet(readFileSync(itemsPath, 'utf8')) : undefined;
const augmentNames = existsSync(hextechPath) ? loadNameSet(readFileSync(hextechPath, 'utf8')) : undefined;

const { rows, warnings: parseWarnings } = parseTsv(championsText);
const result = validateRows(rows, { aliases, itemNames, augmentNames, strictNames: true });

for (const warning of parseWarnings) console.log('[警告] ' + warning);
for (const warning of result.warnings) console.log('[警告] ' + warning);
for (const issue of result.issues) {
  console.log('[错误] 第 ' + issue.line + ' 行 · ' + issue.field + '：' + issue.message);
}

const championCount = new Set(rows.map((row) => row.champion)).size;
console.log('');
console.log('数据行数：' + rows.length + '，英雄数：' + championCount + '，校验：' + (result.ok ? '通过 ✅' : '失败 ❌'));

if (!result.ok) process.exitCode = 1;
