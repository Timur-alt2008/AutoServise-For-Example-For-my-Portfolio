import type { Config } from '../config.ts';
import { ROBOTS_TOKEN, USER_AGENT } from '../config.ts';
import type { Db } from '../db.ts';
import { one, run } from '../db.ts';
import { AnalyzerError } from '../errors.ts';
import type { Settings } from '../settings.ts';
import { isDomainBlocked } from '../settings.ts';
import { HostLimiter } from './limiter.ts';
import type { ParsedRobots } from './robots.ts';
import { crawlDelaySeconds, isAllowed, parseRobots } from './robots.ts';
import { assertPublicHost, normalizeUrl } from './safety.ts';

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  fromCache: boolean;
  truncated: boolean;
}

type Kind = 'page' | 'asset' | 'robots';

interface RawResponse {
  status: number;
  location: string | null;
  contentType: string;
  body: string;
  truncated: boolean;
}

const MAX_REDIRECTS = 5;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
const ROBOTS_MAX_BYTES = 512 * 1024;
const MAX_DELAY_MS = 30_000;

const BOT_WALL_MARKERS =
  /cf-browser-verification|cf-chl-|__cf_chl|Just a moment\.\.\.|Attention Required! \| Cloudflare|px-captcha|captcha-delivery\.com|DDoS protection by|Checking your browser before accessing/i;

/** Страница-заглушка «докажите, что вы не робот». Мы её не проходим и не обходим. */
export function looksLikeBotWall(body: string, status: number): boolean {
  if (body.length > 80_000) return false;
  if (BOT_WALL_MARKERS.test(body)) return true;
  if (status === 503 && /captcha/i.test(body)) return true;
  if (/g-recaptcha|h-captcha|hcaptcha/i.test(body)) {
    const visible = body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return visible.length < 1200;
  }
  return false;
}

function pickCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const sniff = new TextDecoder('latin1').decode(head.subarray(0, 4096));
  const fromMeta =
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(sniff)?.[1] ??
    /<meta[^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i.exec(sniff)?.[1];
  return (fromMeta ?? 'utf-8').toLowerCase();
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const label = pickCharset(contentType, bytes);
  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function mapNetworkError(e: unknown, host: string): AnalyzerError {
  if (e instanceof AnalyzerError) return e;
  const err = e as { name?: string; code?: string; cause?: { code?: string; message?: string }; message?: string };
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return new AnalyzerError('timeout', `Сайт ${host} не ответил за отведённое время`);
  }
  const code = err?.cause?.code ?? err?.code ?? '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new AnalyzerError('dns_error', `Сайт ${host} не найден (проверьте адрес)`);
  }
  if (code === 'ECONNREFUSED') {
    return new AnalyzerError('connection_refused', `Сайт ${host} отклонил соединение`);
  }
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT') {
    return new AnalyzerError('timeout', `Сайт ${host} не ответил за отведённое время`);
  }
  const detail = err?.cause?.message ?? err?.message ?? 'неизвестная ошибка';
  return new AnalyzerError('network_error', `Не удалось связаться с ${host}: ${detail}`);
}

export class PageFetcher {
  readonly db: Db;
  readonly config: Config;
  readonly limiter: HostLimiter;
  private getSettings: () => Settings;
  private delays = new Map<string, number>();
  /** Сколько реальных сетевых запросов отправлено (кэш не считается). */
  networkRequests = 0;

  constructor(db: Db, config: Config, getSettings: () => Settings, limiter: HostLimiter = new HostLimiter()) {
    this.db = db;
    this.config = config;
    this.getSettings = getSettings;
    this.limiter = limiter;
  }

