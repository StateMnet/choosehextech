/**
 * 生成最终攻略数据骨架（collect/output/champions-guides.json）。
 * 机械转换部分：
 * - champion：去掉称号，取国服官方英雄名（空格分割取最后一段）
 * - buildName：由流派标签（tags）映射为中文玩法名
 * - hextech：每英雄取胜率最高的前 8 个强化（ARAMGG 按胜率排序）
 * - items：出门装 + 核心三件套 + 情境装备，去重后按出装顺序取 6-8 件
 * - tips：留空数组，由后续步骤（LLM）填充
 * - patch：26.16
 * 用法：node --experimental-strip-types collect/scripts/gen-guides.mts
 */

import { readFile, writeFile } from 'node:fs/promises';

const PAGES_PATH = new URL('../output/champ-pages.json', import.meta.url);
const RANK_PATH = new URL('../output/home-ranking.json', import.meta.url);
const OUT_PATH = new URL('../output/champions-guides.json', import.meta.url);
const IDS_PATH = new URL('../../data/generated/champion-ids.csv', import.meta.url);
const ALIASES_PATH = new URL('../../data/generated/aliases.csv', import.meta.url);

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
interface RankRow {
  rank: number;
  championId: string;
  championName: string;
  tier: string;
}

const pages: ChampPage[] = JSON.parse(await readFile(PAGES_PATH, 'utf8'));
const ranks: RankRow[] = JSON.parse(await readFile(RANK_PATH, 'utf8'));
const rankById = new Map(ranks.map((r) => [r.championId, r]));

// 权威国服译名映射：数字ID → 国服译名（champion-ids.csv join aliases.csv）
const idsCsv = await readFile(IDS_PATH, 'utf8');
const aliasesCsv = await readFile(ALIASES_PATH, 'utf8');
const enToNumeric = new Map(
  idsCsv
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',') as [string, string]),
);
const zhByEnglish = new Map(
  aliasesCsv
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',') as [string, string])
    .map(([zh, en]) => [en, zh] as [string, string]),
);
const zhByNumeric = new Map<string, string>();
for (const [en, numeric] of enToNumeric) {
  const zh = zhByEnglish.get(en);
  if (zh) zhByNumeric.set(numeric, zh);
}

function officialName(championId: string, aramggName: string): string {
  const zh = zhByNumeric.get(championId);
  if (zh) return zh;
  // 兜底：ARAMGG「称号 名字」格式，去空格取最后一段
  return aramggName.includes(' ') ? aramggName.split(' ').slice(-1)[0] : aramggName;
}

// 流派标签 → 中文玩法名
function buildNameOf(tags: string[]): string {
  const t = tags
    .map((x) => x.trim().replace(/&amp;/g, '&'))
    .filter((x) => x && x !== 'Uncategorized');
  const map: Record<string, string> = {
    AD: '物理',
    AP: '法术',
    Crit: '暴击',
    'On-Hit': '攻速特效',
    Lethality: '穿甲',
    Bruiser: '半肉',
    Tank: '坦克',
    Hybrid: '双修',
    'Heal & Shield': '治疗护盾',
  };
  const zh = t.map((x) => map[x] ?? x);
  if (zh.length === 0) return '通用流';
  if (zh.length === 1) return `${zh[0]}流`;
  if (zh.length === 2) {
    const [a, b] = zh;
    // 常见组合特判
    if (a === '物理' && b === '攻速特效') return '攻速特效流';
    if (a === '物理' && b === '暴击') return '暴击流';
    if (a === '物理' && b === '穿甲') return '穿甲流';
    if (a === '法术' && b === '半肉') return '半肉法坦流';
    if (a === '半肉' && b === '坦克') return '半肉坦克流';
    if (a === '双修' && b === '攻速特效') return '双修攻速流';
    if (a === '物理' && b === '半肉') return '战士半肉流';
    return `${a}${b}流`;
  }
  // 3 个标签
  if (zh.includes('暴击') && zh.includes('攻速特效')) return '暴击攻速流';
  if (zh.includes('暴击') && zh.includes('穿甲')) return '暴击穿甲流';
  if (zh.includes('穿甲') && zh.includes('半肉')) return '战士穿甲流';
  return `${zh.join('')}流`;
}

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

const PATCH = '26.16';
const guides: Guide[] = [];

for (const page of pages) {
  const rank = rankById.get(page.championId);
  // 官方英雄名：数字ID → 权威译名表，兜底清洗
  const champion = officialName(page.championId, page.championName);

  // hextech：胜率 top8
  const hextech = page.augmentsTop.slice(0, 8).map((a) => a.name);

  for (const cfg of page.buildConfigs) {
    const core = cfg.coreBuilds[0]?.items ?? [];
    const starter = cfg.starters[0] ?? [];
    // 出装顺序：出门装 → 核心三件 → 情境补位；去重（名称以官方 items.json 译名为准，无需改写）
    const seen = new Set<string>();
    const items: string[] = [];
    for (const it of [...starter, ...core, ...cfg.situational]) {
      const name = it.name;
      if (seen.has(name)) continue;
      seen.add(name);
      items.push(name);
      if (items.length >= 8) break;
    }
    guides.push({
      champion,
      championId: page.championId,
      rank: rank?.rank ?? 0,
      tier: rank?.tier ?? '',
      buildName: buildNameOf(cfg.tags),
      buildWinRate: cfg.winRate,
      hextech,
      items,
      tips: [], // LLM 后续填充
      patch: PATCH,
    });
  }
}

guides.sort((a, b) => a.rank - b.rank || a.championId.localeCompare(b.championId));
await writeFile(OUT_PATH, JSON.stringify(guides, null, 2), 'utf8');
console.log(`guides generated: ${guides.length} (${new Set(guides.map((g) => g.champion)).size} champions)`);
for (const g of guides) {
  console.log(
    `[${g.rank}] ${g.champion} | ${g.buildName} (${g.buildWinRate ?? '-'}%) | 强化x${g.hextech.length} 装备x${g.items.length}`,
  );
}
console.log(`saved ${OUT_PATH.pathname}`);
