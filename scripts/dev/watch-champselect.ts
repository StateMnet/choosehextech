import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverLcu, type LcuClient } from '../../packages/lcu-client/src/index.ts';
import { toPhaseDto } from '../../packages/game-session/src/index.ts';

// 联调工具：监听对局阶段，进入选人时自动抓取 champ-select session 并落盘
// 用法：node --experimental-strip-types scripts/dev/watch-champselect.ts [分钟数，默认 60]
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const minutes = Number(process.argv[2] ?? 60);
const deadline = Date.now() + minutes * 60_000;
let client: LcuClient | null = null;
let lastPhase = '';
let lastCaptureAt = 0;

console.log('[watcher] 开始监听 ' + minutes + ' 分钟，等待进入选人阶段…');

while (Date.now() < deadline) {
  if (!client) {
    client = await discoverLcu();
    if (!client) {
      console.log('[' + new Date().toLocaleTimeString() + '] 客户端未运行，30 秒后重试');
      await sleep(30000);
      continue;
    }
  }
  try {
    const phase = toPhaseDto(await client.request<unknown>('GET', '/lol-gameflow/v1/gameflow-phase')).phase;
    if (phase !== lastPhase) {
      console.log('[' + new Date().toLocaleTimeString() + '] phase: ' + phase);
      lastPhase = phase;
    }
    if (phase === 'ChampSelect' && Date.now() - lastCaptureAt > 8000) {
      lastCaptureAt = Date.now();
      const session = await client.request<{
        localPlayerCellId?: number;
        myTeam?: { cellId: number; championId: number; championPickIntent?: number }[];
        theirTeam?: { cellId: number; championId: number }[];
        bench?: { championId: number }[];
        actions?: { actorCellId: number; type: string; championId?: number; completed: boolean }[][];
      }>('GET', '/lol-champ-select/v1/session');
      const outPath = join(import.meta.dirname, '..', '..', 'champselect-capture.json');
      writeFileSync(outPath, JSON.stringify(session, null, 2), 'utf8');
      console.log('===== 捕获选人 session → 已保存 ' + outPath + ' =====');
      const summary = {
        localPlayerCellId: session.localPlayerCellId,
        myTeam: session.myTeam?.map((member) => ({
          cellId: member.cellId,
          championId: member.championId,
          championPickIntent: member.championPickIntent,
        })),
        bench: session.bench?.map((entry) => entry.championId),
      };
      console.log(JSON.stringify(summary, null, 2));
    }
  } catch (error) {
    console.log('[' + new Date().toLocaleTimeString() + '] 连接异常，重新发现（' + String(error).slice(0, 80) + '）');
    client?.close();
    client = null;
  }
  await sleep(2000);
}
console.log('[watcher] 监听结束');