  async fetchPage(input: string, kind: 'page' | 'asset' = 'page'): Promise<FetchedPage> {
    const url = normalizeUrl(input, { allowPrivate: this.config.allowPrivateHosts });
    const settings = this.getSettings();
    this.assertNotBlocked(url, settings);
    await assertPublicHost(url.hostname, this.config.allowPrivateHosts);

    const key = url.toString();
    const ttlMs = settings.cacheTtlHours * 3600 * 1000;
    if (ttlMs > 0) {
      const cached = one<{
        fetched_at: number; status: number; content_type: string; final_url: string; truncated: number; body: string;
      }>(this.db, 'SELECT fetched_at, status, content_type, final_url, truncated, body FROM page_cache WHERE url = ?', key);
      if (cached && Date.now() - cached.fetched_at < ttlMs) {
        return {
          url: key,
          finalUrl: cached.final_url,
          status: cached.status,
          contentType: cached.content_type,
          body: cached.body,
          fromCache: true,
          truncated: cached.truncated === 1,
        };
      }
    }

    await this.ensureAllowed(url, settings);
    const { response, finalUrl } = await this.followRedirects(url, kind, settings);

    run(
      this.db,
      `INSERT INTO page_cache (url, fetched_at, status, content_type, final_url, truncated, body)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET fetched_at = excluded.fetched_at, status = excluded.status,
         content_type = excluded.content_type, final_url = excluded.final_url,
         truncated = excluded.truncated, body = excluded.body`,
      key, Date.now(), response.status, response.contentType, finalUrl, response.truncated ? 1 : 0, response.body,
    );

    return {
      url: key,
      finalUrl,
      status: response.status,
      contentType: response.contentType,
      body: response.body,
      fromCache: false,
      truncated: response.truncated,
    };
  }

  clearCache(): void {
    run(this.db, 'DELETE FROM page_cache');
    run(this.db, 'DELETE FROM robots_cache');
    this.delays.clear();
  }

  // -------------------------------------------------------------------------

  private assertNotBlocked(url: URL, settings: Settings): void {
    if (isDomainBlocked(settings, url.hostname)) {
      throw new AnalyzerError('blocked', `Домен ${url.hostname} находится в списке запрещённых в настройках`);
    }
  }

  private effectiveInterval(host: string, settings: Settings): number {
    const delayMs = (this.delays.get(host) ?? 0) * 1000;
    return Math.min(MAX_DELAY_MS, Math.max(settings.fetchMinIntervalMs, delayMs));
  }

  private async ensureAllowed(url: URL, settings: Settings): Promise<void> {
    const robots = await this.loadRobots(url, settings);
    if (!isAllowed(robots, ROBOTS_TOKEN, url.pathname + url.search)) {
      throw new AnalyzerError(
        'robots_disallowed',
        `Сайт ${url.host} запрещает автоматический доступ к этой странице в robots.txt. Анализатор её не открывает.`,
      );
    }
  }

  private async loadRobots(url: URL, settings: Settings): Promise<ParsedRobots> {
    const origin = url.origin;
    let row = one<{ fetched_at: number; status: number; body: string }>(
      this.db,
      'SELECT fetched_at, status, body FROM robots_cache WHERE origin = ?',
      origin,
    );

    if (!row || Date.now() - row.fetched_at > ROBOTS_TTL_MS) {
      const robotsUrl = new URL('/robots.txt', origin);
      let response: RawResponse;
      try {
        response = (await this.followRedirects(robotsUrl, 'robots', settings)).response;
      } catch (e) {
        if (!(e instanceof AnalyzerError)) throw e;
        if (e.code === 'blocked') {
          throw new AnalyzerError('robots_unreachable', `Сайт ${url.host} закрывает доступ даже к robots.txt (${e.message}). Считаем доступ закрытым.`);
        }
        if (e.code === 'http_error' && (e.details?.status === 404 || e.details?.status === 410)) {
          response = { status: 404, location: null, contentType: 'text/plain', body: '', truncated: false };
        } else if (e.code === 'http_error') {
          // Сервер отвечает, но robots.txt отдать не может (например, 5xx): правила неизвестны — страницы не открываем.
          throw new AnalyzerError('robots_unreachable', `Не удалось прочитать robots.txt сайта ${url.host} (${e.message}). Пока правила неизвестны, страницы не открываются.`);
        } else {
          // Сайт недоступен вообще (нет соединения, тайм-аут, DNS…): сообщаем настоящую причину.
          throw e;
        }
      }
      const status = response.status === 404 || response.status === 410 ? 404 : response.status;
      run(
        this.db,
        `INSERT INTO robots_cache (origin, fetched_at, status, body) VALUES (?, ?, ?, ?)
         ON CONFLICT(origin) DO UPDATE SET fetched_at = excluded.fetched_at, status = excluded.status, body = excluded.body`,
        origin, Date.now(), status, status === 404 ? '' : response.body,
      );
      row = { fetched_at: Date.now(), status, body: status === 404 ? '' : response.body };
    }

    const parsed = parseRobots(row.body);
    const delay = crawlDelaySeconds(parsed, ROBOTS_TOKEN);
    if (delay !== undefined) this.delays.set(url.host, delay);
    return parsed;
  }

