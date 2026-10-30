/**
 * Клиент для API анализатора (server/src/app.ts).
 * Все запросы идут на тот же адрес (/api). В режиме разработки Vite пересылает их на сервер.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const TOKEN_KEY = 'analyzer-admin-token';

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим браузера — токен просто не запомнится */
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['x-analyzer-client'] = '1';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('network', 'Нет связи с сервером анализатора. Он запущен? (команда npm run dev)', 0);
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (err?.message) throw new ApiError(err.code ?? 'error', err.message, res.status);
    if (res.status >= 500 || res.status === 404 || res.status === 0) {
      throw new ApiError('network', 'Сервер анализатора не отвечает. Проверьте, что он запущен (npm run dev).', res.status);
    }
    throw new ApiError('error', `Ошибка запроса (HTTP ${res.status})`, res.status);
  }
  if (data === null) throw new ApiError('network', 'Сервер вернул неожиданный ответ. Проверьте, что запущен сервер анализатора.', res.status);
  return data as T;
}

/* ------------------------------------------------------------------ Типы ответов */

export type AnalysisStatus = 'queued' | 'running' | 'done' | 'blocked' | 'error';
export type IdeaStatus = 'new' | 'approved' | 'rejected' | 'implemented';
export type Presence = 'yes' | 'likely' | 'no';
export type Verification = 'static' | 'needs_browser_check';

export interface Settings {
  fetchMinIntervalMs: number;
  fetchTimeoutMs: number;
  cacheTtlHours: number;
  maxPagesPerAnalysis: number;
  blockedDomains: string[];
  respectRobots: true;
}

export interface Limits {
  fetchMinIntervalMs: { min: number; max: number };
  fetchTimeoutMs: { min: number; max: number };
  cacheTtlHours: { min: number; max: number };
  maxPagesPerAnalysis: { min: number; max: number };
}

export interface AppConfig {
  search: { configured: boolean; providers: string[]; presets: string[] };
  ai: { configured: boolean; model: string | null };
  booking: { configured: boolean };
  settings: Settings;
  limits: Limits;
  secured: boolean;
}

export interface Scores {
  usefulness: number;
  relevance: number;
  feasibility: number;
  visual: number;
  complexity: number;
}

export interface Task {
  id: number;
  ideaId: number;
  title: string;
  brief: string;
  steps: string[];
  checks: string[];
  status: 'open' | 'done' | 'cancelled';
  createdAt: string;
  doneAt: string | null;
}

export interface Idea {
  id: number;
  analysisId: number | null;
  key: string;
  title: string;
  description: string;
  sourceHost: string;
  sourceUrl: string;
  whyInteresting: string;
  expectedBenefit: string;
  recommendation: string;
  evidence: string[];
  verification: Verification;
  scores: Scores;
  totalScore: number;
  complexityLabel: string;
  origin: 'rules' | 'ai';
  status: IdeaStatus;
  note: string | null;
  createdAt: string;
  statusChangedAt: string;
  task: Task | null;
}

export interface AnalysisSummary {
  id: number;
  url: string;
  host: string;
  status: AnalysisStatus;
  errorCode: string | null;
  errorMessage: string | null;
  useAi: boolean;
  rerunOf: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface FeatureFinding {
  present: Presence;
  verification: Verification;
  evidence: string[];
}

export interface SiteAnalysis {
  analyzedPages: Array<{ url: string; title: string }>;
  meta: { title: string; description: string; lang: string; themeColor: string; canonical: string; hasViewport: boolean; hasOgImage: boolean; jsonLdTypes: string[] };
  structure: {
    h1: string[];
    h2: string[];
    nav: { items: Array<{ text: string; href: string }>; mobileMenuHint: boolean };
    sectionsCount: number;
    services: { detected: boolean; items: string[] };
    prices: { presentation: 'listed' | 'from' | 'on_request' | 'none'; mentions: string[] };
    forms: { count: number; fields: string[]; summaries: string[] };
    contacts: { phoneLinks: number; hasEmail: boolean; hasAddress: boolean; hasWorkingHours: boolean };
  };
  design: {
    colors: Array<{ hex: string; count: number }>;
    accents: string[];
    fonts: string[];
    fontProviders: string[];
    hero: { found: boolean; hasMedia: boolean; hasH1: boolean; ctaTexts: string[]; layoutHint: string };
    layout: { gridMentions: number; cardMentions: number; usesCssGrid: boolean; usesFlex: boolean; images: number; lazyImages: number; responsiveImages: boolean };
    buttons: { count: number; hints: string[] };
    motion: { transitions: boolean; keyframes: number; libraries: string[]; verification: 'needs_browser_check' };
  };
  features: Record<string, FeatureFinding>;
  technical: { scripts: number; frameworks: string[]; internalLinks: number; externalLinks: number; externalHosts: string[]; hasSitemapHint: boolean };
  rejectedPatterns: Array<{ pattern: string; reason: string; evidence: string }>;
}

export interface FilteredIdea {
  key: string;
  title: string;
  kind: 'already_in_project' | 'realism';
  reason: string;
  failedChecks: string[];
  evidence: string[];
}

export interface AnalysisResult {
  analysis: SiteAnalysis;
  filtered: FilteredIdea[];
  pageIssues: Array<{ url: string; code: string; message: string }>;
  stats: { pagesFetched: number; stylesheetsFetched: number; fromCache: number; ideasCreated: number; ideasUpdated: number };
  ai: { requested: boolean; used: boolean; error: string | null; ideas: number };
}

export interface AnalysisDetail extends AnalysisSummary {
  result: AnalysisResult | null;
}

export interface Stats {
  ideas: Record<IdeaStatus, number>;
  analyses: Record<AnalysisStatus, number>;
  sitesAnalyzed: number;
  openTasks: number;
  top: Idea[];
}

export interface SearchHit {
  id: number;
  title: string;
  url: string;
  host: string;
  snippet: string;
}

export const FEATURE_LABELS: Record<string, string> = {
  call_button: 'Кнопка звонка',
  online_booking: 'Онлайн-запись',
  estimate_request: 'Запрос предварительной стоимости',
  vehicle_selector: 'Выбор автомобиля (марка/модель/год)',
  service_filters: 'Фильтры услуг',
  gallery: 'Галерея работ',
  before_after: 'Фото «до и после»',
  faq: 'Блок вопросов и ответов (FAQ)',
  map: 'Карта и маршрут',
  feedback_form: 'Форма обратной связи',
  stepwise_flow: 'Пошаговый сценарий («как мы работаем»)',
  sticky_cta: 'Закреплённая кнопка действия',
  messenger_links: 'Мессенджеры (Telegram, WhatsApp, Viber)',
  calculator: 'Калькулятор стоимости',
  reviews: 'Отзывы',
  price_list: 'Прайс-лист',
  working_hours: 'График работы',
  video: 'Видео',
  plan_comparison: 'Сравнение вариантов обслуживания',
  service_pages: 'Отдельные страницы услуг',
};
