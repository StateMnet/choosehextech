import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LockfileData } from './types.ts';

export const LOCKFILE_NAME = 'lockfile';

/** 解析 lockfile 文本：name:pid:port:password:protocol */
export function parseLockfile(text: string): LockfileData {
  const parts = text.trim().split(':');
  if (parts.length < 5) {
    throw new Error('lockfile 格式不正确：' + text.trim());
  }
  const [name, pid, port, password, ...rest] = parts;
  return {
    name,
    pid: Number(pid),
    port: Number(port),
    password,
    protocol: rest.length > 0 ? rest[rest.length - 1] : 'https',
  };
}

/** 常见安装目录（国服/国际服/WeGame），按盘符扫描 */
export function defaultInstallDirs(): string[] {
  const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
  const dirs: string[] = [];
  for (const drive of drives) {
    dirs.push(
      drive + '/Riot Games/League of Legends',
      drive + '/Program Files/Riot Games/League of Legends',
      drive + '/WeGameApps/英雄联盟/LeagueClient',
      drive + '/WeGameApps/英雄联盟/Riot Client Data/User Data/Config',
      drive + '/Software/WeGameApps/英雄联盟/LeagueClient',
      drive + '/Software/WeGameApps/英雄联盟/Riot Client Data/User Data/Config',
      drive + '/腾讯游戏/英雄联盟/Game',
      drive + '/英雄联盟/Game',
    );
  }
  return dirs;
}

export function findLockfile(options: { installDirs?: string[] } = {}): { path: string; data: LockfileData } | null {
  const dirs = options.installDirs ?? defaultInstallDirs();
  for (const dir of dirs) {
    const path = join(dir, LOCKFILE_NAME);
    try {
      if (existsSync(path)) {
        const data = parseLockfile(readFileSync(path, 'utf8'));
        // 国服 WeGame 目录里会有启动器（Riot Client）的 lockfile，必须过滤：只有 LCU 本体（name=LeagueClient）才有效
        if (data.name !== 'LeagueClient') continue;
        return { path, data };
      }
    } catch {
      // 路径不存在/陈旧空文件等：继续尝试下一个目录
    }
  }
  return null;
}
