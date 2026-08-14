/**
 * 合并所有 tips-part*.json 到骨架数据，输出严格符合采集 prompt 格式的最终 JSON。
 * 用法：node --experimental-strip-types collect/scripts/merge-tips.mts
 * 输入：collect/output/champions-guides.json + collect/output/tips-part*.json（自动发现）
 * 输出：collect/output/guides-final.json
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';

const OUT_DIR = new URL('../output/', import.meta.url);
const GUIDES_PATH = new URL('champions-guides.json', OUT_DIR);
const OUT_PATH = new URL('guides-final.json', OUT_DIR);

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
interface TipsEntry {
  champion: string;
  buildName: string;
  tips: string[];
}

const guides: Guide[] = JSON.parse(await readFile(GUIDES_PATH, 'utf8'));
const tipFiles = (await readdir(OUT_DIR)).filter((n) => /^tips-part.*\.json$/.test(n)).sort();
console.log('tips files:', tipFiles);

const tipsMap = new Map<string, string[]>();
for (const f of tipFiles) {
  const entries: TipsEntry[] = JSON.parse(await readFile(new URL(f, OUT_DIR), 'utf8'));
  for (const t of entries) {
    const key = `${t.champion}|${t.buildName}`;
    if (!tipsMap.has(key)) tipsMap.set(key, t.tips);
  }
}

let filled = 0;
const missing: string[] = [];
const final = guides.map((g) => {
  const tips = tipsMap.get(`${g.champion}|${g.buildName}`);
  if (tips && tips.length) filled++;
  else missing.push(`${g.champion}|${g.buildName}`);
  return {
    champion: g.champion,
    buildName: g.buildName,
    hextech: g.hextech,
    items: g.items,
    tips: tips ?? [],
    patch: g.patch,
  };
});

await writeFile(OUT_PATH, JSON.stringify(final, null, 2), 'utf8');
console.log(`merged: ${final.length} builds, ${filled} with tips, ${missing.length} missing`);
if (missing.length) console.log('missing:', missing.join(' ; '));
console.log(`saved ${OUT_PATH.pathname}`);
