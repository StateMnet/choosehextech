import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { LcuCredentials } from './types.ts';

const MAX_LOG_BYTES = 20 * 1024 * 1024;

/**
 * 从 LCU 日志文本中提取端口与令牌（取最后一次出现，即当前会话）。
 * 注意 --app-port 锚定双横线，避免误匹配 --riotclient-app-port。
 */
export function extractLcuCredentialsFromLog(text: string): { port: number; token: string } | null {
  const ports = [...text.matchAll(/--app-port=(\d+)/g)];
  const tokens = [...text.matchAll(/--remoting-auth-token=([A-Za-z0-9_-]+)/g)];
  if (ports.length === 0 || tokens.length === 0) return null;
  const port = Number(ports[ports.length - 1][1]);
  const token = tokens[tokens.length - 1][1];
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
  return { port, token };
}

function decodeLog(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer);
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return buffer.toString('utf8');
}

function readLogFile(path: string): string | null {
  try {
    const size = statSync(path).size;
    if (size === 0 || size > MAX_LOG_BYTES) return null;
    return decodeLog(readFileSync(path));
  } catch {
    return null;
  }
}

/** 由安装目录推导 LCU 日志目录：root/LeagueClient 与 root/Game/Logs/LeagueClient Logs */
export function logSearchDirsFor(installDirs: string[]): string[] {
  const dirs = new Set<string>();
  for (const dir of installDirs) {
    const root = basename(dir) === 'LeagueClient' ? join(dir, '..') : dir;
    dirs.add(join(root, 'LeagueClient'));
    dirs.add(join(root, 'Game', 'Logs', 'LeagueClient Logs'));
  }
  return [...dirs];
}

/**
 * 国服（WeGame）客户端不写 LCU lockfile，但会把完整启动命令行写进日志。
 * 按修改时间从新到旧扫描日志，提取当前会话的端口与令牌。
 */
export function discoverLcuFromLogs(installDirs: string[]): LcuCredentials | null {
  const files: { path: string; mtimeMs: number }[] = [];
  for (const dir of logSearchDirsFor(installDirs)) {
    try {
      for (const name of readdirSync(dir)) {
        if (!/LeagueClient.*\.log$/.test(name)) continue;
        const path = join(dir, name);
        try {
          files.push({ path, mtimeMs: statSync(path).mtimeMs });
        } catch {
          // 文件读取竞态：跳过
        }
      }
    } catch {
      // 目录不存在：跳过
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const file of files.slice(0, 10)) {
    const text = readLogFile(file.path);
    if (text === null) continue;
    const parsed = extractLcuCredentialsFromLog(text);
    if (parsed) {
      return { host: '127.0.0.1', port: parsed.port, password: parsed.token, protocol: 'https' };
    }
  }
  return null;
}
