/**
 * 生成「装备名 → 图标直链」映射并验证每个 URL 可访问。
 * 装备清单：CDragon 官方 items.json（国服中文译名，inStore=true 过滤商店可购装备）
 * URL 候选（按优先级，取第一个验证通过的）：
 *   1. 腾讯官方素材：https://game.gtimg.cn/images/lol/act/img/item/{id}.png
 *   2. 腾讯官方素材（旧版路径）：https://game.gtimg.cn/images/lol/act/a20201118icon/item/{id}.png
 *   3. Riot 官方 Data Dragon：https://ddragon.leagueoflegends.com/cdn/{ver}/img/item/{id}.png
 * 用法：node --experimental-strip-types collect/scripts/gen-item-icons.mts
 * 输出：collect/output/item-icons.csv（有效行）+ 控制台打印未找到名单
 */

import { readFile, writeFile } from 'node:fs/promises';

const ITEMS_PATH = new URL('../output/raw/items-zh.json', import.meta.url);
const VERSIONS_PATH = new URL('../output/raw/ddragon-versions.json', import.meta.url);
const OUT_PATH = new URL('../output/item-icons.csv', import.meta.url);

interface ItemEntry {
  id: number;
  name: string;
  inStore?: boolean;
  displayInItemSets?: boolean;
  description: string;
}

const items: ItemEntry[] = JSON.parse(await readFile(ITEMS_PATH, 'utf8'));
const versions: string[] = JSON.parse(await readFile(VERSIONS_PATH, 'utf8'));
const ddragonVer = versions[0] ?? '16.16.1';

// 过滤：商店可购 + 可出现在装备组 + 基础 id（排除 22/44/66/77/80 前缀的变体与占位）
// 同名去重：保留最小基础 id（如 3153 而非 223153）
const candidatesByName = new Map<string, ItemEntry>();
for (const it of items) {
  if (it.inStore !== true || it.displayInItemSets !== true) continue;
  if (it.id < 1000 || it.id >= 10000) continue;
  const prev = candidatesByName.get(it.name);
  if (!prev || it.id < prev.id) candidatesByName.set(it.name, it);
}
const storeItems = [...candidatesByName.values()].sort((a, b) => a.id - b.id);
console.log(`items total=${items.length}, filtered unique=${storeItems.length}`);

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (choosehextech-collector)' },
    });
    if (res.ok) return true;
  } catch {
    /* fallthrough */
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (choosehextech-collector)' },
    });
    if (res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}

function candidates(id: number): string[] {
  return [
    `https://game.gtimg.cn/images/lol/act/img/item/${id}.png`,
    `https://game.gtimg.cn/images/lol/act/a20201118icon/item/${id}.png`,
    `https://ddragon.leagueoflegends.com/cdn/${ddragonVer}/img/item/${id}.png`,
  ];
}

interface Row {
  name: string;
  url: string;
  source: string;
  ok: boolean;
}

const results: Row[] = [];
const queue = [...storeItems];
const workers = Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const item = queue.shift()!;
    let picked: { url: string; source: string } | null = null;
    for (const url of candidates(item.id)) {
      if (await checkUrl(url)) {
        picked = { url, source: url.includes('gtimg.cn') ? '腾讯' : 'ddragon' };
        break;
      }
    }
    results.push({ name: item.name, url: picked?.url ?? '', source: picked?.source ?? '', ok: !!picked });
    if (!picked) console.log(`  [MISS] ${item.id} ${item.name}`);
  }
});
await Promise.all(workers);

results.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
const okRows = results.filter((r) => r.ok);
const missRows = results.filter((r) => !r.ok);

const lines = ['装备名,图标URL', ...okRows.map((r) => `${r.name},${r.url}`)];
await writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');

const srcStat: Record<string, number> = {};
for (const r of okRows) srcStat[r.source] = (srcStat[r.source] ?? 0) + 1;
console.log(`\nok=${okRows.length} miss=${missRows.length} sources=${JSON.stringify(srcStat)}`);
console.log(`saved ${OUT_PATH.pathname}`);
