import { LIST_SEPARATOR, TIP_SEPARATOR } from './constants.ts';
import type { RawBuildRow } from './types.ts';

// 外部模型输出的灵活字段结构：支持 champion/nameZh、buildName/build、数组或顿号/分号分隔字符串
interface ImportEntryLike {
  champion?: unknown;
  nameZh?: unknown;
  buildName?: unknown;
  build?: unknown;
  name?: unknown;
  hextech?: unknown;
  items?: unknown;
  tips?: unknown;
  author?: unknown;
  patch?: unknown;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') return String(value);
  return null;
}

function asList(value: unknown, separator: string): string[] | null {
  if (Array.isArray(value)) {
    const list = value.map((v) => asString(v)).filter((v): v is string => v !== null);
    return list.length > 0 ? list : null;
  }
  const text = asString(value);
  if (text === null) return null;
  const list = text.split(separator).map((part) => part.trim()).filter((part) => part.length > 0);
  return list.length > 0 ? list : null;
}

/** 把外部模型输出的条目归一为源数据行；字段缺失无法归一返回 null */
export function normalizeImportedEntry(raw: unknown): RawBuildRow | null {
  if (raw === null || typeof raw !== 'object') return null;
  const entry = raw as ImportEntryLike;
  const champion = asString(entry.champion) ?? asString(entry.nameZh);
  const buildName = asString(entry.buildName) ?? asString(entry.build) ?? asString(entry.name);
  const hextech = asList(entry.hextech, LIST_SEPARATOR);
  const items = asList(entry.items, LIST_SEPARATOR);
  const tips = asList(entry.tips, TIP_SEPARATOR);
  const patch = asString(entry.patch) ?? '';
  if (!champion || !buildName || !hextech || !items || !tips) return null;
  return {
    champion,
    buildName,
    hextech,
    items,
    tips,
    author: asString(entry.author) ?? undefined,
    patch,
  };
}

/** 合并导入：导入的英雄按组整体替换（该英雄原有套路行全部移除），其余英雄保持不变 */
export function mergeRows(existing: RawBuildRow[], imported: RawBuildRow[]): RawBuildRow[] {
  const importedChampions = new Set(imported.map((row) => row.champion));
  const kept = existing.filter((row) => !importedChampions.has(row.champion));
  return [...kept, ...imported];
}
