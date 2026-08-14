import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { LcuHttpError, type LcuCredentials } from './types.ts';

const REQUEST_TIMEOUT_MS = 5000;

/** LCU REST 客户端：自签证书信任 + Basic Auth；protocol 为 http 时走明文（用于本地 mock） */
export function createHttpClient(credentials: LcuCredentials) {
  const baseUrl = credentials.protocol + '://' + credentials.host + ':' + credentials.port;
  const auth = 'Basic ' + Buffer.from('riot:' + credentials.password).toString('base64');

  function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = new URL(path, baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers: Record<string, string> = {
      Authorization: auth,
      Accept: 'application/json',
    };
    if (payload !== null) headers['Content-Type'] = 'application/json';

    return new Promise<T>((resolve, reject) => {
      const onResponse = (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300) {
            if (text === '') resolve(undefined as T);
            else {
              try {
                resolve(JSON.parse(text) as T);
              } catch {
                resolve(text as unknown as T);
              }
            }
          } else {
            reject(new LcuHttpError(res.statusCode ?? 0, text));
          }
        });
      };

      const baseOptions = {
        method,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      };
      const req =
        credentials.protocol === 'http'
          ? httpRequest(url, baseOptions, onResponse)
          : httpsRequest(url, { ...baseOptions, rejectUnauthorized: false }, onResponse);

      req.on('error', reject);
      if (payload !== null) req.write(payload);
      req.end();
    });
  }

  return { request, baseUrl };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
