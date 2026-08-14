/**
 * 解析 ARAMGG 首页英雄强度榜。
 * 用法：node --experimental-strip-types collect/scripts/parse-home.mts
 * 输出：collect/output/home-ranking.json
 *
 * 表格行结构：
 * <tr data-ranking-row data-tier-value="1" ...>
 *   <span class="... rank-gold">排名</span>
 *   <a href="/zh-CN/champion-stats/{id}"> ... {英雄名} </a>
 *   <span ...>T1</span>
 *   <td data-top-augments-cell> <a href="/zh-CN/augments/{id}" title="{强化名}"> ... </td>
 * </tr>
 */

import { readFile, writeFile } from 'node:fs/promises';

const HTML_PATH = new URL('../output/raw/aramgg-home.html', import.meta.url);
const OUT_PATH = new URL('../output/home-ranking.json', import.meta.url);

interface RankRow {
  rank: number;
  championId: string;
  championName: string;
  tier: string;
  augments: { id: string; name: string }[];
}

const html = await readFile(HTML_PATH, 'utf8');
const rows: RankRow[] = [];

const rowRe = /<tr[^>]*data-ranking-row[^>]*>[\s\S]*?<\/tr>/g;
for (const m of html.matchAll(rowRe)) {
  const block = m[0];
  const rankM = block.match(/<span class="text-sm font-bold[^"]*">(\d+)<\/span>/);
  const champM = block.match(/href="\/zh-CN\/champion-stats\/(\d+)"[^>]*>[\s\S]*?alt="([^"]+)"|alt="([^"]+)"/);
  const tierM = block.match(/T([1-5])</);
  const augM = [...block.matchAll(/href="\/zh-CN\/augments\/(\d+)"[^>]*title="([^"]+)"/g)].map(
    (a) => ({ id: a[1], name: a[2] }),
  );
  if (!rankM || !tierM) continue;
  const cid = champM ? champM[1] : '';
  const cname = champM ? champM[2] ?? champM[3] : '';
  rows.push({
    rank: Number(rankM[1]),
    championId: cid,
    championName: cname,
    tier: `T${tierM[1]}`,
    augments: augM,
  });
}

await writeFile(OUT_PATH, JSON.stringify(rows, null, 2), 'utf8');
console.log(`rows parsed: ${rows.length}`);
console.log('tier distribution:', rows.reduce<Record<string, number>>((acc, r) => {
  acc[r.tier] = (acc[r.tier] ?? 0) + 1;
  return acc;
}, {}));
console.log('top 20:');
for (const r of rows.slice(0, 20)) {
  console.log(
    `${r.rank}\t${r.tier}\t${r.championName} (${r.championId})\t强化[${r.augments.length}]: ${r.augments.map((a) => a.name).join(' / ')}`,
  );
}
console.log(`saved ${OUT_PATH.pathname}`);
