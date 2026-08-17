import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DataBundle } from '@choosehextech/data-core';
import type { SessionState } from '@choosehextech/game-session';
import type { AppConfig } from '../main/config';

function onChannel<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api = {
  onSessionState(callback: (state: SessionState | null) => void): () => void {
    return onChannel('session-state', callback);
  },
  getBundle(): Promise<DataBundle | null> {
    return ipcRenderer.invoke('bundle:get') as Promise<DataBundle | null>;
  },
  onBundleUpdated(callback: (bundle: DataBundle | null) => void): () => void {
    return onChannel('bundle:updated', callback);
  },
  getState(): Promise<SessionState | null> {
    return ipcRenderer.invoke('state:get') as Promise<SessionState | null>;
  },
  pickAndLock(championId: number): Promise<{ ok: boolean; message: string }> {
    return ipcRenderer.invoke('champselect:pick-lock', championId) as Promise<{ ok: boolean; message: string }>;
  },
  getConfig(): Promise<AppConfig> {
    return ipcRenderer.invoke('config:get') as Promise<AppConfig>;
  },
  saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    return ipcRenderer.invoke('config:save', config) as Promise<AppConfig>;
  },
  // ---- 浮窗专用通道 ----
  setOverlayInteractive(enabled: boolean): void {
    ipcRenderer.send('overlay:set-interactive', enabled);
  },
  setOverlayMode(mode: 'collapsed' | 'expanded'): void {
    ipcRenderer.send('overlay:set-mode', mode);
  },
  onResetOverlayMode(callback: () => void): () => void {
    return onChannel('overlay:reset-mode', callback);
  },
};

contextBridge.exposeInMainWorld('choosehextech', api);

export type ChooseHextechApi = typeof api;
