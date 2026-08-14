/**
 * guides-final.json → CSV（供项目后续使用，未转换 TSV 格式）。
 * 用法：node --experimental-strip-types collect/scripts/gen-csv.mts
 * 输出：collect/output/champions-guides.csv
 *
 * 列：champion,buildName,hextech,items,tips,patch
 * - hextech / items 子项用顿号（、）连接，保持优先级/出装顺序
 * - tips 多条用全角分号（；）连接
 * - CSV 转义：含逗号/引号/换行的字段加引号（RFC 4180）
 */

import { readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../output/guides-final.json', import.meta.url);
const OUT = new URL('../output/champions-guides.csv', import.meta.url);

interface Guide {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  tips: string[];
  patch: string;
}

const guides: Guide[] = JSON.parse(await readFile(SRC, 'utf8'));

function csvField(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const lines: string[] = ['champion,buildName,hextech,items,tips,patch'];
for (const g of guides) {
  const row = [
    g.champion,
    g.buildName,
    g.hextech.join('、'),
    g.items.join('、'),
    g.tips.join('；'),
    g.patch,
  ];
  lines.push(row.map(csvField).join(','));
}

await writeFile(OUT, '\uFEFF' + lines.join('\r\n'), 'utf8');
console.log(`csv rows: ${lines.length - 1} (${new Set(guides.map((g) => g.champion)).size} champions)`);
console.log(`saved ${OUT.pathname} (UTF-8 BOM)`);
