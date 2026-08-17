import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface OverlayConfig {
  x?: number;
  y?: number;
  opacity?: number;
}

export interface UpdateConfig {
  /** 数据清单 manifest.json 的完整 URL；留空则跳过在线更新 */
  dataManifestUrl?: string;
}

export interface AppConfig {
  overlay: OverlayConfig;
  update: UpdateConfig;
  /** 自动接受对局（ReadyCheck 阶段自动点接受） */
  autoAccept: boolean;
}

const DEFAULTS: AppConfig = { overlay: { opacity: 0.88 }, update: {}, autoAccept: false };

export function configFilePath(configDir: string): string {
  return join(configDir, 'config.json');
}

/** 读取配置；文件缺失/损坏时返回默认值（不抛错） */
export function loadConfig(configDir: string): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(configFilePath(configDir), 'utf8')) as Partial<AppConfig>;
    return {
      overlay: { ...DEFAULTS.overlay, ...(raw.overlay ?? {}) },
      update: { ...DEFAULTS.update, ...(raw.update ?? {}) },
      autoAccept: raw.autoAccept ?? DEFAULTS.autoAccept,
    };
  } catch {
    return { overlay: { ...DEFAULTS.overlay }, update: { ...DEFAULTS.update }, autoAccept: DEFAULTS.autoAccept };
  }
}

export function saveConfig(configDir: string, config: AppConfig): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configFilePath(configDir), JSON.stringify(config, null, 2), 'utf8');
}

/** 透明度钳制到 0.3~1（避免完全看不见） */
export function clampOpacity(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.88;
  return Math.min(1, Math.max(0.3, value));
}
