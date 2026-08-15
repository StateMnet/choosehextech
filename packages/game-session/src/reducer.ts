import type {
  ChampSelectSessionDto,
  CurrentSummonerDto,
  GameflowPhase,
  GameflowPhaseDto,
  LobbyDto,
  SessionState,
} from './types.ts';

const KNOWN_PHASES: GameflowPhase[] = [
  'None',
  'Lobby',
  'Matchmaking',
  'ReadyCheck',
  'ChampSelect',
  'GameStart',
  'InProgress',
  'WaitingForStats',
  'PreEndOfGame',
  'EndOfGame',
  'Reconnect',
];

export function normalizePhase(raw: string): GameflowPhase {
  if ((KNOWN_PHASES as string[]).includes(raw)) return raw as GameflowPhase;
  return 'Unknown';
}

/**
 * 兼容两种 phase 响应形态：裸字符串（国服实测返回 "Lobby"）与 { phase } 对象（国际服/文档形式）。
 */
export function toPhaseDto(raw: unknown): GameflowPhaseDto {
  if (typeof raw === 'string') return { phase: raw };
  if (raw !== null && typeof raw === 'object' && 'phase' in raw) {
    const phase = (raw as { phase?: unknown }).phase;
    if (typeof phase === 'string') return { phase };
  }
  return { phase: '' };
}

export function createInitialState(): SessionState {
  return {
    phase: 'None',
    queueId: null,
    isTargetMode: true,
    summonerName: null,
    localPlayerCellId: null,
    myChampionId: null,
    teammateChampionIds: [],
    enemyChampionIds: [],
    benchChampionIds: [],
  };
}

/**
 * 应用 gameflow-phase 变化。
 * - 进入新选人阶段：清空己方英雄（等待新的 session 数据）
 * - 回到大厅/客户端关闭：清空选人相关状态
 * - 其余阶段（含 InProgress）：己方英雄保持（粘性）
 */
export function applyPhase(prev: SessionState, dto: GameflowPhaseDto): SessionState {
  const phase = normalizePhase(dto.phase);
  if (phase === prev.phase) return prev;
  const enteringChampSelect = phase === 'ChampSelect' && prev.phase !== 'ChampSelect';
  const backToLobby = phase === 'Lobby' || phase === 'None';
  return {
    ...prev,
    phase,
    myChampionId: enteringChampSelect || backToLobby ? null : prev.myChampionId,
    teammateChampionIds: enteringChampSelect || backToLobby ? [] : prev.teammateChampionIds,
    enemyChampionIds: enteringChampSelect || backToLobby ? [] : prev.enemyChampionIds,
    benchChampionIds: enteringChampSelect ? [] : prev.benchChampionIds,
  };
}

/**
 * 应用 champ-select session 数据。
 * - dto 为 null（选人结束/不可用）：仅清空 cellId 与 bench，英雄保持粘性
 * - 本地玩家 championId > 0：更新己方英雄（覆盖重roll 结果）
 * - championId = 0（未选）：保持上次值
 */
export function applyChampSelect(prev: SessionState, dto: ChampSelectSessionDto | null): SessionState {
  if (!dto) {
    // 离开选人（进入游戏）：保留己方/队友/对手（本局内不变），仅清空 cellId 与备选池
    return { ...prev, localPlayerCellId: null, benchChampionIds: [] };
  }
  const me = dto.myTeam.find((member) => member.cellId === dto.localPlayerCellId);
  const championId = me?.championId ?? 0;
  // 国服字段名为 benchChampions（实测），国际服为 bench
  const bench = dto.bench ?? dto.benchChampions ?? [];
  const positiveIds = (list: { championId: number }[] | undefined): number[] =>
    (list ?? []).map((entry) => entry.championId).filter((id) => id > 0);
  return {
    ...prev,
    localPlayerCellId: dto.localPlayerCellId,
    myChampionId: championId > 0 ? championId : prev.myChampionId,
    teammateChampionIds: positiveIds(dto.myTeam.filter((member) => member.cellId !== dto.localPlayerCellId)),
    enemyChampionIds: positiveIds(dto.theirTeam),
    benchChampionIds: bench.map((entry) => entry.championId),
  };
}

/**
 * 应用 lobby 数据（队列信息）。dto 为 null（不在房间/主界面）时清空队列。
 * queueId 0/null/undefined/字符串统一归一：>0 的数字才视为有效队列，否则 queueId=null（不在房间）；
 * isTargetMode 在房间内按目标队列列表同步重算，换房间/离开房间都会更新；
 * 不在房间时保留原标记（避免主界面误标，进房间后自然重算）。
 */
export function applyLobby(prev: SessionState, lobby: LobbyDto | null, targetQueueIds: number[] | null): SessionState {
  const rawQueueId = lobby?.gameConfig?.queueId;
  const numQueueId = typeof rawQueueId === 'number' ? rawQueueId : Number(rawQueueId);
  const queueId = Number.isFinite(numQueueId) && numQueueId > 0 ? numQueueId : null;
  const isTargetMode =
    queueId === null ? prev.isTargetMode : targetQueueIds === null || targetQueueIds.includes(queueId);
  if (queueId === prev.queueId && isTargetMode === prev.isTargetMode) return prev;
  return { ...prev, queueId, isTargetMode };
}

/** 应用 current-summoner 数据（召唤师名字）。dto 为 null（客户端退出）时清空。 */
export function applySummoner(prev: SessionState, dto: CurrentSummonerDto | null): SessionState {
  const name =
    dto === null
      ? null
      : (dto.displayName?.trim() || dto.gameName?.trim() || dto.internalName?.trim() || dto.name?.trim() || null);
  if (name === prev.summonerName) return prev;
  return { ...prev, summonerName: name };
}

function numberArraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, idx) => id === b[idx]);
}

export function statesEqual(a: SessionState, b: SessionState): boolean {
  return (
    a.phase === b.phase &&
    a.queueId === b.queueId &&
    a.isTargetMode === b.isTargetMode &&
    a.summonerName === b.summonerName &&
    a.localPlayerCellId === b.localPlayerCellId &&
    a.myChampionId === b.myChampionId &&
    numberArraysEqual(a.teammateChampionIds, b.teammateChampionIds) &&
    numberArraysEqual(a.enemyChampionIds, b.enemyChampionIds) &&
    numberArraysEqual(a.benchChampionIds, b.benchChampionIds)
  );
}
