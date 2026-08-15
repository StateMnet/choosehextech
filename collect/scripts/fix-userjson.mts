/**
 * 按用户指示修正 data/userjson/*.json：
 * 1. 英雄名映射（阿罗拉→阿萝拉 等 6 处）
 * 2. 误放 hextech 的装备（15 个 + 残废）移到 items
 * 3. items 改名：暗炎火炬→黯炎火炬、残废→残疫、阿塔玛的审判→阿塔玛的清算
 * 4. 狂热者从 items 移到 hextech
 * 用法：node --experimental-strip-types collect/scripts/fix-userjson.mts
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';

const USER_DIR = new URL('../../data/userjson/', import.meta.url);

const championFix: Record<string, string> = {
  阿罗拉: '阿萝拉',
  塔莉娅: '塔莉垭',
  翠神: '艾翁',
  烈娜塔: '烈娜塔 · 戈拉斯克',
  异画师: '彗',
  洛昌: '洛克',
};

/** 被误放进 hextech 字段的装备（应移到 items） */
const HEX_TO_ITEMS = new Set([
  '公理圆弧', '鬼索的狂暴之刃', '海克斯科技枪刃', '荆棘之甲', '救赎',
  '狂妄', '猎魔人弩箭', '凛冬之临', '三相之力', '收集者',
  '朔极之矛', '巫妖之祸', '无尽之刃', '无终恨意', '心之钢', '残废',
]);

const itemRenames: Record<string, string> = {
  暗炎火炬: '黯炎火炬',
  残废: '残疫',
  阿塔玛的审判: '阿塔玛的清算',
};

/** 误放进 items 字段的强化（应移到 hextech） */
const ITEMS_TO_HEX = new Set(['狂热者']);

const files = (await readdir(USER_DIR)).filter((f) => f.endsWith('.json')).sort();
let entryCount = 0;
let championFixed = 0;
let hexMoved = 0;
let itemMoved = 0;
let renamed = 0;

for (const f of files) {
  const path = new URL(f, USER_DIR);
  const entries: any[] = JSON.parse(await readFile(path, 'utf8'));
  for (const e of entries) {
    entryCount++;
    if (championFix[e.champion]) {
      e.champion = championFix[e.champion];
      championFixed++;
    }
    const hex = Array.isArray(e.hextech) ? e.hextech : [];
    const items = Array.isArray(e.items) ? e.items : [];

    // 1) hextech 中的装备（含残废）移到 items
    const movedFromHex = hex.filter((h: string) => HEX_TO_ITEMS.has(h));
    const keptHex = hex.filter((h: string) => !HEX_TO_ITEMS.has(h));
    hexMoved += movedFromHex.length;

    // 2) items 改名
    const renamedItems = items.map((it: string) => {
      if (itemRenames[it]) { renamed++; return itemRenames[it]; }
      return it;
    });

    // 3) items 中的狂热者移到 hextech
    const keptItems = renamedItems.filter((it: string) => !ITEMS_TO_HEX.has(it));
    const movedToHex = renamedItems.filter((it: string) => ITEMS_TO_HEX.has(it));
    itemMoved += movedToHex.length;

    // 4) 合并去重
    const allItems = [...keptItems, ...movedFromHex.map((h: string) => itemRenames[h] ?? h)];
    e.hextech = [...keptHex, ...movedToHex.filter((h: string) => !keptHex.includes(h))];
    e.items = [...new Set(allItems)];
  }
  await writeFile(path, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`fixed ${f}`);
}

console.log(`\nentries=${entryCount} championFixed=${championFixed} hexMoved=${hexMoved} itemMoved=${itemMoved} renamed=${renamed}`);
