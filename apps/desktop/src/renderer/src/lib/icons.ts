/** 名字 → 图标查表键（trim 归一） */
export function augmentIconKey(name: string): string {
  return name.trim();
}

/** 确定性字符串哈希（同名必然同哈希） */
export function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 调色板：背景/前景成对 */
const PALETTE: [string, string][] = [
  ['#3a2d14', '#f0c24b'],
  ['#143a2d', '#4bd0a1'],
  ['#14283a', '#4ba8f0'],
  ['#3a1428', '#e86aa8'],
  ['#2d143a', '#a86ae8'],
  ['#143a3a', '#4bd0d0'],
  ['#3a3414', '#d0c24b'],
  ['#3a1414', '#e86a6a'],
  ['#1e3a14', '#8ad04b'],
  ['#14143a', '#6a6ae8'],
  ['#3a1e14', '#e8964b'],
  ['#24143a', '#b04be8'],
];

/** 通用确定性占位图：六边形 + 文字，按 keyText 哈希取色（同名同图） */
export function hexPlaceholderIcon(label: string, keyText: string): string {
  const [bg, fg] = PALETTE[hashString(keyText) % PALETTE.length];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="' + bg + '" stroke="' + fg + '" stroke-width="1.6"/>' +
    '<text x="16" y="20.5" font-size="13" text-anchor="middle" fill="' + fg + '" font-family="Microsoft YaHei, sans-serif">' + label + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/** 海克斯强化占位图：名字首字 + 名字哈希色，同名同图 */
export function augmentPlaceholderIcon(name: string): string {
  return hexPlaceholderIcon(Array.from(name)[0] ?? '海', augmentIconKey(name));
}

/** 英雄占位图：译名首字 + 译名哈希色 */
export function championPlaceholderIcon(nameZh: string): string {
  return hexPlaceholderIcon(Array.from(nameZh)[0] ?? '英', nameZh.trim());
}

/** LCU 别名与 Data Dragon ID 不一致的英雄（仅影响图标取图） */
const DDRAGON_ID_OVERRIDES: Record<string, string> = {
  Wukong: 'MonkeyKing',
};

/** 英雄头像（Data Dragon 最新版，运行时加载，不落盘） */
export function championIconUrl(championId: string): string {
  const ddId = DDRAGON_ID_OVERRIDES[championId] ?? championId;
  return 'https://ddragon.leagueoflegends.com/cdn/img/champion/' + encodeURIComponent(ddId) + '.png';
}

/**
 * 英雄头像解析：映射表（爬取的国服头像 URL）命中 → 用该 URL；
 * 未命中 → Data Dragon 头像。加载失败由调用方回退占位图。
 */
export function resolveChampionIcon(nameZh: string, championId: string, championIcons?: Record<string, string>): string {
  const url = championIcons?.[nameZh.trim()];
  if (url) return url;
  return championIconUrl(championId);
}

/**
 * 海克斯图标解析：映射表命中 → 图标 URL（爬取直链）；未命中 → 确定性占位图。
 * 同名强化必然解析到同一张图。
 */
export function resolveAugmentIcon(name: string, augmentIcons?: Record<string, string>): string {
  const url = augmentIcons?.[augmentIconKey(name)];
  if (url) return url;
  return augmentPlaceholderIcon(name);
}

/** 装备占位图：名字首字 + 名字哈希色 */
export function itemPlaceholderIcon(name: string): string {
  return hexPlaceholderIcon(Array.from(name)[0] ?? '装', name.trim());
}

/** 装备图标解析：映射表命中 → 图标 URL；未命中 → 确定性占位图 */
export function resolveItemIcon(name: string, itemIcons?: Record<string, string>): string {
  const url = itemIcons?.[name.trim()];
  if (url) return url;
  return itemPlaceholderIcon(name);
}
