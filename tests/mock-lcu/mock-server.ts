import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import type { ChampSelectSessionDto, LobbyDto } from '../../packages/game-session/src/types.ts';

export const MOCK_PASSWORD = 'mock-password';

export interface MockLcuState {
  phase: string;
  session: ChampSelectSessionDto | null;
  lobby: LobbyDto | null;
}

export type PhaseShape = 'object' | 'string';

export function topicFor(endpoint: string): string {
  return 'OnJsonApiEvent_' + endpoint.replace(/^\/+/, '').replace(/\//g, '_');
}

/** 本地 LCU 模拟服务器：REST + WAMP v1 订阅，用于单测与状态机集成测试 */
export class MockLcuServer {
  state: MockLcuState = { phase: 'None', session: null, lobby: null };
  /** phase 响应形态：object = { phase }（国际服）；string = "Lobby"（国服实测） */
  phaseShape: PhaseShape = 'object';
  port = 0;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private subscribers = new Map<string, Set<WebSocket>>();
  private started = false;

  async start(): Promise<number> {
    const httpServer = createServer((req, res) => {
      void this.handle(req, res);
    });
    const wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => this.handleSocket(ws));
    });
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    this.httpServer = httpServer;
    this.wss = wss;
    this.port = (httpServer.address() as AddressInfo).port;
    this.started = true;
    return this.port;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await new Promise<void>((resolve) => {
      for (const client of this.wss?.clients ?? []) client.terminate();
      this.wss?.close(() => {
        this.httpServer?.close(() => resolve());
      });
    });
    this.started = false;
  }

  setState(partial: Partial<MockLcuState>): void {
    this.state = { ...this.state, ...partial };
  }

  hasSubscribers(endpoint: string): boolean {
    const set = this.subscribers.get(topicFor(endpoint));
    return set !== undefined && set.size > 0;
  }

  /** 向订阅了指定端点的客户端推送 OnJsonApiEvent（WAMP v1 EVENT：[8, topic, event]） */
  emit(endpoint: string, data: unknown): void {
    const topic = topicFor(endpoint);
    const event = { data, eventType: 'Update', uri: endpoint };
    const clients = this.subscribers.get(topic);
    if (!clients) return;
    for (const client of clients) {
      if (client.readyState === 1) client.send(JSON.stringify([8, topic, event]));
    }
  }

  private handleSocket(client: WebSocket): void {
    client.on('message', (raw) => {
      let message: unknown;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      // WAMP v1 SUBSCRIBE：[5, topicURI]
      if (Array.isArray(message) && message[0] === 5 && typeof message[1] === 'string') {
        const topic = message[1];
        let existing = this.subscribers.get(topic);
        if (!existing) {
          existing = new Set();
          this.subscribers.set(topic, existing);
        }
        const set = existing;
        set.add(client);
        client.on('close', () => {
          set.delete(client);
          if (set.size === 0) this.subscribers.delete(topic);
        });
      }
    });
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const expected = 'Basic ' + Buffer.from('riot:' + MOCK_PASSWORD).toString('base64');
    if (req.headers.authorization !== expected) {
      res.writeHead(401).end('unauthorized');
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    let body: string;
    switch (req.url) {
      case '/lol-gameflow/v1/gameflow-phase':
        body = this.phaseShape === 'string' ? JSON.stringify(this.state.phase) : JSON.stringify({ phase: this.state.phase });
        break;
      case '/lol-champ-select/v1/session':
        if (!this.state.session) {
          res.writeHead(404).end('no session');
          return;
        }
        body = JSON.stringify(this.state.session);
        break;
      case '/lol-lobby/v2/lobby':
        if (!this.state.lobby) {
          res.writeHead(404).end('no lobby');
          return;
        }
        body = JSON.stringify(this.state.lobby);
        break;
      case '/lol-summoner/v1/current-summoner':
        body = JSON.stringify({ displayName: '测试召唤师' });
        break;
      default:
        res.writeHead(404).end('not found');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  }
}
