import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseBundle } from '@choosehextech/data-core';

/**
 * 数据分发清单（与 scripts/build-data.ts 生成的 dist/manifest.json 一致）。
 * 用于在线比对版本、下载并校验数据包。
 */
export interface DataManifest {
  schemaVersion: number;
  dataVersion: string;
  gamePatch: string;
  mode: string;
  file: string;
  sha256?: string;
  builtAt?: string;
}

export type UpdateStatus = 'up-to-date' | 'updated' | 'error';

export interface UpdateResult {
  status: UpdateStatus;
  fromVersion?: string;
  toVersion?: string;
  message: string;
}

/** 更新器依赖：网络抓取注入，便于脱离网络单测 */
export interface DataUpdaterDeps {
  fetchText: (url: string) => Promise<string>;
  fetchBuffer: (url: string) => Promise<Buffer>;
}

// ---- 纯函数（可脱离文件系统/网络单测）----

export function parseManifest(raw: unknown): DataManifest {
  if (raw === null || typeof raw !== 'object') throw new Error('清单格式非法');
  const m = raw as Record<string, unknown>;
  if (typeof m.file !== 'string' || m.file.length === 0) throw new Error('清单缺少 file');
  if (typeof m.dataVersion !== 'string' || m.dataVersion.length === 0) throw new Error('清单缺少 dataVersion');
  return {
    schemaVersion: typeof m.schemaVersion === 'number' ? m.schemaVersion : 1,
    dataVersion: m.dataVersion,
    gamePatch: typeof m.gamePatch === 'string' ? m.gamePatch : '',
    mode: typeof m.mode === 'string' ? m.mode : '',
    file: m.file,
    sha256: typeof m.sha256 === 'string' && m.sha256.length > 0 ? m.sha256 : undefined,
    builtAt: typeof m.builtAt === 'string' ? m.builtAt : undefined,
  };
}

/** 比较 "1.0.0" 风格版本号：a < b → -1；a == b → 0；a > b → 1 */
export function compareDataVersions(a: string, b: string): number {
  const pa = a.split('.').map((segment) => Number.parseInt(segment, 10) || 0);
  const pb = b.split('.').map((segment) => Number.parseInt(segment, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

// ---- 文件系统（原子写，供安装与单测复用）----

export function atomicWriteFile(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp-' + process.pid + '-' + Date.now();
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // 忽略清理失败
    }
    throw error;
  }
}

export function readLocalManifest(dataDir: string): DataManifest | null {
  const manifestPath = join(dataDir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    return parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  } catch {
    return null;
  }
}

/**
 * 检查并安装数据更新。返回结果；网络/校验失败时抛错，由调用方决定如何降级。
 * - 本地版本 >= 远端版本 → up-to-date（不下载）
 * - 否则下载数据文件 → 校验 sha256 → zod schema 校验 → 原子写入 manifest + 数据文件
 */
export async function checkAndUpdateData(
  deps: DataUpdaterDeps,
  dataDir: string,
  manifestUrl: string,
): Promise<UpdateResult> {
  const local = readLocalManifest(dataDir);
  const remote = parseManifest(JSON.parse(await deps.fetchText(manifestUrl)));

  if (local && compareDataVersions(remote.dataVersion, local.dataVersion) <= 0) {
    return {
      status: 'up-to-date',
      fromVersion: local.dataVersion,
      toVersion: remote.dataVersion,
      message: '数据已是最新（v' + local.dataVersion + '）',
    };
  }

  if (!remote.sha256) throw new Error('远端清单缺少 sha256，拒绝安装');
  const fileUrl = new URL(remote.file, manifestUrl).toString();
  const data = await deps.fetchBuffer(fileUrl);

  if (sha256Hex(data) !== remote.sha256.toLowerCase()) {
    throw new Error('数据包 sha256 校验失败');
  }

  // 安装前先做 schema 校验，避免把坏数据落盘
  parseBundle(JSON.parse(data.toString('utf8')));

  atomicWriteFile(join(dataDir, remote.file), data);
  atomicWriteFile(join(dataDir, 'manifest.json'), JSON.stringify(remote, null, 2));

  return {
    status: 'updated',
    fromVersion: local?.dataVersion,
    toVersion: remote.dataVersion,
    message: '数据已更新到 v' + remote.dataVersion,
  };
}
