import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Config } from '../src/config.ts';
import { loadConfig } from '../src/config.ts';
import type { Db } from '../src/db.ts';
import { openDb } from '../src/db.ts';

export interface Hit {
  path: string;
  at: number;
  userAgent: string;
}

export interface FakeRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Задержка перед ответом, мс (для проверки тайм-аутов). */
  delayMs?: number;
}

export interface FakeSite {
  url: string;
  host: string;
  port: number;
  hits: Hit[];
  routes: Map<string, FakeRoute>;
  set(path: string, route: FakeRoute): void;
  close(): Promise<void>;
}

/** Поднимает локальный «сайт» для тестов: отвечает по заданным маршрутам и запоминает обращения. */
export async function startFakeSite(initial: Record<string, FakeRoute> = {}): Promise<FakeSite> {
  const hits: Hit[] = [];
  const routes = new Map<string, FakeRoute>(Object.entries(initial));

  const server = http.createServer((req, res) => {
    const path = req.url ?? '/';
    hits.push({ path, at: Date.now(), userAgent: String(req.headers['user-agent'] ?? '') });
    const route = routes.get(path) ?? routes.get(path.split('?')[0]);
    const respond = () => {
      if (!route) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(route.status ?? 200, {
        'content-type': 'text/html; charset=utf-8',
        ...(route.headers ?? {}),
      });
      res.end(route.body ?? '');
    };
    if (route?.delayMs) setTimeout(respond, route.delayMs);
    else respond();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    host: `127.0.0.1:${port}`,
    port,
    hits,
    routes,
    set(path, route) {
      routes.set(path, route);
    },
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    },
  };
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return loadConfig({
    allowPrivateHosts: true,
    fetchMinIntervalMs: 0,
    fetchTimeoutMs: 2000,
    cacheTtlHours: 1,
    maxPagesPerAnalysis: 4,
    dbPath: ':memory:',
    braveKey: '',
    googleKey: '',
    googleCx: '',
    anthropicKey: '',
    telegramToken: '',
    telegramChatId: '',
    adminToken: '',
    ...overrides,
  });
}

export function testDb(): Db {
  return openDb(':memory:');
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
