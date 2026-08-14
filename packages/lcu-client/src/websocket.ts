import { WebSocket } from 'ws';
import type { LcuCredentials, LcuEvent } from './types.ts';

const OPEN = WebSocket.OPEN;
const RECONNECT_DELAY_MS = 2000;

/** LCU WAMP v1 WebSocket 客户端：订阅 OnJsonApiEvent，断线自动重连 */
export function createWebSocketClient(credentials: LcuCredentials) {
  const scheme = credentials.protocol === 'http' ? 'ws' : 'wss';
  const url = scheme + '://' + credentials.host + ':' + credentials.port;
  const auth = 'Basic ' + Buffer.from('riot:' + credentials.password).toString('base64');
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByUser = false;
  const subscriptions = new Map<string, Set<(event: LcuEvent) => void>>();

  function endpointToTopic(endpoint: string): string {
    return 'OnJsonApiEvent_' + endpoint.replace(/^\/+/, '').replace(/\//g, '_');
  }

  function send(target: WebSocket, message: unknown[]): void {
    if (target.readyState === OPEN) target.send(JSON.stringify(message));
  }

  function connect(): void {
    if (closedByUser) return;
    const target = new WebSocket(url, {
      headers: { Authorization: auth },
      rejectUnauthorized: false,
    });
    socket = target;

    target.on('open', () => {
      for (const topic of subscriptions.keys()) send(target, [5, topic]); // WAMP v1 SUBSCRIBE
    });

    target.on('message', (raw) => {
      let message: unknown;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      // WAMP v1 EVENT：[8, topicURI, event]
      if (Array.isArray(message) && message[0] === 8 && typeof message[1] === 'string') {
        const topic = message[1];
        const event = message[2] as LcuEvent;
        const handlers = subscriptions.get(topic);
        if (handlers) for (const handler of handlers) handler(event);
      }
    });

    target.on('close', () => {
      socket = null;
      if (!closedByUser && subscriptions.size > 0 && reconnectTimer === null) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, RECONNECT_DELAY_MS);
      }
    });

    target.on('error', () => {
      // 由 close 事件统一处理重连
    });
  }

  function subscribe(endpoint: string, handler: (event: LcuEvent) => void): () => void {
    const topic = endpointToTopic(endpoint);
    let handlers = subscriptions.get(topic);
    if (!handlers) {
      handlers = new Set();
      subscriptions.set(topic, handlers);
    }
    handlers.add(handler);
    if (socket !== null && socket.readyState === OPEN) send(socket, [5, topic]);
    else if (socket === null) connect();
    return () => {
      const set = subscriptions.get(topic);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) subscriptions.delete(topic);
    };
  }

  function close(): void {
    closedByUser = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket !== null) socket.close();
  }

  function isConnected(): boolean {
    return socket !== null && socket.readyState === OPEN;
  }

  return { subscribe, close, isConnected };
}

export type WebSocketClient = ReturnType<typeof createWebSocketClient>;
