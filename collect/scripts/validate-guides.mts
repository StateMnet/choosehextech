/**
 * 校验 guides-final.json 是否符合采集 prompt 的硬性规则。
 * 用法：node --experimental-strip-types collect/scripts/validate-guides.mts
 *
 * 校验项：
 * 1. champion ∈ 国服译名清单（data/generated/aliases.csv）
 * 2. hextech 每个名称 ∈ ARAMGG 强化清单，且数量 8~10
 * 3. items 每个名称 ∈ 官方装备译名（CDragon items.json），且数量 6~8
 * 4. tips ≥1 条，每条 ≤60 字
 * 5. patch 匹配 ^\d{2}\.\d{2}$
 */

import { readFile } from 'node:fs/promises';

const GUIDES_PATH = new URL('../output/guides-final.json', import.meta.url);
const AUGMENTS_PATH = new URL('../output/augments-aramgg.json', import.meta.url);
const ITEMS_PATH = new URL('../output/raw/items-zh.json', import.meta.url);
const ALIASES_PATH = new URL('../../data/generated/aliases.csv', import.meta.url);

interface Guide {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  tips: string[];
  patch: string;
}

const guides: Guide[] = JSON.parse(await readFile(GUIDES_PATH, 'utf8'));
const augments: { name: string }[] = JSON.parse(await readFile(AUGMENTS_PATH, 'utf8'));
const items: { name: string }[] = JSON.parse(await readFile(ITEMS_PATH, 'utf8'));
const aliasesCsv = await readFile(ALIASES_PATH, 'utf8');

const augmentNames = new Set(augments.map((a) => a.name));
const itemNames = new Set(items.map((i) => i.name));
const championNames = new Set(
  aliasesCsv
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',')[0].trim()),
);
// aliases.csv 缺失的官方名白名单（LCU 生成遗漏）
championNames.add('费德提克');

const errors: string[] = [];
const warnings: string[] = [];

for (const g of guides) {
  const tag = `${g.champion} | ${g.buildName}`;

  if (!championNames.has(g.champion)) warnings.push(`${tag}: 英雄名不在 aliases.csv（可能为新英雄）: ${g.champion}`);

  if (g.hextech.length < 8 || g.hextech.length > 10)
    errors.push(`${tag}: hextech 数量 ${g.hextech.length}（要求 8~10）`);
  for (const h of g.hextech)
    if (!augmentNames.has(h)) errors.push(`${tag}: 强化名不在清单: ${h}`);

  if (g.items.length < 6 || g.items.length > 8)
    errors.push(`${tag}: items 数量 ${g.items.length}（要求 6~8）`);
  for (const it of g.items) if (!itemNames.has(it)) errors.push(`${tag}: 装备名不在官方译名: ${it}`);

  if (g.tips.length < 1) errors.push(`${tag}: tips 为空`);
  for (const t of g.tips) {
    if (t.length > 60) errors.push(`${tag}: tips 超 60 字 (${t.length}): ${t}`);
    if (t === '暂无' || t.trim() === '') continue;
  }

  if (!/^\d{2}\.\d{2}$/.test(g.patch)) errors.push(`${tag}: patch 格式错误: ${g.patch}`);
}

// 重复套路检查：同一英雄 buildName 不得重复
const seen = new Set<string>();
for (const g of guides) {
  const key = `${g.champion}|${g.buildName}`;
  if (seen.has(key)) errors.push(`重复套路: ${key}`);
  seen.add(key);
}

console.log(`guides: ${guides.length} | champions: ${new Set(guides.map((g) => g.champion)).size}`);
console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 40)) console.log(`  [E] ${e}`);
console.log(`warnings: ${warnings.length}`);
for (const w of warnings) console.log(`  [W] ${w}`);
if (errors.length) process.exit(1);
console.log('VALIDATION PASSED');
