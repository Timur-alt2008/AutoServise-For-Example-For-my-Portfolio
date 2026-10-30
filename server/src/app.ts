import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { deliverBooking, isBookingConfigured, validateBooking } from './bookings.ts';
import type { Config } from './config.ts';
import { isLoopbackHost } from './config.ts';
import type { Db } from './db.ts';
import { openDb } from './db.ts';
import { AnalyzerError } from './errors.ts';
import { HostLimiter, WindowCounter } from './net/limiter.ts';
import { isAiConfigured } from './ai.ts';
import { SEARCH_PRESETS, configuredProviders, getSearchResult, searchReferences } from './search.ts';
import { AnalysisService } from './service.ts';
import { LIMITS, getSettings, updateSettings } from './settings.ts';
import {
  dashboardStats, deleteAnalysis, getAnalysisRow, listAnalysisRows, listIdeas, listTasks, presentAnalysis, setIdeaStatus,
} from './store.ts';

type Json = Record<string, unknown> | unknown[];

interface Ctx {
  req: http.IncomingMessage;
  url: URL;
  params: Record<string, string>;
  body: unknown;
  ip: string;
}
interface Result {
  status?: number;
  json: Json;
}
type Handler = (ctx: Ctx) => Result | Json | Promise<Result | Json>;

interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
  /** public — доступно без токена администратора и без служебного заголовка (заявки с сайта). */
  access: 'admin' | 'public';
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const MAX_BODY = 100 * 1024;

function isResult(v: unknown): v is Result {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'status' in v && 'json' in v;
}

