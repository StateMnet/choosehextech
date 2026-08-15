/**
 * 对比 data/userjson/*.json 中的海克斯/装备名称与系统 meta 表（data/meta/hextech.tsv, items.tsv）的差异。
 * 只读分析，不修改任何文件。
 * 用法：node --experimental-strip-types collect/scripts/check-userjson.mts
 */

import { readFile, readdir } from 'node:fs/promises';

const USER_DIR = new URL('../../data/userjson/', import.meta.url);
const HEX_TSV = new URL('../../data/meta/hextech.tsv', import.meta.url);
const ITEMS_TSV = new URL('../../data/meta/items.tsv', import.meta.url);

function loadNameSet(text: string): Set<string> {
  return new Set(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.includes('海克斯强化') && !l.includes('装备名')),
  );
}

const sysHex = loadNameSet(await readFile(HEX_TSV, 'utf8'));
const sysItems = loadNameSet(await readFile(ITEMS_TSV, 'utf8'));

const files = (await readdir(USER_DIR)).filter((f) => f.endsWith('.json')).sort();
console.log(`userjson 文件：${files.length} 个`);

interface Entry {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  patch?: string;
}

const allHex = new Set<string>();
const allItems = new Set<string>();
const allChampions = new Set<string>();
let entryCount = 0;
const hexByEntry = new Map<string, string[]>(); // key: champion|buildName
const itemsByEntry = new Map<string, string[]>();

for (const f of files) {
  const entries: Entry[] = JSON.parse(await readFile(new URL(f, USER_DIR), 'utf8'));
  for (const e of entries) {
    entryCount++;
    allChampions.add(e.champion);
    const key = `${e.champion}|${e.buildName}`;
    hexByEntry.set(key, e.hextech ?? []);
    itemsByEntry.set(key, e.items ?? []);
    for (const h of e.hextech ?? []) allHex.add(h);
    for (const it of e.items ?? []) allItems.add(it);
  }
}

console.log(`套路条目：${entryCount}，涉及英雄：${allChampions.size}`);
console.log(`去重强化名：${allHex.size}，去重装备名：${allItems.size}`);
console.log('');

// ---- 强化差异 ----
const newHex = [...allHex].filter((n) => !sysHex.has(n)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
const coveredHex = [...allHex].filter((n) => sysHex.has(n)).sort();
console.log(`【海克斯强化】userjson 共 ${allHex.size} 个：系统已有 ${coveredHex.length} 个，系统缺失 ${newHex.length} 个`);
if (newHex.length) {
  console.log('--- 系统缺失（需要新增到 meta/hextech.tsv）---');
  for (const n of newHex) console.log(`  ${n}`);
}
console.log('');

// ---- 装备差异 ----
const newItems = [...allItems].filter((n) => !sysItems.has(n)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
const coveredItems = [...allItems].filter((n) => sysItems.has(n)).sort();
console.log(`【装备】userjson 共 ${allItems.size} 个：系统已有 ${coveredItems.length} 个，系统缺失 ${newItems.length} 个`);
if (newItems.length) {
  console.log('--- 系统缺失（需要新增到 meta/items.tsv）---');
  for (const n of newItems) console.log(`  ${n}`);
}
console.log('');

// ---- 缺失名称出现的位置 ----
console.log('--- 缺失名称出现在哪些套路 ---');
for (const [key, list] of hexByEntry) {
  const missing = list.filter((n) => !sysHex.has(n));
  if (missing.length) console.log(`  [强化] ${key}: ${[...new Set(missing)].join('、')}`);
}
for (const [key, list] of itemsByEntry) {
  const missing = list.filter((n) => !sysItems.has(n));
  if (missing.length) console.log(`  [装备] ${key}: ${[...new Set(missing)].join('、')}`);
}
console.log('');

// ---- 套路内重复装备（如恶魔法典×6）----
console.log('--- 套路内重复的装备/强化 ---');
for (const [key, list] of itemsByEntry) {
  const dup = [...new Set(list.filter((n, i) => list.indexOf(n) !== i))];
  if (dup.length) console.log(`  [装备重复] ${key}: ${dup.join('、')} x${list.filter((n) => dup.includes(n)).length}`);
}
for (const [key, list] of hexByEntry) {
  const dup = [...new Set(list.filter((n, i) => list.indexOf(n) !== i))];
  if (dup.length) console.log(`  [强化重复] ${key}: ${dup.join('、')}`);
}
