import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { all, run } from './db.ts';
import { AnalyzerError } from './errors.ts';

/** Настройки, которые можно менять из панели. Значения по умолчанию берутся из .env. */
export interface Settings {
  /** Минимальная пауза между запросами к одному сайту, мс. */
  fetchMinIntervalMs: number;
  fetchTimeoutMs: number;
  cacheTtlHours: number;
  maxPagesPerAnalysis: number;
  /** Домены, которые анализатор никогда не открывает. */
  blockedDomains: string[];
  /** Всегда true: проверку robots.txt отключить нельзя. */
  respectRobots: true;
}

export const LIMITS = {
  fetchMinIntervalMs: { min: 1000, max: 30000 },
  fetchTimeoutMs: { min: 3000, max: 30000 },
  cacheTtlHours: { min: 0, max: 168 },
  maxPagesPerAnalysis: { min: 1, max: 8 },
} as const;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function defaultSettings(config: Config): Settings {
  // Нижняя граница паузы нужна, чтобы настройки (или .env) не позволяли «долбить» чужие сайты.
  // Для тестов её можно снизить через allowPrivateHosts.
  const minInterval = config.allowPrivateHosts ? 0 : LIMITS.fetchMinIntervalMs.min;
  return {
    fetchMinIntervalMs: clamp(config.fetchMinIntervalMs, minInterval, LIMITS.fetchMinIntervalMs.max),
    fetchTimeoutMs: clamp(config.fetchTimeoutMs, config.allowPrivateHosts ? 50 : LIMITS.fetchTimeoutMs.min, LIMITS.fetchTimeoutMs.max),
    cacheTtlHours: clamp(config.cacheTtlHours, LIMITS.cacheTtlHours.min, LIMITS.cacheTtlHours.max),
    maxPagesPerAnalysis: clamp(config.maxPagesPerAnalysis, LIMITS.maxPagesPerAnalysis.min, LIMITS.maxPagesPerAnalysis.max),
    blockedDomains: [],
    respectRobots: true,
  };
}

export function getSettings(db: Db, config: Config): Settings {
  const s = defaultSettings(config);
  const rows = all<{ key: string; value: string }>(db, 'SELECT key, value FROM settings');
  for (const row of rows) {
    try {
      const v = JSON.parse(row.value) as unknown;
      if (row.key === 'fetchMinIntervalMs' && typeof v === 'number') s.fetchMinIntervalMs = v;
      if (row.key === 'fetchTimeoutMs' && typeof v === 'number') s.fetchTimeoutMs = v;
      if (row.key === 'cacheTtlHours' && typeof v === 'number') s.cacheTtlHours = v;
      if (row.key === 'maxPagesPerAnalysis' && typeof v === 'number') s.maxPagesPerAnalysis = v;
      if (row.key === 'blockedDomains' && Array.isArray(v)) {
        s.blockedDomains = v.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      // Испорченное значение игнорируем и остаёмся на настройках по умолчанию.
    }
  }
  return s;
}

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
}

function readNumber(body: Record<string, unknown>, key: keyof typeof LIMITS, config: Config): number | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new AnalyzerError('bad_request', `Поле ${key} должно быть числом`);
  }
  const { min, max } = LIMITS[key];
  const floor = config.allowPrivateHosts && (key === 'fetchMinIntervalMs' || key === 'fetchTimeoutMs') ? 0 : min;
  if (raw < floor || raw > max) {
    throw new AnalyzerError('bad_request', `Поле ${key} должно быть от ${min} до ${max}`);
  }
  return Math.round(raw);
}

export function updateSettings(db: Db, config: Config, body: unknown): Settings {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AnalyzerError('bad_request', 'Ожидается объект с настройками');
  }
  const input = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  for (const key of ['fetchMinIntervalMs', 'fetchTimeoutMs', 'cacheTtlHours', 'maxPagesPerAnalysis'] as const) {
    const v = readNumber(input, key, config);
    if (v !== undefined) updates[key] = v;
  }
  if ('blockedDomains' in input) {
    const raw = input.blockedDomains;
    if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
      throw new AnalyzerError('bad_request', 'blockedDomains должен быть списком строк');
    }
    const cleaned = [...new Set((raw as string[]).map(normalizeDomain).filter(Boolean))].slice(0, 200);
    updates.blockedDomains = cleaned;
  }
  if ('respectRobots' in input && input.respectRobots !== true) {
    throw new AnalyzerError('bad_request', 'Проверку robots.txt отключить нельзя');
  }

  for (const [key, value] of Object.entries(updates)) {
    run(db, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
  }
  return getSettings(db, config);
}

export function isDomainBlocked(settings: Settings, hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return settings.blockedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}