  private async followRedirects(
    start: URL,
    kind: Kind,
    settings: Settings,
  ): Promise<{ response: RawResponse; finalUrl: string }> {
    let current = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (hop > 0) {
        this.assertNotBlocked(current, settings);
        await assertPublicHost(current.hostname, this.config.allowPrivateHosts);
        if (kind !== 'robots') await this.ensureAllowed(current, settings);
      }
      const interval = this.effectiveInterval(current.host, settings);
      const target = current;
      const response = await this.limiter.run(target.host, interval, () => this.rawRequest(target, kind, settings));

      if (response.location) {
        let next: URL;
        try {
          next = normalizeUrl(new URL(response.location, target).toString(), {
            allowPrivate: this.config.allowPrivateHosts,
          });
        } catch (e) {
          if (e instanceof AnalyzerError) throw e;
          throw new AnalyzerError('invalid_url', 'Сайт вернул некорректный адрес перенаправления');
        }
        current = next;
        continue;
      }
      return { response, finalUrl: current.toString() };
    }
    throw new AnalyzerError('too_many_redirects', 'Слишком много перенаправлений');
  }

  private async rawRequest(url: URL, kind: Kind, settings: Settings): Promise<RawResponse> {
    this.networkRequests += 1;
    const accept =
      kind === 'page'
        ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
        : kind === 'asset'
          ? 'text/css,*/*;q=0.5'
          : 'text/plain,*/*;q=0.5';
    const maxBytes = kind === 'robots' ? ROBOTS_MAX_BYTES : this.config.maxBodyBytes;
    const signal = AbortSignal.timeout(settings.fetchTimeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          'user-agent': USER_AGENT,
          accept,
          'accept-language': 'ru,uk;q=0.9,en;q=0.8',
        },
      });

      const status = res.status;
      if (status >= 300 && status < 400) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!location) throw new AnalyzerError('http_error', `Сайт ответил HTTP ${status} без адреса перенаправления`, { status });
        return { status, location, contentType: '', body: '', truncated: false };
      }
      if (status === 401 || status === 403 || status === 429) {
        await res.body?.cancel().catch(() => undefined);
        throw new AnalyzerError(
          'blocked',
          `Сайт ${url.host} отказал в доступе (HTTP ${status}). Анализатор не обходит ограничения доступа и защиту от ботов.`,
          { status },
        );
      }
      if (status >= 400) {
        // Защита от ботов иногда отвечает 5xx со страницей-заглушкой (например, 503 «Just a moment...»).
        // Читаем только начало ответа: если это заглушка, честно сообщаем о блокировке, а не об «ошибке сайта».
        let wall = false;
        if (kind === 'page' && res.body) {
          try {
            const reader = res.body.getReader();
            const { value } = await reader.read();
            await reader.cancel().catch(() => undefined);
            if (value) wall = looksLikeBotWall(decodeBody(value.subarray(0, 32 * 1024), res.headers.get('content-type') ?? ''), status);
          } catch {
            wall = false;
          }
        } else {
          await res.body?.cancel().catch(() => undefined);
        }
        if (wall) {
          throw new AnalyzerError(
            'blocked',
            `Сайт ${url.host} показывает проверку «вы не робот» (CAPTCHA или защита от ботов). Анализатор не обходит такие проверки.`,
            { status },
          );
        }
        throw new AnalyzerError('http_error', `Сайт ответил HTTP ${status}`, { status });
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (kind === 'page' && contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        await res.body?.cancel().catch(() => undefined);
        throw new AnalyzerError('unsupported_content', `Ожидалась HTML-страница, а сайт вернул ${contentType.split(';')[0]}`);
      }

      const chunks: Uint8Array[] = [];
      let size = 0;
      let truncated = false;
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            const keep = value.byteLength - (size - maxBytes);
            if (keep > 0) chunks.push(value.subarray(0, keep));
            truncated = true;
            await reader.cancel().catch(() => undefined);
            break;
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.byteLength;
      }
      const body = decodeBody(bytes, contentType);

      if (kind === 'page' && looksLikeBotWall(body, status)) {
        throw new AnalyzerError(
          'blocked',
          `Сайт ${url.host} показывает проверку «вы не робот» (CAPTCHA или защита от ботов). Анализатор не обходит такие проверки.`,
        );
      }
      return { status, location: null, contentType, body, truncated };
    } catch (e) {
      if (e instanceof AnalyzerError) throw e;
      throw mapNetworkError(e, url.host);
    }
  }
}
