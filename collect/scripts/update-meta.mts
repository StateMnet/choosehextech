/**
 * 把新增的强化/装备与图标写入系统 meta 表：
 * - data/meta/hextech.tsv     + 双重打击/虚空冲刺/吸血习性/坚韧
 * - data/meta/items.tsv       + 7 官方装备 + 4 海斗专有装备
 * - data/meta/hextech-icons.csv  + 4 个强化图标
 * - data/meta/item-icons.csv  新建：系统装备图标表（212 已有 + 4 海斗）
 * 用法：node --experimental-strip-types collect/scripts/update-meta.mts
 */

import { readFile, writeFile } from 'node:fs/promises';

const HEX_TSV = new URL('../../data/meta/hextech.tsv', import.meta.url);
const ITEMS_TSV = new URL('../../data/meta/items.tsv', import.meta.url);
const HEX_ICONS = new URL('../../data/meta/hextech-icons.csv', import.meta.url);
const ITEM_ICONS_DST = new URL('../../data/meta/item-icons.csv', import.meta.url);
const ITEM_ICONS_SRC = new URL('../output/item-icons.csv', import.meta.url);

// ---------- 1. hextech.tsv ----------
const newHex = ['双重打击', '虚空冲刺', '吸血习性', '坚韧'];
let hexText = await readFile(HEX_TSV, 'utf8');
const hexLines = hexText.split('\n').filter((l) => l && !l.startsWith('#'));
const hexHeader = hexLines.shift();
const hexSet = new Set(hexLines.map((l) => l.trim()));
for (const n of newHex) hexSet.add(n);
hexText = ['# 海克斯强化名称表（社区采集数据生成，来源 ARAMGG 国服强化清单 + 16.12 新增）', hexHeader!, ...[...hexSet].sort((a, b) => a.localeCompare(b, 'zh-CN'))].join('\n') + '\n';
await writeFile(HEX_TSV, hexText, 'utf8');
console.log(`hextech.tsv: ${hexSet.size} 个（+${newHex.length}）`);

// ---------- 2. items.tsv ----------
const newItems = ['海克斯镜片 C44', '海力亚的回响', '基克的聚合', '命定灰烬', '守护者之刃', '恶魔法典', '湮灭宝珠', '花晓之剑', '毁坏仪式', '阿塔玛的清算', '沃格勒特的巫师帽'];
let itemsText = await readFile(ITEMS_TSV, 'utf8');
const itemLines = itemsText.split('\n').filter((l) => l && !l.startsWith('#'));
const itemsHeader = itemLines.shift();
const itemSet = new Set(itemLines.map((l) => l.trim()));
for (const n of newItems) itemSet.add(n);
itemsText = ['# 装备名称表（社区采集数据生成，来源 ARAMGG 出装数据 + 海斗专有装备，国服译名）', itemsHeader!, ...[...itemSet].sort((a, b) => a.localeCompare(b, 'zh-CN'))].join('\n') + '\n';
await writeFile(ITEMS_TSV, itemsText, 'utf8');
console.log(`items.tsv: ${itemSet.size} 个（+${newItems.length}）`);

// ---------- 3. hextech-icons.csv ----------
const hexIconAdds: [string, string][] = [
  ['双重打击', 'https://raw.communitydragon.org/latest/game/assets/ux/kiwi/augments/icons/adamant_large.png'],
  ['虚空冲刺', 'https://arammayhem.com/augments/Void_Dash_mayhem_augment.webp'],
  ['吸血习性', 'https://arammayhem.com/augments/Vampirism_mayhem_augment.webp'],
  ['坚韧', 'https://arammayhem.com/augments/Perseverance_mayhem_augment.webp'],
];
const hexIconLines = (await readFile(HEX_ICONS, 'utf8')).split('\n').filter((l) => l && !l.startsWith('#'));
const hexIconHeader = hexIconLines.shift();
const hexIconMap = new Map(hexIconLines.map((l) => { const [k, v] = l.split(','); return [k, v]; }));
for (const [k, v] of hexIconAdds) hexIconMap.set(k, v);
const hexIconOut = ['# 海克斯强化名 → 图标 URL（爬取结果直接粘贴；同名强化共用一张图；缺失回退占位图）', hexIconHeader!, ...[...hexIconMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')).map(([k, v]) => `${k},${v}`)].join('\n') + '\n';
await writeFile(HEX_ICONS, hexIconOut, 'utf8');
console.log(`hextech-icons.csv: ${hexIconMap.size} 个（+${hexIconAdds.length}）`);

// ---------- 4. data/meta/item-icons.csv ----------
const srcLines = (await readFile(ITEM_ICONS_SRC, 'utf8')).split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('装备名'));
const itemIconMap = new Map(srcLines.map((l) => { const [k, v] = l.split(','); return [k, v]; }));
const itemIconAdds: [string, string][] = [
  ['花晓之剑', 'https://pub-2322c7068eed43b08bc0dddf6528d1e2.r2.dev/v1/items/icons/sword_of_blossoming_dawn/64.png'],
  ['毁坏仪式', 'https://pub-2322c7068eed43b08bc0dddf6528d1e2.r2.dev/v1/items/icons/rite_of_ruin/64.png'],
  ['阿塔玛的清算', 'https://pub-2322c7068eed43b08bc0dddf6528d1e2.r2.dev/v1/items/icons/atmas_reckoning/64.png'],
  ['沃格勒特的巫师帽', 'https://pub-2322c7068eed43b08bc0dddf6528d1e2.r2.dev/v1/items/icons/wooglets_witchcap/64.png'],
];
for (const [k, v] of itemIconAdds) itemIconMap.set(k, v);
const itemIconOut = [
  '# 装备名 → 图标 URL（国服译名；来源：腾讯官方素材 game.gtimg.cn + ARAM Mayhem 海斗专有装备）',
  '装备名,图标URL',
  ...[...itemIconMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN')).map(([k, v]) => `${k},${v}`),
].join('\n') + '\n';
await writeFile(ITEM_ICONS_DST, itemIconOut, 'utf8');
console.log(`item-icons.csv: ${itemIconMap.size} 个（含 4 海斗新增）`);
console.log('done');
