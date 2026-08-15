/**
 * 合并 userjson 套路进 data/champions.tsv：
 * 1. 系统数据瘦身：每个英雄只保留 1 条胜率最高的常规套路（其余删除）
 * 2. 追加 userjson 的 515 条套路（同名英雄与系统常规套路并存，套路名冲突时 userjson 优先）
 * 用法：node --experimental-strip-types collect/scripts/userjson-merge.mts
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';

const GUIDES_PATH = new URL('../output/champions-guides.json', import.meta.url);
const CHAMPIONS_TSV = new URL('../../data/champions.tsv', import.meta.url);
const USER_DIR = new URL('../../data/userjson/', import.meta.url);

interface Guide {
  champion: string;
  championId: string;
  rank: number;
  tier: string;
  buildName: string;
  buildWinRate: string | null;
  hextech: string[];
  items: string[];
  tips: string[];
  patch: string;
}

// ---------- 1. 系统瘦身：每英雄保留胜率最高的一条 ----------
const guides: Guide[] = JSON.parse(await readFile(GUIDES_PATH, 'utf8'));
const bestByChampion = new Map<string, Guide>();
for (const g of guides) {
  const prev = bestByChampion.get(g.champion);
  const rate = (s: string | null) => (s === null ? -1 : Number(s));
  if (!prev || rate(g.buildWinRate) > rate(prev.buildWinRate)) bestByChampion.set(g.champion, g);
}
console.log(`系统瘦身：475 条 → ${bestByChampion.size} 条（每英雄 1 条）`);

const keepKeys = new Set([...bestByChampion.values()].map((g) => `${g.champion}|${g.buildName}`));

// 现有 champions.tsv 行
const tsvLines = (await readFile(CHAMPIONS_TSV, 'utf8')).split('\n').filter((l) => l.trim() !== '');
const headerIdx = tsvLines.findIndex((l) => l.startsWith('英雄\t'));
const header = tsvLines[headerIdx];
const keptRows = tsvLines.slice(headerIdx + 1).filter((l) => {
  const cells = l.split('\t');
  return keepKeys.has(`${cells[0]}|${cells[1]}`);
});
console.log(`保留系统行：${keptRows.length}`);

// ---------- 2. 读取并追加 userjson ----------
interface UserEntry {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  tips: string[];
  patch: string;
}
const files = (await readdir(USER_DIR)).filter((f) => f.endsWith('.json')).sort();
const userRows: string[] = [];
const skipped: string[] = [];
let tipsFilled = 0;
for (const f of files) {
  const entries: UserEntry[] = JSON.parse(await readFile(new URL(f, USER_DIR), 'utf8'));
  for (const e of entries) {
    const hex = Array.isArray(e.hextech) ? e.hextech.filter((x: string) => x && x.trim()) : [];
    const items = Array.isArray(e.items) ? e.items.filter((x: string) => x && x.trim()) : [];
    let tips = Array.isArray(e.tips) ? e.tips.filter((x: string) => x && x.trim()) : [];
    // 字段不完整：海克斯/装备为空 → 跳过（不编造）
    if (hex.length === 0 || items.length === 0) {
      skipped.push(`${e.champion}|${e.buildName}（hex=${hex.length}, items=${items.length}）`);
      continue;
    }
    // tips 为空 → 填「暂无」（采集规则允许）
    if (tips.length === 0) {
      tips = ['暂无'];
      tipsFilled++;
    }
    userRows.push(
      [e.champion, e.buildName, hex.join('、'), items.join('、'), tips.join('；'), '', e.patch].join('\t'),
    );
  }
}
console.log(`userjson 追加行：${userRows.length}（跳过 ${skipped.length}，空tips填「暂无」${tipsFilled}）`);
if (skipped.length) console.log('跳过（字段不完整）:');
for (const s of skipped) console.log(`  ${s}`);

// ---------- 3. 套路名冲突：userjson 优先，删除系统冲突行 ----------
const userKeys = new Set(userRows.map((l) => { const c = l.split('\t'); return `${c[0]}|${c[1]}`; }));
const finalKept = keptRows.filter((l) => {
  const c = l.split('\t');
  return !userKeys.has(`${c[0]}|${c[1]}`);
});
const dropped = keptRows.length - finalKept.length;
console.log(`套路名冲突删除系统行：${dropped}`);

// ---------- 4. 写回 ----------
const comment = [
  '# ChooseHextech 套路数据（社区用户套路 data/userjson + 每英雄 1 条常规兜底）',
  '# 生成：collect/scripts/userjson-merge.mts，' + new Date().toISOString().slice(0, 10),
  '# 格式：英雄  套路名  海克斯推荐  装备推荐  对局技巧  作者  适用版本',
];
const out = [...comment, header, ...finalKept, ...userRows].join('\n') + '\n';
await writeFile(CHAMPIONS_TSV, out, 'utf8');
console.log(`写入 champions.tsv：${finalKept.length + userRows.length} 行`);
