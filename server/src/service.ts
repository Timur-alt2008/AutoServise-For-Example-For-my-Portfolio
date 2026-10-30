import { analyzeSite, pickExtraLinks, pickStylesheets } from './analysis/extract.ts';
import { buildIdeas, evaluateCandidate } from './analysis/ideas.ts';
import type { FilteredIdea, IdeaCandidate } from './analysis/types.ts';
import { askAiForIdeas, isAiConfigured } from './ai.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { AnalyzerError, isBlockingCode } from './errors.ts';
import type { FetchedPage } from './net/fetcher.ts';
import { PageFetcher } from './net/fetcher.ts';
import { HostLimiter } from './net/limiter.ts';
import { normalizeUrl } from './net/safety.ts';
import type { AnalysisRow } from './store.ts';
import { createAnalysis, getAnalysisRow, markDone, markFailed, markRunning, recoverInterrupted, upsertIdeas } from './store.ts';
import type { Settings } from './settings.ts';
import { getSettings } from './settings.ts';

export interface PageIssue {
  url: string;
  code: string;
  message: string;
}

/** Всё, что мы сохраняем о завершённом анализе. */
export interface AnalysisResult {
  analysis: ReturnType<typeof analyzeSite>;
  filtered: FilteredIdea[];
  pageIssues: PageIssue[];
  stats: { pagesFetched: number; stylesheetsFetched: number; fromCache: number; ideasCreated: number; ideasUpdated: number };
  ai: { requested: boolean; used: boolean; error: string | null; ideas: number };
}

const CONCURRENCY = 2;

export class AnalysisService {
  readonly db: Db;
  readonly config: Config;
  readonly fetcher: PageFetcher;
  private queue: number[] = [];
  private active = 0;
  private idleWaiters: Array<() => void> = [];

  constructor(db: Db, config: Config, limiter: HostLimiter = new HostLimiter()) {
    this.db = db;
    this.config = config;
    this.fetcher = new PageFetcher(db, config, () => this.settings(), limiter);
    recoverInterrupted(db);
  }

  settings(): Settings {
    return getSettings(this.db, this.config);
  }

  /** Проверяет адрес и ставит анализ в очередь. Сеть при этом не используется. */
  enqueue(urlInput: string, opts: { useAi?: boolean; rerunOf?: number | null } = {}): AnalysisRow {
    const url = normalizeUrl(urlInput, { allowPrivate: this.config.allowPrivateHosts });
    const host = url.host.replace(/^www\./, '');
    const row = createAnalysis(this.db, url.toString(), host, !!opts.useAi, opts.rerunOf ?? null);
    this.queue.push(row.id);
    queueMicrotask(() => this.pump());
    return row;
  }

  rerun(id: number): AnalysisRow {
    const row = getAnalysisRow(this.db, id);
    if (!row) throw new AnalyzerError('not_found', 'Анализ не найден');
    if (row.status === 'queued' || row.status === 'running') {
      throw new AnalyzerError('invalid_transition', 'Этот анализ ещё выполняется');
    }
    return this.enqueue(row.url, { useAi: row.use_ai === 1, rerunOf: row.id });
  }

  /** Ждёт, пока очередь опустеет (нужно в тестах). */
  idle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private pump(): void {
    while (this.active < CONCURRENCY && this.queue.length) {
      const id = this.queue.shift()!;
      this.active++;
      void this.execute(id).finally(() => {
        this.active--;
        this.pump();
        if (this.active === 0 && this.queue.length === 0) {
          for (const w of this.idleWaiters.splice(0)) w();
        }
      });
    }
  }

  private async execute(id: number): Promise<void> {
    markRunning(this.db, id);
    const row = getAnalysisRow(this.db, id)!;
    try {
      const result = await this.analyze(row);
      markDone(this.db, id, result);
    } catch (e) {
      if (e instanceof AnalyzerError) {
        markFailed(this.db, id, isBlockingCode(e.code) ? 'blocked' : 'error', e.code, e.message);
      } else {
        markFailed(this.db, id, 'error', 'internal', `Непредвиденная ошибка: ${(e as Error).message}`);
      }
    }
  }

  private async analyze(row: AnalysisRow): Promise<AnalysisResult> {
    const settings = this.settings();
    const issues: PageIssue[] = [];
    let fromCache = 0;
    const note = (p: FetchedPage) => {
      if (p.fromCache) fromCache++;
    };

    // 1. Главная страница: если её нельзя прочитать, анализ завершается ошибкой.
    const main = await this.fetcher.fetchPage(row.url);
    note(main);
    const pages = [{ url: main.finalUrl, html: main.body }];

    // 2. Несколько связанных страниц того же сайта (услуги, цены, контакты…).
    for (const url of pickExtraLinks(main.finalUrl, main.body, settings.maxPagesPerAnalysis - 1)) {
      try {
        const p = await this.fetcher.fetchPage(url);
        note(p);
        pages.push({ url: p.finalUrl, html: p.body });
      } catch (e) {
        issues.push(toIssue(url, e));
      }
    }

    // 3. Таблицы стилей главной страницы (для цветов, шрифтов, кнопок).
    const sheets: Array<{ url: string; css: string }> = [];
    for (const url of pickStylesheets(main.finalUrl, main.body, 3)) {
      try {
        const s = await this.fetcher.fetchPage(url, 'asset');
        note(s);
        sheets.push({ url, css: s.body });
      } catch (e) {
        issues.push(toIssue(url, e));
      }
    }

    // 4. Анализ и идеи.
    const analysis = analyzeSite(pages, sheets);
    const source = { host: row.host, url: main.finalUrl };
    const built = buildIdeas(analysis, source);
    const ideas: IdeaCandidate[] = [...built.ideas];
    const filtered: FilteredIdea[] = [...built.filtered];

    // 5. По желанию — дополнительные идеи от ИИ (проходят тот же фильтр).
    const ai: AnalysisResult['ai'] = { requested: row.use_ai === 1, used: false, error: null, ideas: 0 };
    if (ai.requested) {
      if (!isAiConfigured(this.config)) {
        ai.error = 'ИИ-анализ не настроен (нет ANTHROPIC_API_KEY)';
      } else {
        try {
          const extra = await askAiForIdeas(this.config, analysis, [...built.ideas, ...built.filtered].map((i) => i.title));
          ai.used = true;
          for (const candidate of extra) {
            const verdict = evaluateCandidate(candidate);
            if (verdict.ok) {
              ideas.push(candidate);
              ai.ideas++;
            } else {
              filtered.push({
                key: candidate.key,
                title: candidate.title,
                kind: 'realism',
                reason: `Идея от ИИ не прошла фильтр реалистичности: ${verdict.failed.join('; ')}`,
                failedChecks: verdict.failed,
                evidence: candidate.evidence,
              });
            }
          }
        } catch (e) {
          ai.error = (e as Error).message;
        }
      }
    }

    // 6. Сохраняем идеи как «новые». Код сайта при этом не затрагивается.
    const saved = upsertIdeas(this.db, row.id, row.host, source.url, ideas);

    return {
      analysis,
      filtered,
      pageIssues: issues,
      stats: {
        pagesFetched: pages.length,
        stylesheetsFetched: sheets.length,
        fromCache,
        ideasCreated: saved.created,
        ideasUpdated: saved.updated,
      },
      ai,
    };
  }
}

function toIssue(url: string, e: unknown): PageIssue {
  if (e instanceof AnalyzerError) return { url, code: e.code, message: e.message };
  return { url, code: 'internal', message: (e as Error).message };
}
