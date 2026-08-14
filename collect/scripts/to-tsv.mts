/**
 * 把采集数据（collect/output/guides-final.json）转换进正式数据管线：
 * - data/champions.tsv       主数据表（占位数据全量替换为采集数据）
 * - data/meta/hextech.tsv    强化名称表（全部 205 个强化名）
 * - data/meta/items.tsv      装备名称表（数据中用到的全部装备名）
 * 用法：node --experimental-strip-types collect/scripts/to-tsv.mts
 * 注意：转换后请运行 node --experimental-strip-types scripts/validate.ts 校验。
 */

import { readFile, writeFile } from 'node:fs/promises';

const GUIDES_PATH = new URL('../output/guides-final.json', import.meta.url);
const AUGMENTS_PATH = new URL('../output/augments-aramgg.json', import.meta.url);
const CHAMPIONS_TSV = new URL('../../data/champions.tsv', import.meta.url);
const HEX_META = new URL('../../data/meta/hextech.tsv', import.meta.url);
const ITEMS_META = new URL('../../data/meta/items.tsv', import.meta.url);

interface Guide {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  tips: string[];
  patch: string;
}

const guides: Guide[] = JSON.parse(await readFile(GUIDES_PATH, 'utf8'));
const augments: { name: string }[] = JSON.parse(await readFile(AUGMENTS_PATH, 'utf8'));

const AUTHOR = '社区采集';
const today = new Date().toISOString().slice(0, 10);

// ---------- data/champions.tsv ----------
const header = [
  '# ChooseHextech 真实攻略数据（社区采集，由 collect/scripts/to-tsv.mts 生成）',
  '# 数据来源：ARAMGG 国服对局统计（aramgg.com，腾讯国服公开统计）+ AI 编写对局技巧',
  '# 采集时间：' + today + '；占位样例数据已被替换',
  '# 格式：英雄  套路名  海克斯推荐  装备推荐  对局技巧  作者  适用版本',
  '英雄\t套路名\t海克斯推荐\t装备推荐\t对局技巧\t作者\t适用版本',
];
for (const g of guides) {
  header.push(
    [g.champion, g.buildName, g.hextech.join('、'), g.items.join('、'), g.tips.join('；'), AUTHOR, g.patch].join('\t'),
  );
}
await writeFile(CHAMPIONS_TSV, header.join('\n') + '\n', 'utf8');
console.log(`champions.tsv: ${guides.length} 行`);

// ---------- data/meta/hextech.tsv ----------
const hexNames = [...new Set(augments.map((a) => a.name))].sort();
await writeFile(
  HEX_META,
  ['# 海克斯强化名称表（社区采集数据生成，来源 ARAMGG 国服强化清单）', '海克斯强化', ...hexNames].join('\n') + '\n',
  'utf8',
);
console.log(`meta/hextech.tsv: ${hexNames.length} 个强化名`);

// ---------- data/meta/items.tsv ----------
const itemNames = [...new Set(guides.flatMap((g) => g.items))].sort();
await writeFile(
  ITEMS_META,
  ['# 装备名称表（社区采集数据生成，来源 ARAMGG 出装数据，国服译名）', '装备名', ...itemNames].join('\n') + '\n',
  'utf8',
);
console.log(`meta/items.tsv: ${itemNames.length} 个装备名`);
console.log('done');
