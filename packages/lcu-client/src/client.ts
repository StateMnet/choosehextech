import { createHttpClient } from './http.ts';
import { findLockfile, defaultInstallDirs } from './lockfile.ts';
import { discoverLcuFromLogs } from './logs.ts';
import { discoverLcuFromProcess } from './process.ts';
import type { LcuCredentials, LcuEvent } from './types.ts';
import { createWebSocketClient } from './websocket.ts';

export interface LcuClient {
  credentials: LcuCredentials;
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
  subscribe(endpoint: string, handler: (event: LcuEvent) => void): () => void;
  isConnected(): boolean;
  close(): void;
}

export function createLcuClient(credentials: LcuCredentials): LcuClient {
  const http = createHttpClient(credentials);
  const wsClient = createWebSocketClient(credentials);
  return {
    credentials,
    request: http.request,
    subscribe: wsClient.subscribe,
    isConnected: wsClient.isConnected,
    close: wsClient.close,
  };
}

/** 从本机 lockfile 发现并连接客户端；未运行/未找到时返回 null */
export function connectToRunningClient(options: { installDirs?: string[] } = {}): LcuClient | null {
  const found = findLockfile(options);
  if (!found) return null;
  return createLcuClient({
    host: '127.0.0.1',
    port: found.data.port,
    password: found.data.password,
    protocol: found.data.protocol === 'http' ? 'http' : 'https',
  });
}

/** 用一次只读请求验证凭据是否可用（端口/令牌是否有效） */
export async function probeLcuCredentials(credentials: LcuCredentials): Promise<boolean> {
  const http = createHttpClient(credentials);
  try {
    await http.request('GET', '/lol-gameflow/v1/gameflow-phase');
    return true;
  } catch {
    return false;
  }
}

/**
 * 组合发现并连接：lockfile（国际服）→ LCU 日志（国服 WeGame）→ 进程命令行（兜底）。
 * 每个候选先探活，避免拿到启动器端口或过期令牌。全部失败返回 null。
 */
export async function discoverLcu(options: { installDirs?: string[] } = {}): Promise<LcuClient | null> {
  const dirs = options.installDirs ?? defaultInstallDirs();
  const candidates: LcuCredentials[] = [];

  const fromLockfile = findLockfile({ installDirs: dirs });
  if (fromLockfile) {
    candidates.push({
      host: '127.0.0.1',
      port: fromLockfile.data.port,
      password: fromLockfile.data.password,
      protocol: fromLockfile.data.protocol === 'http' ? 'http' : 'https',
    });
  }
  const fromLogs = discoverLcuFromLogs(dirs);
  if (fromLogs) candidates.push(fromLogs);
  const fromProcess = await discoverLcuFromProcess();
  if (fromProcess) candidates.push(fromProcess);

  for (const credentials of candidates) {
    if (await probeLcuCredentials(credentials)) {
      return createLcuClient(credentials);
    }
  }
  return null;
}
