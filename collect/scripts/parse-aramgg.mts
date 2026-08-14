/**
 * 解析 ARAMGG 强化列表页，提取全部海克斯强化结构化数据。
 * 用法：node --experimental-strip-types collect/scripts/parse-aramgg.mts
 * 输出：collect/output/augments-aramgg.json
 *
 * 页面结构（/zh-CN/augments）：
 * <article>
 *   <a href="/zh-CN/augments/{id}" title="{描述}">
 *     <img src=".../augment-icons/{icon}.png" alt="{强化名}">
 *     <p>强化名</p>
 *     <span class="... rarity-{稀有度}">棱彩/黄金/白银</span>
 *   </a>
 *   <a href="/zh-CN/champion-stats/{champId}" title="{英雄名}">  ← 适配英雄
 * </article>
 */

import { readFile, writeFile } from 'node:fs/promises';

const HTML_PATH = new URL('../output/raw/aramgg-augments.html', import.meta.url);
const OUT_PATH = new URL('../output/augments-aramgg.json', import.meta.url);

interface Augment {
  id: string;
  icon: string;
  name: string;
  rarity: string;
  description: string;
  champions: { id: string; name: string }[];
}

const html = await readFile(HTML_PATH, 'utf8');

// 按 <article ...> ... </article> 切块
const articleRe = /<article[\s\S]*?<\/article>/g;
const augments = new Map<string, Augment>();
let articleCount = 0;

for (const m of html.matchAll(articleRe)) {
  articleCount++;
  const block = m[0];
  const link = block.match(/href="\/zh-CN\/augments\/(\d+)"/);
  if (!link) continue;
  const id = link[1];
  if (augments.has(id)) continue; // 去重

  const title = block.match(/href="\/zh-CN\/augments\/\d+"[^>]*title="([^"]*)"/);
  const img = block.match(/augment-icons\/([a-zA-Z0-9_]+)\.png" alt="([^"]+)"/);
  const name = img ? img[2] : id;
  const icon = img ? img[1] : '';
  const rarity = block.match(/text-xs rarity-(\w+)">([^<]+)</);
  const champions = [...block.matchAll(/href="\/zh-CN\/champion-stats\/(\d+)" title="([^"]+)"/g)].map(
    (c) => ({ id: c[1], name: c[2] }),
  );

  augments.set(id, {
    id,
    icon,
    name,
    rarity: rarity ? rarity[2] : '',
    description: title ? title[1].replace(/<[^>]+>/g, '') : '',
    champions,
  });
}

const list = [...augments.values()].sort((a, b) => Number(a.id) - Number(b.id));
const byRarity: Record<string, number> = {};
for (const a of list) byRarity[a.rarity] = (byRarity[a.rarity] ?? 0) + 1;

await writeFile(OUT_PATH, JSON.stringify(list, null, 2), 'utf8');
console.log(`articles: ${articleCount}`);
console.log(`unique augments: ${list.length}`);
console.log('rarity distribution:', byRarity);
console.log(`saved ${OUT_PATH.pathname}`);
