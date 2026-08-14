import type { ChampSelectSessionDto, CurrentSummonerDto, GameflowPhaseDto, LobbyDto, SessionState } from './types.ts';
import { applyChampSelect, applyLobby, applyPhase, applySummoner, createInitialState, statesEqual, toPhaseDto } from './reducer.ts';

export interface LcuEventLike {
  data: unknown;
}

export interface TrackerDeps {
  /** LCU REST 请求（GET） */
  fetchJson: (path: string) => Promise<unknown>;
  /** 可选：WAMP 事件订阅（提供后变更更及时） */
  subscribe?: (endpoint: string, handler: (event: LcuEventLike) => void) => () => void;
  /** 轮询间隔毫秒；0 = 不轮询（仅靠事件） */
  pollIntervalMs?: number;
  /** 目标队列 ID 列表；null = 全部队列（开发期） */
  targetQueueIds?: number[] | null;
}

/**
 * 对局会话跟踪器：合并 REST 轮询与 WAMP 事件，维护 SessionState。
 * 纯逻辑，不依赖 Electron，可注入 mock 依赖单测。
 */
export class SessionTracker {
  private state: SessionState = createInitialState();
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribes: (() => void)[] = [];
  private listeners = new Set<(state: SessionState) => void>();
  private fetching = false;
  private readonly pollIntervalMs: number;
  private readonly targetQueueIds: number[] | null;

  private readonly deps: TrackerDeps;

  constructor(deps: TrackerDeps) {
    this.deps = deps;
    this.pollIntervalMs = deps.pollIntervalMs ?? 1500;
    this.targetQueueIds = deps.targetQueueIds ?? null;
  }

  getState(): SessionState {
    return this.state;
  }

  onChange(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.deps.subscribe) {
      this.unsubscribes.push(
        this.deps.subscribe('/lol-gameflow/v1/gameflow-phase', () => {
          void this.refresh();
        }),
        this.deps.subscribe('/lol-champ-select/v1/session', () => {
          void this.refresh();
        }),
        this.deps.subscribe('/lol-lobby/v2/lobby', () => {
          void this.refresh();
        }),
      );
    }
    if (this.pollIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.refresh();
      }, this.pollIntervalMs);
      this.timer.unref?.();
    }
    void this.refresh();
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribes) {
      try {
        unsubscribe();
      } catch {
        // 忽略关闭竞态
      }
    }
    this.unsubscribes = [];
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async refresh(): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    try {
      await this.refreshPhase();
      await this.refreshChampSelect();
      await this.refreshLobby();
      await this.refreshSummoner();
    } catch {
      // 客户端关闭等瞬态错误：保持现状，下一轮重试
    } finally {
      this.fetching = false;
    }
  }

  private async refreshPhase(): Promise<void> {
    const raw = await this.deps.fetchJson('/lol-gameflow/v1/gameflow-phase');
    this.update(applyPhase(this.state, toPhaseDto(raw)));
  }

  private async refreshChampSelect(): Promise<void> {
    if (this.state.phase !== 'ChampSelect') {
      // 离开选人：清空 cellId 与 bench，英雄保持粘性
      if (this.state.localPlayerCellId !== null || this.state.benchChampionIds.length > 0) {
        this.update(applyChampSelect(this.state, null));
      }
      return;
    }
    try {
      const dto = await this.deps.fetchJson('/lol-champ-select/v1/session');
      this.update(applyChampSelect(this.state, dto as ChampSelectSessionDto));
    } catch {
      // ChampSelect 下 session 短暂不可用：保持现状
    }
  }

  private async refreshLobby(): Promise<void> {
    try {
      const dto = await this.deps.fetchJson('/lol-lobby/v2/lobby');
      this.update(applyLobby(this.state, dto as LobbyDto, this.targetQueueIds));
    } catch {
      // 游戏内 lobby 404 是正常情况
    }
  }

  private async refreshSummoner(): Promise<void> {
    try {
      const dto = await this.deps.fetchJson('/lol-summoner/v1/current-summoner');
      this.update(applySummoner(this.state, dto as CurrentSummonerDto));
    } catch {
      // 客户端未就绪等瞬态错误：保持现状
    }
  }

  private update(next: SessionState): void {
    if (statesEqual(this.state, next)) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
