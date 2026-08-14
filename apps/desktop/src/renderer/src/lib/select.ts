import type { ChampionEntry, DataBundle } from '@choosehextech/data-core';
import type { SessionState } from '@choosehextech/game-session';

/** 按 LCU 数字英雄 ID 查找数据条目 */
export function championByNumericId(bundle: DataBundle, numericId: number): ChampionEntry | undefined {
  return bundle.champions.find((champion) => champion.numericId === numericId);
}

/** 按国服译名精确查找 */
export function championByNameZh(bundle: DataBundle, nameZh: string): ChampionEntry | undefined {
  return bundle.champions.find((champion) => champion.nameZh === nameZh);
}

/** 默认选中的套路名（第一个；无套路返回空串） */
export function defaultBuildName(builds: { name: string }[]): string {
  return builds.length > 0 ? builds[0].name : '';
}

export type QuickChampionGroup = 'me' | 'team' | 'bench';

export interface QuickChampion {
  championId: string;
  nameZh: string;
  numericId: number | undefined;
  group: QuickChampionGroup;
}

/**
 * 快捷查看列表（数字 ID 去重，仅数据表覆盖的英雄）：
 * - 选人阶段：己方/队友/备选池；
 * - 游戏内：己方/队友（备选池已无效）；
 * - 不含对手（仍可通过搜索框查询）。其他阶段返回空数组。
 */
export function buildQuickChampionList(bundle: DataBundle, state: SessionState): QuickChampion[] {
  const inSelect = state.phase === 'ChampSelect';
  const inGame = state.phase === 'InProgress';
  if (!inSelect && !inGame) return [];
  const seen = new Set<number>();
  const entries: { id: number; group: QuickChampionGroup }[] = [];
  const push = (id: number | null | undefined, group: QuickChampionGroup) => {
    if (id === null || id === undefined || id <= 0 || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, group });
  };
  push(state.myChampionId, 'me');
  for (const id of state.teammateChampionIds) push(id, 'team');
  if (inSelect) for (const id of state.benchChampionIds) push(id, 'bench');

  const result: QuickChampion[] = [];
  for (const entry of entries) {
    const champion = championByNumericId(bundle, entry.id);
    if (!champion) continue;
    result.push({
      championId: champion.championId,
      nameZh: champion.nameZh,
      numericId: champion.numericId,
      group: entry.group,
    });
  }
  return result;
}

/** 关键词搜索（英雄译名与套路名均参与匹配）；空关键词返回全部英雄 */
export function searchChampions(bundle: DataBundle, query: string): ChampionEntry[] {
  const trimmed = query.trim();
  if (trimmed === '') return bundle.champions;
  return bundle.champions.filter((champion) => {
    if (champion.nameZh.includes(trimmed)) return true;
    return champion.builds.some((build) => build.name.includes(trimmed));
  });
}
