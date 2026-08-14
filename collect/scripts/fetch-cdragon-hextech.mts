/**
 * CommunityDragon 数据采集脚本（海克斯大乱斗）
 * 用法：
 *   node --experimental-strip-types collect/scripts/fetch-cdragon-hextech.mts --probe
 *   node --experimental-strip-types collect/scripts/fetch-cdragon-hextech.mts --parse
 *
 * --probe: 探测 modespecificdata 目录，下载疑似海斗相关的 .bin.json 原始文件到
 *          collect/output/raw/，并打印结构摘要（顶层 keys / 数组长度 / 样本元素）。
 * --parse: 从本地 raw 文件解析出「海克斯强化 id + 国服中文名」清单，写入
 *          collect/output/hextech-augments-zh.json。
 */

const BASE = 'https://raw.communitydragon.org';
const OUT_DIR = new URL('../output/', import.meta.url);
const RAW_DIR = new URL('raw/', OUT_DIR);

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';

// ---------- 工具函数 ----------

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': 'choosehextech-collector/0.1' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return await res.json();
}

async function saveJson(name: string, data: unknown): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  const path = new URL(name, RAW_DIR);
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  saved ${path.pathname}`);
}

function shape(v: unknown, depth = 0): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}]${v.length ? ' of ' + shape(v[0], depth + 1) : ''}`;
  if (typeof v === 'object') {
    const keys = Object.keys(v as object);
    return `{${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', …' : ''}}`;
  }
  return typeof v;
}

function summarize(name: string, data: unknown): void {
  console.log(`\n=== ${name} ===`);
  if (Array.isArray(data)) {
    console.log(`array[${data.length}]`);
    if (data.length > 0) {
      console.log(`  [0] ${JSON.stringify(data[0]).slice(0, 500)}`);
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as object)) {
      const s = shape(v);
      console.log(`  ${k}: ${s}`);
      if (s.startsWith('array[')) {
        const arr = v as unknown[];
        if (arr.length > 0) console.log(`      [0] ${JSON.stringify(arr[0]).slice(0, 600)}`);
      }
    }
  } else {
    console.log(`  ${JSON.stringify(data).slice(0, 300)}`);
  }
}

// ---------- probe ----------

async function probe(): Promise<void> {
  console.log('fetching modespecificdata index …');
  const index = await getJson(`${BASE}/json/latest/game/maps/modespecificdata/`);
  await saveJson('modespecificdata-index.json', index);

  const files: { name: string; size: number }[] = index.filter(
    (f: { type: string }) => f.type === 'file',
  );
  console.log(`total files: ${files.length}`);
  const interesting = files.filter(
    (f) => f.name.endsWith('.bin') && /aram|haram|hex|augment|brawl|ability/i.test(f.name),
  );
  console.log(
    'interesting:',
    interesting.map((f) => `${f.name} (${f.size}B)`),
  );

  for (const f of interesting) {
    if (f.size > 6_000_000) {
      console.log(`\n(skip too large: ${f.name})`);
      continue;
    }
    const data = await getJson(`${BASE}/latest/game/maps/modespecificdata/${f.name}.json`);
    await saveJson(`raw-${f.name.replace(/\.bin$/, '')}.json`, data);
    summarize(f.name, data);
  }
}

// ---------- parse ----------

async function parse(): Promise<void> {
  const names = (await readdir(RAW_DIR)).filter((n) => n.startsWith('raw-') && n.endsWith('.json'));
  console.log('raw files:', names);
  for (const n of names) {
    const data = JSON.parse(await readFile(new URL(n, RAW_DIR), 'utf8'));
    summarize(n, data);
  }
}

// ---------- main ----------

const mode = process.argv[2];
if (mode === '--probe') await probe();
else if (mode === '--parse') await parse();
else {
  console.error('usage: fetch-cdragon-hextech.mts [--probe | --parse]');
  process.exit(1);
}
