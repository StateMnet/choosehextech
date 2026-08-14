import { request as httpsRequest } from 'node:https';
import { defaultInstallDirs, discoverLcuFromLogs } from '../../packages/lcu-client/src/index.ts';

// 联调工具：打印 LCU 各端点的原始状态码与响应体（只读）
const credentials = discoverLcuFromLogs(defaultInstallDirs());
if (!credentials) {
  console.log('未发现 LCU 凭据（客户端未运行？）');
  process.exit(1);
}
const creds = credentials; // 捕获为 const，供闭包使用
console.log('LCU port: ' + creds.port);

const auth = 'Basic ' + Buffer.from('riot:' + creds.password).toString('base64');
const endpoints = [
  '/lol-game-data/assets/v1/champion-summary.json',
  '/lol-gameflow/v1/gameflow-phase',
  '/lol-gameflow/v1/session',
  '/lol-summoner/v1/current-summoner',
  '/lol-lobby/v2/lobby',
  '/lol-champ-select/v1/session',
];

function probe(path: string): Promise<void> {
  return new Promise((resolve) => {
    const req = httpsRequest(
      {
        host: '127.0.0.1',
        port: creds.port,
        path,
        method: 'GET',
        rejectUnauthorized: false,
        headers: { Authorization: auth, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          console.log('---- ' + path + ' -> ' + res.statusCode + ' ----');
          console.log((body.slice(0, 500) || '(空响应)') + '\n');
          resolve();
        });
      },
    );
    req.on('error', (error) => {
      console.log('---- ' + path + ' -> ERROR: ' + error.message + ' ----\n');
      resolve();
    });
    req.end();
  });
}

for (const endpoint of endpoints) {
  await probe(endpoint);
}
