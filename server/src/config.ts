import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень проекта (папка, где лежит package.json). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Имя, под которым анализатор представляется сайтам и ищет себя в robots.txt. */
export const ROBOTS_TOKEN = 'WebInspirationAnalyzer';
export const USER_AGENT = `${ROBOTS_TOKEN}/1.0 (portfolio research tool; respects robots.txt; contact: see project README)`;

/**
 * Читает файл .env и добавляет значения в process.env.
 * Уже заданные переменные окружения не перезаписываются.
 */
export function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export interface Config {
  port: number;
  host: string;
  adminToken: string;
  dataDir: string;
  dbPath: string;
  clientDist: string;

  braveKey: string;
  braveUrl: string;
  googleKey: string;
  googleCx: string;
  googleUrl: string;

  anthropicKey: string;
  anthropicUrl: string;
  aiModel: string;

  telegramToken: string;
  telegramChatId: string;
  telegramUrl: string;

  fetchMinIntervalMs: number;
  fetchTimeoutMs: number;
  cacheTtlHours: number;
  maxPagesPerAnalysis: number;
  maxBodyBytes: number;

  /** Только для тестов и локальной отладки: разрешает обращаться к localhost/частным сетям. */
  allowPrivateHosts: boolean;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback = ''): string {
  const raw = process.env[name];
  return raw === undefined ? fallback : raw.trim();
}

/** Собирает настройки из переменных окружения. Вызывается заново при каждом запуске/тесте. */
export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = str('DATA_DIR') || path.join(ROOT, 'data');
  const base: Config = {
    port: num('PORT', 8787),
    host: str('HOST', '127.0.0.1'),
    adminToken: str('ADMIN_TOKEN'),
    dataDir,
    dbPath: path.join(dataDir, 'analyzer.sqlite'),
    clientDist: path.join(ROOT, 'client', 'dist'),

    braveKey: str('BRAVE_API_KEY'),
    braveUrl: str('BRAVE_API_URL', 'https://api.search.brave.com/res/v1/web/search'),
    googleKey: str('GOOGLE_CSE_KEY'),
    googleCx: str('GOOGLE_CSE_CX'),
    googleUrl: str('GOOGLE_CSE_URL', 'https://www.googleapis.com/customsearch/v1'),

    anthropicKey: str('ANTHROPIC_API_KEY'),
    anthropicUrl: str('ANTHROPIC_API_URL', 'https://api.anthropic.com/v1/messages'),
    aiModel: str('AI_MODEL', 'claude-sonnet-5-5'),

    telegramToken: str('BOOKING_TELEGRAM_BOT_TOKEN'),
    telegramChatId: str('BOOKING_TELEGRAM_CHAT_ID'),
    telegramUrl: str('TELEGRAM_API_URL', 'https://api.telegram.org'),

    fetchMinIntervalMs: num('FETCH_MIN_INTERVAL_MS', 2000),
    fetchTimeoutMs: num('FETCH_TIMEOUT_MS', 10000),
    cacheTtlHours: num('CACHE_TTL_HOURS', 6),
    maxPagesPerAnalysis: num('MAX_PAGES_PER_ANALYSIS', 4),
    maxBodyBytes: num('MAX_BODY_BYTES', 2 * 1024 * 1024),

    allowPrivateHosts: str('ALLOW_PRIVATE_HOSTS') === '1',
  };
  return { ...base, ...overrides };
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}
