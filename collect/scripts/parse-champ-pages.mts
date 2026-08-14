/**
 * 解析已抓取的英雄详情页（collect/output/raw/champ-{id}.html）。
 * 用法：node --experimental-strip-types collect/scripts/parse-champ-pages.mts
 * 输出：collect/output/champ-pages.json
 *
 * 页面结构：3 个 build tab（data-build-index=N，含流派标签+胜率），
 * 对应 3 个 panel（data-build-panel=N），每 panel 含：
 * - 核心装备（#1/#2/#3 三套，各带胜率/选取率）
 * - 出门装（多组）
 * - 情境装备
 * 另有 JSON-LD ItemList：海克斯推荐 top10。
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';

const RAW_DIR = new URL('../output/raw/', import.meta.url);
const RANK_PATH = new URL('../output/home-ranking.json', import.meta.url);
const OUT_PATH = new URL('../output/champ-pages.json', import.meta.url);

interface Item {
  id: string;
  name: string;
}
interface Build {
  items: Item[];
  winRate: string | null;
  pickRate: string | null;
}
interface BuildConfig {
  index: number;
  tags: string[];
  winRate: string | null;
  coreBuilds: Build[];
  starters: Item[][];
  situational: Item[];
}
interface ChampPage {
  championId: string;
  championName: string;
  augmentsTop: { position: number; id: string; name: string }[];
  buildConfigs: BuildConfig[];
}

const files = (await readdir(RAW_DIR)).filter((n) => /^champ-\d+\.html$/.test(n));
console.log(`champ pages found: ${files.length}`);

// 英雄名以排行榜解析结果为准（详情页 h1 可能是博客式标题，不可靠）
const rankRows: { championId: string; championName: string }[] = JSON.parse(
  await readFile(RANK_PATH, 'utf8'),
);
const nameById = new Map(rankRows.map((r) => [r.championId, r.championName]));

function itemList(block: string): Item[] {
  return [...block.matchAll(/item-icons\/(\d+)\.png" alt="([^"]+)"/g)].map((m) => ({
    id: m[1],
    name: m[2],
  }));
}

const results: ChampPage[] = [];

for (const f of files) {
  const html = await readFile(new URL(f, RAW_DIR), 'utf8');
  const id = f.match(/champ-(\d+)/)![1];

  // <h1> 英雄名（优先用排行榜映射，兜底 h1）
  const h1 = html.match(/<h1[^>]*>([^<]+)</)?.[1] ?? '';
  const name = nameById.get(id) ?? h1;

  // 海克斯推荐 top10（JSON-LD ItemList）
  const augmentsTop = [
    ...html.matchAll(/"position":(\d+),"name":"([^"]+)","url":"https:\/\/aramgg\.com\/zh-CN\/augments\/(\d+)"/g),
  ].map((m) => ({ position: Number(m[1]), name: m[2], id: m[3] }));

  // 按 data-build-content 切分 panel（每个 build 配置一个）
  const buildConfigs: BuildConfig[] = [];
  const contentMarkers = [...html.matchAll(/data-build-content/g)].map((m) => m.index!);
  for (let p = 0; p < contentMarkers.length; p++) {
    const start = contentMarkers[p];
    const end =
      p + 1 < contentMarkers.length ? contentMarkers[p + 1] : Math.min(start + 60000, html.length);
    const panel = html.slice(start, end);

    // tab 标签：优先 data-build-index 按钮；单 tab 页面退化为 card header 的流派 badge
    let tags: string[] = [];
    let winRate: string | null = null;
    const tabBtn = html.match(new RegExp(`data-build-index="${p}"[\\s\\S]*?<\\/button>`));
    if (tabBtn) {
      tags = [...tabBtn[0].matchAll(/text-\[10px\]">([^<]+)<\/span>/g)].map((t) => t[1]);
      winRate = tabBtn[0].match(/text-xs text-muted-foreground">([\d.]+)%</)?.[1] ?? null;
    }
    if (tags.length === 0) {
      const headSeg = html.slice(Math.max(0, start - 3000), start);
      const headBadge = headSeg.match(/text-secondary-foreground">\s*([A-Za-z&; /]+?)\s*<\/span>/);
      if (headBadge) tags = [headBadge[1].trim().replace(/&amp;/g, '&')];
    }

    // 核心装备：按 #N 徽章切块，每块截至第一个"胜率"
    const coreBuilds: Build[] = [];
    const buildBlocks = panel.split(/#\d+\s*<\/span>/).slice(1);
    for (const b of buildBlocks) {
      const winIdx = b.indexOf('胜率');
      const seg = winIdx >= 0 ? b.slice(0, winIdx) : b;
      const items = itemList(seg);
      const win = b.match(/胜率: <span class="font-medium text-card-foreground">([\d.]+)%/)?.[1] ?? null;
      const pick = b.match(/选取率: <span class="font-medium text-card-foreground">([\d.]+)%/)?.[1] ?? null;
      if (items.length) coreBuilds.push({ items, winRate: win, pickRate: pick });
    }

    // 出门装：仅在"出门装"标题之后、"情境装备"或 panel 尾之前
    const stIdx = panel.indexOf('出门装');
    const sitIdx = panel.indexOf('情境装备');
    const stSeg = panel.slice(stIdx >= 0 ? stIdx : 0, sitIdx > stIdx ? sitIdx : undefined);
    const starters: Item[][] = [];
    const starterBlocks = stSeg.split(/<div class="flex items-center gap-3 rounded-lg bg-secondary\/20 p-2">/).slice(1);
    for (const b of starterBlocks) {
      const items = itemList(b);
      if (items.length) starters.push(items);
    }

    // 情境装备
    const sitSeg = sitIdx >= 0 ? panel.slice(sitIdx) : '';
    const situational = itemList(sitSeg);

    buildConfigs.push({ index: p, tags, winRate, coreBuilds, starters, situational });
  }

  results.push({ championId: id, championName: h1, augmentsTop, buildConfigs });

  const sum = buildConfigs.map(
    (bc) =>
      `cfg${bc.index}[${bc.tags.join('/')} ${bc.winRate}%] builds=${bc.coreBuilds.length} st=${bc.starters.length} sit=${bc.situational.length}`,
  );
  console.log(`${f}: ${h1} augTop=${augmentsTop.length} | ${sum.join(' | ')}`);
}

results.sort((a, b) => Number(a.championId) - Number(b.championId));
await writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
console.log(`saved ${OUT_PATH.pathname}`);