function intParam(v: string | undefined, name: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new AnalyzerError('bad_request', `Некорректный параметр ${name}`);
  return n;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export interface App {
  server: http.Server;
  service: AnalysisService;
  db: Db;
  config: Config;
  close(): Promise<void>;
}

export function createApp(config: Config, deps: { db?: Db; limiter?: HostLimiter } = {}): App {
  const db = deps.db ?? openDb(config.dbPath);
  const service = new AnalysisService(db, config, deps.limiter ?? new HostLimiter());
  const bookingLimiter = new WindowCounter(5, 60_000);
  const routes: Route[] = [];

  const add = (method: string, pattern: string, handler: Handler, access: Route['access'] = 'admin') => {
    const keys: string[] = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_m, k: string) => (keys.push(k), '([^/]+)'))}/?$`);
    routes.push({ method, re, keys, handler, access });
  };

  // ---------------- API ----------------
  add('GET', '/api/health', () => ({ ok: true, version: '1.0.0' }), 'public');

  add('GET', '/api/config', () => {
    const settings = getSettings(db, config);
    return {
      search: { configured: configuredProviders(config).length > 0, providers: configuredProviders(config), presets: SEARCH_PRESETS },
      ai: { configured: isAiConfigured(config), model: isAiConfigured(config) ? config.aiModel : null },
      booking: { configured: isBookingConfigured(config) },
      settings,
      limits: LIMITS,
      secured: config.adminToken.length > 0,
    };
  });

  add('GET', '/api/stats', () => dashboardStats(db));

  add('POST', '/api/analyses', (ctx) => {
    const b = ctx.body as { url?: unknown; useAi?: unknown } | null;
    if (typeof b?.url !== 'string') throw new AnalyzerError('bad_request', 'Укажите адрес сайта в поле url');
    const row = service.enqueue(b.url, { useAi: b.useAi === true });
    return { status: 202, json: { analysis: presentAnalysis(row, false) } };
  });

  add('GET', '/api/analyses', (ctx) => {
    const limit = Math.min(200, Math.max(1, Number(ctx.url.searchParams.get('limit')) || 100));
    return { analyses: listAnalysisRows(db, limit).map((r) => presentAnalysis(r, false)) };
  });

  add('GET', '/api/analyses/:id', (ctx) => {
    const id = intParam(ctx.params.id, 'id');
    const row = getAnalysisRow(db, id);
    if (!row) throw new AnalyzerError('not_found', 'Анализ не найден');
    return { analysis: presentAnalysis(row, true), ideas: listIdeas(db, { analysisId: id }) };
  });

  add('POST', '/api/analyses/:id/rerun', (ctx) => {
    const row = service.rerun(intParam(ctx.params.id, 'id'));
    return { status: 202, json: { analysis: presentAnalysis(row, false) } };
  });

  add('DELETE', '/api/analyses/:id', (ctx) => {
    const id = intParam(ctx.params.id, 'id');
    const row = getAnalysisRow(db, id);
    if (!row) throw new AnalyzerError('not_found', 'Анализ не найден');
    if (row.status === 'queued' || row.status === 'running') throw new AnalyzerError('invalid_transition', 'Нельзя удалить анализ, который ещё выполняется');
    return { ok: deleteAnalysis(db, id) };
  });

  add('GET', '/api/ideas', (ctx) => {
    const p = ctx.url.searchParams;
    const minScore = p.get('minScore');
    const analysisId = p.get('analysisId');
    return {
      ideas: listIdeas(db, {
        status: p.get('status') ?? undefined,
        q: p.get('q') ?? undefined,
        minScore: minScore ? Number(minScore) : undefined,
        complexity: p.get('complexity') ?? undefined,
        origin: p.get('origin') ?? undefined,
        verification: p.get('verification') ?? undefined,
        analysisId: analysisId ? Number(analysisId) : undefined,
        sort: p.get('sort') ?? undefined,
      }),
    };
  });

  add('PATCH', '/api/ideas/:id', (ctx) => {
    const b = ctx.body as { status?: unknown; note?: unknown } | null;
    if (typeof b?.status !== 'string') throw new AnalyzerError('bad_request', 'Укажите новый статус в поле status');
    return { idea: setIdeaStatus(db, intParam(ctx.params.id, 'id'), b.status, typeof b.note === 'string' ? b.note : undefined) };
  });

  add('GET', '/api/tasks', (ctx) => ({ tasks: listTasks(db, ctx.url.searchParams.get('status') ?? undefined) }));

  add('POST', '/api/search', async (ctx) => {
    const b = ctx.body as { query?: unknown; provider?: unknown } | null;
    if (typeof b?.query !== 'string') throw new AnalyzerError('bad_request', 'Укажите поисковый запрос в поле query');
    return searchReferences(db, config, getSettings(db, config), b.query, typeof b.provider === 'string' ? b.provider : undefined);
  });

  add('POST', '/api/search/results/:id/analyze', (ctx) => {
    const hit = getSearchResult(db, intParam(ctx.params.id, 'id'));
    if (!hit) throw new AnalyzerError('not_found', 'Результат поиска не найден');
    const row = service.enqueue(hit.url, {});
    return { status: 202, json: { analysis: presentAnalysis(row, false) } };
  });

  add('GET', '/api/settings', () => ({ settings: getSettings(db, config), limits: LIMITS }));
  add('PUT', '/api/settings', (ctx) => ({ settings: updateSettings(db, config, ctx.body) }));
  add('POST', '/api/cache/clear', () => {
    service.fetcher.clearCache();
    return { ok: true };
  });

  add('POST', '/api/bookings', async (ctx) => {
    if (!isBookingConfigured(config)) {
      throw new AnalyzerError('booking_not_configured', 'Приём заявок не настроен: сайт работает в демонстрационном режиме');
    }
    if (!bookingLimiter.allow(ctx.ip)) throw new AnalyzerError('rate_limited', 'Слишком много заявок. Попробуйте через минуту.');
    const { value, errors } = validateBooking(ctx.body);
    if (!value) return { status: 422, json: { error: { code: 'validation', message: 'Проверьте поля формы', fields: errors } } };
    await deliverBooking(config, value);
    return { ok: true };
  }, 'public');

  // ---------------- Служебное ----------------
  const hostAllowed = (hostHeader: string | undefined): boolean => {
    if (!isLoopbackHost(config.host) || config.adminToken) return true;
    const host = (hostHeader ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  };
  const originAllowed = (origin: string | undefined): boolean => {
    if (!origin || !isLoopbackHost(config.host) || config.adminToken) return true;
    try {
      const h = new URL(origin).hostname.replace(/^\[|\]$/g, '');
      return h === 'localhost' || h === '127.0.0.1' || h === '::1';
    } catch {
      return false;
    }
  };

  function send(res: http.ServerResponse, status: number, json: Json): void {
    const body = JSON.stringify(json);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  }

  async function readBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY) throw new AnalyzerError('bad_request', 'Слишком большое тело запроса');
      chunks.push(chunk as Buffer);
    }
    if (!size) return null;
    const type = String(req.headers['content-type'] ?? '');
    if (!/application\/json/i.test(type)) throw new AnalyzerError('bad_request', 'Ожидается Content-Type: application/json');
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new AnalyzerError('bad_request', 'Тело запроса — некорректный JSON');
    }
  }

  function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const root = config.clientDist;
    if (!existsSync(root)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Интерфейс не собран. Выполните «npm run build» или запустите «npm run dev» и откройте http://127.0.0.1:5173');
      return;
    }
    let rel: string;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // Запросы к файлам с расширением, которых нет, — это 404; остальное — SPA
      if (path.extname(rel)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      file = path.join(root, 'index.html');
    }
    const ext = path.extname(file).toLowerCase();
    const isIndex = file.endsWith('index.html');
    const headers: Record<string, string> = {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': isIndex ? 'no-cache' : rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    };
    if (isIndex) {
      headers['content-security-policy'] = CSP;
      headers['x-frame-options'] = 'DENY';
      headers['referrer-policy'] = 'no-referrer';
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else res.end(readFileSync(file));
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = (req.method ?? 'GET').toUpperCase();

      if (!hostAllowed(req.headers.host) || !originAllowed(req.headers.origin)) {
        return send(res, 403, { error: { code: 'unauthorized', message: 'Запрос отклонён: недопустимый адрес сервера' } });
      }

      if (!url.pathname.startsWith('/api/')) {
        if (method !== 'GET' && method !== 'HEAD') return send(res, 405, { error: { code: 'bad_request', message: 'Метод не поддерживается' } });
        return serveStatic(req, res, url.pathname);
      }

      let matched: { route: Route; params: Record<string, string> } | null = null;
      let pathExists = false;
      for (const route of routes) {
        const m = route.re.exec(url.pathname);
        if (!m) continue;
        pathExists = true;
        if (route.method !== method) continue;
        matched = { route, params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
        break;
      }
      if (!matched) {
        return send(res, pathExists ? 405 : 404, { error: { code: 'not_found', message: pathExists ? 'Метод не поддерживается' : 'Нет такого адреса' } });
      }

      if (matched.route.access === 'admin') {
        if (config.adminToken) {
          const auth = String(req.headers.authorization ?? '');
          const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
          if (!safeEqual(token, config.adminToken)) throw new AnalyzerError('unauthorized', 'Нужен пароль администратора');
        }
        if (method !== 'GET' && req.headers['x-analyzer-client'] !== '1') {
          throw new AnalyzerError('unauthorized', 'Запрос отклонён: нет служебного заголовка');
        }
      } else if (method !== 'GET') {
        // Публичные POST принимаем только как JSON: так браузер не отправит их с чужой страницы без разрешения.
        const type = String(req.headers['content-type'] ?? '');
        if (!/application\/json/i.test(type)) throw new AnalyzerError('bad_request', 'Ожидается Content-Type: application/json');
      }

      const body = method === 'GET' || method === 'HEAD' ? null : await readBody(req);
      const out = await matched.route.handler({ req, url, params: matched.params, body, ip: req.socket.remoteAddress ?? 'unknown' });
      const result: Result = isResult(out) ? out : { json: out as Json };
      send(res, result.status ?? 200, result.json);
    } catch (e) {
      if (e instanceof AnalyzerError) {
        return send(res, e.httpStatus, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
      }
      console.error('[server] необработанная ошибка:', e);
      send(res, 500, { error: { code: 'internal', message: 'Внутренняя ошибка сервера' } });
    }
  });

  return {
    server,
    service,
    db,
    config,
    async close() {
      await service.idle();
      await new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
      try {
        db.close();
      } catch {
        // уже закрыта
      }
    },
  };
}
