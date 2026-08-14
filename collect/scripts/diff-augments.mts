/**
 * 对比 ARAMGG 强化清单与 CDragon 官方强化池，输出差异报告。
 * 匹配方式：CDragon 路径尾名（ARAM_UltimateRevolution）与 ARAMGG 图标名
 * （ultimaterevolution）做归一化比较（去 ARAM_ 前缀、大小写不敏感）。
 * 用法：node --experimental-strip-types collect/scripts/diff-augments.mts
 * 输出：collect/output/augments-diff.md
 */

import { readFile, writeFile } from 'node:fs/promises';

const ARAMGG_PATH = new URL('../output/augments-aramgg.json', import.meta.url);
const CDRAGON_PATH = new URL('../output/raw/augment-lists.json', import.meta.url);
const OUT_PATH = new URL('../output/augments-diff.md', import.meta.url);

interface AramggAug {
  id: string;
  icon: string;
  name: string;
  rarity: string;
}
const aramgg: AramggAug[] = JSON.parse(await readFile(ARAMGG_PATH, 'utf8'));
const cdragonLists: { augmentList: string[] }[] = JSON.parse(await readFile(CDRAGON_PATH, 'utf8'));
const cdragonPaths = new Set<string>();
for (const l of cdragonLists) for (const p of l.augmentList) cdragonPaths.add(p);

const norm = (s: string) =>
  s.replace(/_large$/, '').replace(/^ARAM_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cdragonNorm = new Map<string, string>();
for (const p of cdragonPaths) {
  const tail = p.split('/').pop()!;
  cdragonNorm.set(norm(tail), tail);
}

const matched: { icon: string; name: string; cdragon: string }[] = [];
const unmatched: AramggAug[] = [];
for (const a of aramgg) {
  const key = norm(a.icon);
  const hit = cdragonNorm.get(key);
  if (hit) matched.push({ icon: a.icon, name: a.name, cdragon: hit });
  else unmatched.push(a);
}

// CDragon 中未被 ARAMGG 覆盖的（用 tail 名比对）
const covered = new Set(matched.map((m) => m.cdragon));
const cdragonExtra = [...cdragonPaths]
  .filter((p) => !covered.has(p.split('/').pop()!))
  .sort();

const lines: string[] = [];
lines.push('# 强化清单差异报告');
lines.push('');
lines.push(`- ARAMGG：${aramgg.length} 个（有中文名/稀有度/描述）`);
lines.push(`- CDragon 官方池：${cdragonPaths.size} 个路径`);
lines.push(`- 匹配成功：${matched.length}`);
lines.push(`- ARAMGG 有但匹配不到 CDragon：${unmatched.length}`);
lines.push(`- CDragon 有但 ARAMGG 未收录：${cdragonExtra.length}`);
lines.push('');
lines.push('## ARAMGG 有但匹配不到 CDragon 的条目');
lines.push('');
for (const a of unmatched) lines.push(`- ${a.name}（${a.rarity}，图标 ${a.icon}）`);
lines.push('');
lines.push('## CDragon 有但 ARAMGG 未收录的路径（可能未实装/禁用/占位）');
lines.push('');
for (const p of cdragonExtra) lines.push(`- \`${p}\``);
lines.push('');

await writeFile(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`matched=${matched.length} unmatched=${unmatched.length} cdragonExtra=${cdragonExtra.length}`);
console.log(`saved ${OUT_PATH.pathname}`);
