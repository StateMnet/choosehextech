/** 源数据表列定义（与 data/champions.tsv 表头一致） */
export const TSV_COLUMNS = ['英雄', '套路名', '海克斯推荐', '装备推荐', '对局技巧', '作者', '适用版本'] as const;

/** 必需列：作者列可选，其余必填 */
export const REQUIRED_COLUMNS: readonly string[] = ['英雄', '套路名', '海克斯推荐', '装备推荐', '对局技巧', '适用版本'];

/** 海克斯推荐 / 装备推荐列表分隔符 */
export const LIST_SEPARATOR = '、';

/** 对局技巧多条分隔符 */
export const TIP_SEPARATOR = '；';

/** 单条技巧最大字数 */
export const MAX_TIP_LENGTH = 60;

/** 游戏版本格式，如 25.24 */
export const PATCH_PATTERN = /^\d{2}\.\d{1,2}$/;

/** 数据包对应模式 */
export const DATA_MODE = 'hextech-aram';
