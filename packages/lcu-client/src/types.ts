export interface LockfileData {
  /** 进程名，通常为 LeagueClient */
  name: string;
  pid: number;
  port: number;
  password: string;
  protocol: string;
}

export interface LcuCredentials {
  host: string;
  port: number;
  password: string;
  protocol: string;
}

/** OnJsonApiEvent 事件负载 */
export interface LcuEvent {
  data: unknown;
  eventType: string;
  uri: string;
}

export class LcuHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super('LCU 请求失败，状态码 ' + status);
    this.name = 'LcuHttpError';
    this.status = status;
    this.body = body;
  }
}
