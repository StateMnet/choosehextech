import type { Build, ChampionEntry, DataBundle, RawBuildRow } from './types.ts';

export interface BundleMeta {
  dataVersion: string;
  gamePatch: string;
  mode: 'hextech-aram';
  aliases: Map<string, string>;
  /** 可选：championId → LCU 数字 ID 映射 */
  championIds?: Map<string, string>;
}

/** 把校验通过的数据行按英雄聚合为版本化数据包（保持数据文件中的英雄出现顺序） */
export function buildBundle(rows: RawBuildRow[], meta: BundleMeta): DataBundle {
  const byChampion = new Map<string, { nameZh: string; builds: Build[] }>();

  for (const row of rows) {
    const championId = meta.aliases.get(row.champion);
    if (!championId) throw new Error('英雄「' + row.champion + '」缺少别名映射');
    let entry = byChampion.get(championId);
    if (!entry) {
      entry = { nameZh: row.champion, builds: [] };
      byChampion.set(championId, entry);
    }
    entry.builds.push({
      name: row.buildName,
      hextech: row.hextech,
      items: row.items,
      tips: row.tips,
      author: row.author,
      updatedPatch: row.patch,
    });
  }

  const champions: ChampionEntry[] = [...byChampion.entries()].map(([championId, entry]) => {
    const rawNumericId = meta.championIds?.get(championId);
    const numericId = rawNumericId !== undefined ? Number(rawNumericId) : undefined;
    return {
      championId,
      nameZh: entry.nameZh,
      numericId: numericId !== undefined && Number.isFinite(numericId) ? numericId : undefined,
      builds: entry.builds,
    };
  });

  return {
    schemaVersion: 1,
    dataVersion: meta.dataVersion,
    gamePatch: meta.gamePatch,
    mode: meta.mode,
    champions,
  };
}
