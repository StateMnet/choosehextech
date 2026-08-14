import { execFile } from 'node:child_process';
import type { LcuCredentials } from './types.ts';

const UX_PROCESS_NAME = 'LeagueClientUx.exe';

/**
 * 解析 LeagueClientUx 启动命令行，提取 LCU 端口与令牌。
 * 国服（WeGame）客户端不写 LCU lockfile，必须走这条通道。
 */
export function parseUxCommandLine(text: string): { port: number; token: string } | null {
  const portMatch = /--app-port=(\d+)/.exec(text);
  const tokenMatch = /--remoting-auth-token=([A-Za-z0-9_-]+)/.exec(text);
  if (!portMatch || !tokenMatch) return null;
  const port = Number(portMatch[1]);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
  return { port, token: tokenMatch[1] };
}

function readUxCommandLine(): Promise<string> {
  const command =
    "(Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -First 1).CommandLine";
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout: 8000, encoding: 'utf8' },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout ?? '');
      },
    );
  });
}

/** 从运行中的 LeagueClientUx 进程命令行发现 LCU 连接凭据；失败返回 null */
export async function discoverLcuFromProcess(): Promise<LcuCredentials | null> {
  try {
    const text = await readUxCommandLine();
    const parsed = parseUxCommandLine(text);
    if (!parsed) return null;
    return {
      host: '127.0.0.1',
      port: parsed.port,
      password: parsed.token,
      protocol: 'https',
    };
  } catch {
    return null;
  }
}
