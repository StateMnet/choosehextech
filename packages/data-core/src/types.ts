/** 源数据表（TSV）解析后的一行 */
export interface RawBuildRow {
  champion: string;
  buildName: string;
  hextech: string[];
  items: string[];
  tips: string[];
  author?: string;
  patch: string;
  /** 原始文件行号（诊断用，测试构造时可为空） */
  line?: number;
}

export interface Build {
  name: string;
  hextech: string[];
  items: string[];
  tips: string[];
  author?: string;
  updatedPatch: string;
}

export interface ChampionEntry {
  championId: string;
  nameZh: string;
  /** LCU 使用的数字英雄 ID（来自 data/generated/champion-ids.csv），用于把对局状态映射到数据条目 */
  numericId?: number;
  builds: Build[];
}

export interface DataBundle {
  schemaVersion: 1;
  dataVersion: string;
  gamePatch: string;
  mode: 'hextech-aram';
  /** 可选：海克斯强化名 → 图标文件名（来自 data/meta/hextech-icons.csv，同名共用一张图） */
  augmentIcons?: Record<string, string>;
  /** 可选：英雄译名 → 头像 URL（来自 data/meta/champion-icons.csv，替换默认 Data Dragon 头像） */
  championIcons?: Record<string, string>;
  /** 可选：装备名 → 图标 URL（来自 data/meta/item-icons.csv） */
  itemIcons?: Record<string, string>;
  champions: ChampionEntry[];
}
