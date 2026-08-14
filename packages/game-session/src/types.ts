export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'Reconnect'
  | 'Unknown';

export interface SessionState {
  phase: GameflowPhase;
  /** 当前队列 ID（来自大厅）；未知为 null */
  queueId: number | null;
  /** 是否为目标队列（海克斯大乱斗）；targetQueueIds 为 null 时恒为 true（开发期全模式） */
  isTargetMode: boolean;
  /** 本地玩家召唤师名字（来自 current-summoner）；未连接/未知为 null */
  summonerName: string | null;
  /** 本地玩家 cellId */
  localPlayerCellId: number | null;
  /** 当前己方英雄（LCU 数字 ID）；0/未知为 null */
  myChampionId: number | null;
  /** 选人阶段队友英雄（数字 ID，不含己方） */
  teammateChampionIds: number[];
  /** 选人阶段对手英雄（数字 ID） */
  enemyChampionIds: number[];
  /** ARAM 备选池（bench）英雄 ID */
  benchChampionIds: number[];
}

export interface GameflowPhaseDto {
  phase: string;
}

export interface ChampSelectTeamMemberDto {
  cellId: number;
  championId: number;
  championPickIntent?: number;
  assignedPosition?: string;
  nameVisibilityType?: string;
  obfuscatedSummonerId?: number;
  puuid?: string;
  spell1Id?: number;
  spell2Id?: number;
  summonerId?: number;
  team?: number;
}

export interface ChampSelectActionDto {
  actorCellId: number;
  championId?: number;
  completed: boolean;
  id?: number;
  isAllyAction?: boolean;
  isInProgress?: boolean;
  type: string;
}

export interface ChampSelectSessionDto {
  actions: ChampSelectActionDto[][];
  myTeam: ChampSelectTeamMemberDto[];
  theirTeam: ChampSelectTeamMemberDto[];
  /** 国际服字段名 */
  bench?: { championId: number }[];
  /** 国服字段名（实测） */
  benchChampions?: { championId: number; isPriority?: boolean }[];
  benchEnabled: boolean;
  localPlayerCellId: number;
  counter?: number;
  timer?: unknown;
}

export interface LobbyDto {
  gameConfig: { queueId: number; [key: string]: unknown };
  [key: string]: unknown;
}

/** /lol-summoner/v1/current-summoner 响应（只需名字相关字段） */
export interface CurrentSummonerDto {
  displayName?: string;
  gameName?: string;
  internalName?: string;
  name?: string;
  summonerId?: number;
  profileIconId?: number;
  summonerLevel?: number;
  [key: string]: unknown;
}
