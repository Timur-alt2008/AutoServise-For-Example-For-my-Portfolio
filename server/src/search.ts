import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { all, nowIso, one, run } from './db.ts';
import { AnalyzerError } from './errors.ts';
import type { Settings } from './settings.ts';
import { isDomainBlocked } from './settings.ts';

/** Запросы из ТЗ для поиска референсов. */
export const SEARCH_PRESETS = [
  'Auto repair website design',
  'Car service booking website',
  'Auto mechanic service website',
  'Vehicle diagnostics website',
  'Automotive workshop website',
  'Автосервис запись онлайн',
  'СТО цены услуги сайт',
  'Сайт диагностики автомобиля',
];

export type SearchProvider = 'brave' | 'google';

export function configuredProviders(config: Config): SearchProvider[] {
  const out: SearchProvider[] = [];
  if (config.braveKey) out.push('brave');
  if (config.googleKey && config.googleCx) out.push('google');
  return out;
}

/** Сайты, которые не являются сайтами автосервисов: соцсети, каталоги, энциклопедии. */
const NOT_A_SERVICE_SITE =
  /(^|\.)(facebook|instagram|youtube|youtu|tiktok|pinterest|reddit|linkedin|twitter|x|vk|ok|t|telegram|wikipedia|wikihow|quora|yelp|tripadvisor|2gis|olx|google|bing|yandex|amazon|ebay|aliexpress|behance|dribbble|medium|github|apple|play\.google)\./i;

export interface SearchHit {
  title: string;
  url: string;
  host: string;
  snippet: string;
}

export function parseBrave(json: unknown): Array<{ title: string; url: string; snippet: string }> {
  const results = (json as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } })?.web?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => typeof r?.url === 'string')
    .map((r) => ({ title: String(r.title ?? ''), url: String(r.url), snippet: String(r.description ?? '') }));
}

export function parseGoogle(json: unknown): Array<{ title: string; url: string; snippet: string }> {
  const items = (json as { items?: Array<{ title?: string; link?: string; snippet?: string }> })?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r) => typeof r?.link === 'string')
    .map((r) => ({ title: String(r.title ?? ''), url: String(r.link), snippet: String(r.snippet ?? '') }));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
}

let lastSearchAt = 0;
const SEARCH_MIN_INTERVAL_MS = 1100;

export async function searchReferences(
  db: Db,
  config: Config,
  settings: Settings,
  query: string,
  providerWanted?: string,
): Promise<{ provider: SearchProvider; cached: boolean; results: Array<SearchHit & { id: number }> }> {
  const q = query.trim();
  if (q.length < 3 || q.length > 200) throw new AnalyzerError('bad_request', 'Запрос должен быть от 3 до 200 символов');

  const providers = configuredProviders(config);
  if (!providers.length) {
    throw new AnalyzerError(
      'search_not_configured',
      'Автоматический поиск не настроен: в файле .env нет ключа BRAVE_API_KEY (или GOOGLE_CSE_KEY и GOOGLE_CSE_CX). Добавьте адреса сайтов вручную на вкладке «Добавить URL».',
    );
  }
  const provider = (providers as string[]).includes(providerWanted ?? '') ? (providerWanted as SearchProvider) : providers[0];

  // Кэш на 24 часа, чтобы не тратить лимиты поискового API
  const cached = one<{ n: number; newest: string }>(
    db,
    'SELECT COUNT(*) AS n, MAX(created_at) AS newest FROM search_results WHERE provider = ? AND query = ?',
    provider, q,
  );
  if (cached && Number(cached.n) > 0 && Date.now() - Date.parse(cached.newest) < 24 * 3600 * 1000) {
    return { provider, cached: true, results: listStoredResults(db, provider, q) };
  }

  const wait = lastSearchAt + SEARCH_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearchAt = Date.now();

  let raw: Array<{ title: string; url: string; snippet: string }>;
  try {
    if (provider === 'brave') {
      const url = new URL(config.braveUrl);
      url.searchParams.set('q', q);
      url.searchParams.set('count', '10');
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { accept: 'application/json', 'x-subscription-token': config.braveKey },
      });
      if (!res.ok) throw new AnalyzerError('search_failed', `Поисковый сервис ответил ошибкой HTTP ${res.status}`);
      raw = parseBrave(await res.json());
    } else {
      const url = new URL(config.googleUrl);
      url.searchParams.set('key', config.googleKey);
      url.searchParams.set('cx', config.googleCx);
      url.searchParams.set('q', q);
      url.searchParams.set('num', '10');
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new AnalyzerError('search_failed', `Поисковый сервис ответил ошибкой HTTP ${res.status}`);
      raw = parseGoogle(await res.json());
    }
  } catch (e) {
    if (e instanceof AnalyzerError) throw e;
    throw new AnalyzerError('search_failed', `Не удалось выполнить поиск: ${(e as Error).message}`);
  }

  const seen = new Set<string>();
  for (const r of raw) {
    let u: URL;
    try {
      u = new URL(r.url);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.replace(/^www\./, '');
    if (NOT_A_SERVICE_SITE.test(`${host}.`) || isDomainBlocked(settings, host)) continue;
    // Анализируем главную страницу сайта, а не случайную внутреннюю
    const home = `${u.protocol}//${u.host}/`;
    if (seen.has(host)) continue;
    seen.add(host);
    run(
      db,
      'INSERT OR IGNORE INTO search_results (provider, query, title, url, host, snippet, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      provider, q, stripTags(r.title).slice(0, 200), home, host, stripTags(r.snippet).slice(0, 300), nowIso(),
    );
  }
  return { provider, cached: false, results: listStoredResults(db, provider, q) };
}

export function listStoredResults(db: Db, provider: string, query: string): Array<SearchHit & { id: number }> {
  return all<{ id: number; title: string; url: string; host: string; snippet: string }>(
    db,
    'SELECT id, title, url, host, snippet FROM search_results WHERE provider = ? AND query = ? ORDER BY id',
    provider, query,
  );
}

export function getSearchResult(db: Db, id: number): { id: number; url: string; host: string } | undefined {
  return one<{ id: number; url: string; host: string }>(db, 'SELECT id, url, host FROM search_results WHERE id = ?', id);
}
