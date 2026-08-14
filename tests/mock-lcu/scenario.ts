import type { ChampSelectSessionDto, LobbyDto } from '../../packages/game-session/src/types.ts';

import { HEXTECH_ARAM_QUEUE_IDS } from '../../packages/game-session/src/index.ts';

/** 海克斯大乱斗队列 ID（2026-08 国服真机实测 = 3270；普通大乱斗为 450） */
export const HEX_ARAM_QUEUE_ID = HEXTECH_ARAM_QUEUE_IDS[0];

export function makeLobby(queueId: number): LobbyDto {
  return { gameConfig: { queueId } };
}

/** 构造 ARAM 风格选人 session：本地玩家 cellId=1，默认英雄 Sivir(15)，bench 含 4 个备选 */
export function makeChampSelectSession(overrides: Partial<ChampSelectSessionDto> = {}): ChampSelectSessionDto {
  return {
    actions: [
      [
        { actorCellId: 1, type: 'pick', championId: 15, completed: true, isAllyAction: true, id: 1, isInProgress: false },
        { actorCellId: 1, type: 'reroll', completed: false, isAllyAction: true, id: 2, isInProgress: false },
      ],
    ],
    myTeam: [
      { cellId: 1, championId: 15, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 1, puuid: 'p1' },
      { cellId: 2, championId: 222, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 2, puuid: 'p2' },
      { cellId: 3, championId: 99, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 3, puuid: 'p3' },
      { cellId: 4, championId: 22, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 4, puuid: 'p4' },
      { cellId: 5, championId: 0, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 5, puuid: 'p5' },
    ],
    theirTeam: [
      { cellId: 6, championId: 17, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 6, puuid: 'p6' },
      { cellId: 7, championId: 55, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 7, puuid: 'p7' },
      { cellId: 8, championId: 63, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 8, puuid: 'p8' },
      { cellId: 9, championId: 101, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 9, puuid: 'p9' },
      { cellId: 10, championId: 145, assignedPosition: '', nameVisibilityType: 'VISIBLE', obfuscatedSummonerId: 10, puuid: 'p10' },
    ],
    bench: [{ championId: 161 }, { championId: 15 }, { championId: 17 }, { championId: 101 }],
    benchEnabled: true,
    localPlayerCellId: 1,
    ...overrides,
  };
}
