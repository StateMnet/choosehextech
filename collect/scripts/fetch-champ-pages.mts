/**
 * 批量抓取前 N 个热门英雄的 ARAMGG 详情页。
 * 用法：node --experimental-strip-types collect/scripts/fetch-champ-pages.mts [N=20]
 * 输出：collect/output/raw/champ-{id}.html
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const RANK_PATH = new URL('../output/home-ranking.json', import.meta.url);
const RAW_DIR = new URL('../output/raw/', import.meta.url);
const N = Number(process.argv[2] ?? 0) || Infinity; // 默认抓全部（已存在的跳过）

interface Row {
  rank: number;
  championId: string;
  championName: string;
  tier: string;
}

const rows: Row[] = JSON.parse(await readFile(RANK_PATH, 'utf8'));
await mkdir(RAW_DIR, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function exists(path: URL): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let ok = 0;
let fail = 0;
let skipped = 0;
for (const row of rows.slice(0, N)) {
  const out = new URL(`champ-${row.championId}.html`, RAW_DIR);
  if (await exists(out)) {
    skipped++;
    continue;
  }
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const res = await fetch(`https://aramgg.com/zh-CN/champion-stats/${row.championId}`, {
        headers: { 'User-Agent': 'choosehextech-collector/0.1' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(out, await res.text(), 'utf8');
      console.log(`[${row.rank}] ${row.championName} (${row.championId}) ok`);
      ok++;
      done = true;
    } catch (e) {
      console.log(`[${row.rank}] ${row.championName} attempt ${attempt} failed: ${(e as Error).message}`);
      await sleep(1500 * attempt);
    }
  }
  if (!done) fail++;
  await sleep(400);
}

console.log(`done: ok=${ok} fail=${fail} skipped=${skipped}`);
