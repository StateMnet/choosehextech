/**
 * 海克斯大乱斗队列 ID（国服真机实测，gameMode=KIWI；普通大乱斗为 450）。
 * 2400 = 国服当前实测（2026-08 客户端返回，Lobby 下 gameConfig.queueId=2400）；
 * 3270 = 早期记录值，保留兼容。
 */
export const HEXTECH_ARAM_QUEUE_IDS = [2400, 3270] as const;
