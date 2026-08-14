import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBundle, type DataBundle } from '@choosehextech/data-core';

export interface LoadedBundle {
  bundle: DataBundle;
  path: string;
}

/** 在候选目录中寻找数据包产物（manifest.json + 数据文件），并做 zod schema 校验 */
export function loadDataBundle(candidateDirs: string[]): LoadedBundle | null {
  for (const dir of candidateDirs) {
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { file?: string };
      if (!manifest.file) continue;
      const bundlePath = join(dir, manifest.file);
      if (!existsSync(bundlePath)) continue;
      const bundle = parseBundle(JSON.parse(readFileSync(bundlePath, 'utf8')));
      return { bundle, path: bundlePath };
    } catch {
      // 目录中文件损坏：尝试下一个候选目录
    }
  }
  return null;
}
