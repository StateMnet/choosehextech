/**
 * 生成海克斯强化清单核对文档（markdown）。
 * 用法：node --experimental-strip-types collect/scripts/gen-checklist.mts
 * 输出：collect/output/hextech-augments-checklist.md
 */

import { readFile, writeFile } from 'node:fs/promises';

const SRC = new URL('../output/augments-aramgg.json', import.meta.url);
const OUT = new URL('../output/hextech-augments-checklist.md', import.meta.url);

const augments: {
  id: string;
  icon: string;
  name: string;
  rarity: string;
  description: string;
  champions: { id: string; name: string }[];
}[] = JSON.parse(await readFile(SRC, 'utf8'));

const order = ['棱彩', '黄金', '白银'];
const lines: string[] = [];
lines.push('# 海克斯大乱斗 海克斯强化清单（核对用）');
lines.push('');
lines.push(`- 数据来源：ARAMGG（aramgg.com，抓取时间 ${new Date().toISOString().slice(0, 10)}）`);
lines.push(`- 共 ${augments.length} 个强化：${order.map((r) => `${r} ${augments.filter((a) => a.rarity === r).length}`).join('、')}`);
lines.push('- 核对要点：名称是否与国服客户端一致；是否有缺失/多余；稀有度是否正确。');
lines.push('');

for (const r of order) {
  const list = augments.filter((a) => a.rarity === r);
  lines.push(`## ${r}（${list.length}）`);
  lines.push('');
  lines.push('| # | 名称 | 图标 | 描述摘要 |');
  lines.push('| --- | --- | --- | --- |');
  for (const a of list) {
    const desc = a.description.replace(/\|/g, '／').slice(0, 60);
    lines.push(`| ${a.id} | ${a.name} | ${a.icon} | ${desc} |`);
  }
  lines.push('');
}

lines.push('## 与官方数据差异说明');
lines.push('');
lines.push('CommunityDragon 官方 augment-lists.json 含 266 个强化路径（3 个池：44 / 220 / 188），');
lines.push('本清单（ARAMGG）为 205 个。差异项可能为：未上线/已禁用/占位强化，需人工确认。');
lines.push('官方路径清单见 collect/output/raw/augment-lists.json。');
lines.push('');

await writeFile(OUT, lines.join('\n'), 'utf8');
console.log(`saved ${OUT.pathname} (${lines.length} lines)`);
