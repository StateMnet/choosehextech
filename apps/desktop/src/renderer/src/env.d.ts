import type { DataBundle } from '@choosehextech/data-core';
import type { SessionState } from '@choosehextech/game-session';
import type { AppConfig } from '../../main/config';

export interface ChooseHextechApi {
  onSessionState(callback: (state: SessionState | null) => void): () => void;
  getBundle(): Promise<DataBundle | null>;
  onBundleUpdated(callback: (bundle: DataBundle | null) => void): () => void;
  getState(): Promise<SessionState | null>;
  pickAndLock(championId: number): Promise<{ ok: boolean; message: string }>;
  getConfig(): Promise<AppConfig>;
  saveConfig(config: Partial<AppConfig>): Promise<AppConfig>;
  setOverlayInteractive(enabled: boolean): void;
  setOverlayMode(mode: 'collapsed' | 'expanded'): void;
  dragOverlay(dx: number, dy: number): void;
  onResetOverlayMode(callback: () => void): () => void;
}

declare global {
  interface Window {
    choosehextech: ChooseHextechApi;
  }
}

export {};
