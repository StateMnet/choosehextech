import { discoverLcu } from '../../packages/lcu-client/src/index.ts';
import { toPhaseDto } from '../../packages/game-session/src/index.ts';

// 真机联调检查脚本：只读探测运行中客户端的对局状态
// 用法：node --experimental-strip-types scripts/dev/inspect-lcu.ts [安装目录]
const installDir = process.argv[2];
const client = await discoverLcu(installDir ? { installDirs: [installDir] } : {});
if (!client) {
  console.log('League client not running (no lockfile). Start the client first, or pass the install directory as an argument.');
  process.exit(1);
}

try {
  const phase = toPhaseDto(await client.request<unknown>('GET', '/lol-gameflow/v1/gameflow-phase')).phase;
  console.log('gameflow-phase:', phase);

  const summoner = await client.request<{ displayName?: string; gameName?: string }>('GET', '/lol-summoner/v1/current-summoner');
  console.log('summoner:', summoner.gameName || summoner.displayName || '(未登录)');

  try {
    const lobby = await client.request<{ gameConfig?: { queueId?: number } }>('GET', '/lol-lobby/v2/lobby');
    console.log('queue ID:', lobby.gameConfig?.queueId ?? '(none)');
  } catch {
    console.log('queue ID: (not in lobby)');
  }

  if (phase === 'ChampSelect') {
    const session = await client.request<{
      localPlayerCellId?: number;
      queueId?: number | string;
      isCustomGame?: boolean;
      actions?: {
        id?: number;
        type: string;
        actorCellId: number;
        completed: boolean;
        isAllyAction?: boolean;
        isInProgress?: boolean;
        championId?: number;
      }[][];
      myTeam?: { cellId: number; championId: number }[];
      bench?: { championId: number }[];
    }>('GET', '/lol-champ-select/v1/session');
    console.log('localPlayerCellId:', session.localPlayerCellId);
    console.log('session.queueId:', session.queueId ?? '(none)');
    console.log('session.isCustomGame:', session.isCustomGame);
    console.log('actions:', JSON.stringify(session.actions ?? []));
    console.log('myTeam:', JSON.stringify(session.myTeam?.map((m) => ({ cellId: m.cellId, championId: m.championId }))));
    console.log('bench:', JSON.stringify(session.bench?.map((b) => b.championId)));
  }
} catch (error) {
  console.error('request failed:', error);
  process.exit(1);
} finally {
  client.close();
}
