import { discoverLcu, type LcuClient } from '@choosehextech/lcu-client';
import { SessionTracker, type SessionState } from '@choosehextech/game-session';

export interface AppSessionOptions {
  targetQueueIds?: number[] | null;
  pollIntervalMs?: number;
  /** lockfile 探测间隔 */
  discoveryIntervalMs?: number;
  onState?: (state: SessionState | null) => void;
}

/**
 * 桌面端会话入口：周期探测 lockfile → 建立客户端连接与 SessionTracker；
 * 客户端退出后自动回收并继续探测（状态回调 null）。
 */
export class AppSession {
  private readonly options: AppSessionOptions;
  private client: LcuClient | null = null;
  private tracker: SessionTracker | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private probing = false;
  private current: SessionState | null = null;

  constructor(options: AppSessionOptions = {}) {
    this.options = options;
  }

  getState(): SessionState | null {
    return this.current;
  }

  start(): void {
    const intervalMs = this.options.discoveryIntervalMs ?? 5000;
    this.discoveryTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.discoveryTimer.unref?.();
    void this.tick();
  }

  stop(): void {
    this.disposed = true;
    if (this.discoveryTimer !== null) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    this.teardown();
  }

  private async tick(): Promise<void> {
    if (this.disposed || this.probing) return;
    this.probing = true;
    try {
      if (this.client === null) {
        const client = await discoverLcu();
        if (client === null) return; // 客户端未运行，下轮再探测
        this.client = client;
        const tracker = new SessionTracker({
          fetchJson: (path) => client.request<unknown>('GET', path),
          subscribe: (endpoint, handler) => client.subscribe(endpoint, handler),
          pollIntervalMs: this.options.pollIntervalMs ?? 1500,
          targetQueueIds: this.options.targetQueueIds ?? null,
        });
        this.tracker = tracker;
        tracker.onChange((state) => {
          this.current = state;
          this.options.onState?.(state);
        });
        tracker.start();
      } else {
        // 客户端退出检测：REST 探测失败 → 回收连接并通知状态为空
        try {
          await this.client.request('GET', '/lol-gameflow/v1/gameflow-phase');
        } catch {
          this.teardown();
          this.options.onState?.(null);
        }
      }
    } finally {
      this.probing = false;
    }
  }

  private teardown(): void {
    if (this.tracker !== null) {
      this.tracker.stop();
      this.tracker = null;
    }
    if (this.client !== null) {
      this.client.close();
      this.client = null;
    }
    this.current = null;
  }
}
