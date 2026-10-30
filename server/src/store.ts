import type { IdeaCandidate, IdeaStatus } from './analysis/types.ts';
import { IDEA_STATUSES } from './analysis/types.ts';
import { complexityLabel, scoreTotal } from './analysis/ideas.ts';
import type { Db } from './db.ts';
import { all, nowIso, one, run } from './db.ts';
import { AnalyzerError } from './errors.ts';

// ---------------------------------------------------------------------------
// Анализы
// ---------------------------------------------------------------------------

export interface AnalysisRow {
  id: number;
  url: string;
  host: string;
  status: 'queued' | 'running' | 'done' | 'blocked' | 'error';
  error_code: string | null;
  error_message: string | null;
  use_ai: number;
  rerun_of: number | null;
  result_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export function createAnalysis(db: Db, url: string, host: string, useAi: boolean, rerunOf: number | null = null): AnalysisRow {
  const { lastId } = run(
    db,
    'INSERT INTO analyses (url, host, status, use_ai, rerun_of, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    url, host, 'queued', useAi ? 1 : 0, rerunOf, nowIso(),
  );
  return getAnalysisRow(db, lastId)!;
}

export function getAnalysisRow(db: Db, id: number): AnalysisRow | undefined {
  return one<AnalysisRow>(db, 'SELECT * FROM analyses WHERE id = ?', id);
}

export function listAnalysisRows(db: Db, limit = 100): AnalysisRow[] {
  return all<AnalysisRow>(db, 'SELECT * FROM analyses ORDER BY id DESC LIMIT ?', limit);
}

export function markRunning(db: Db, id: number): void {
  run(db, "UPDATE analyses SET status = 'running', started_at = ?, error_code = NULL, error_message = NULL WHERE id = ?", nowIso(), id);
}

export function markDone(db: Db, id: number, result: unknown): void {
  run(db, "UPDATE analyses SET status = 'done', result_json = ?, finished_at = ? WHERE id = ?", JSON.stringify(result), nowIso(), id);
}

export function markFailed(db: Db, id: number, status: 'blocked' | 'error', code: string, message: string): void {
  run(db, 'UPDATE analyses SET status = ?, error_code = ?, error_message = ?, finished_at = ? WHERE id = ?', status, code, message, nowIso(), id);
}

export function deleteAnalysis(db: Db, id: number): boolean {
  // Идеи не удаляются вместе с анализом: решения пользователя (одобрено/отклонено) сохраняются.
  return run(db, 'DELETE FROM analyses WHERE id = ?', id).changes > 0;
}

export function recoverInterrupted(db: Db): number {
  return run(
    db,
    "UPDATE analyses SET status = 'error', error_code = 'interrupted', error_message = 'Анализ был прерван перезапуском сервера. Запустите его снова.', finished_at = ? WHERE status IN ('queued', 'running')",
    nowIso(),
  ).changes;
}

export function presentAnalysis(row: AnalysisRow, withResult: boolean): Record<string, unknown> {
  let result: unknown = null;
  if (withResult && row.result_json) {
    try {
      result = JSON.parse(row.result_json);
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    url: row.url,
    host: row.host,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    useAi: row.use_ai === 1,
    rerunOf: row.rerun_of,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: withResult ? result : undefined,
  };
}

// ---------------------------------------------------------------------------
// Идеи
// ---------------------------------------------------------------------------

interface IdeaRow {
  id: number;
  analysis_id: number | null;
  key: string;
  title: string;
  description: string;
  source_host: string;
  source_url: string;
  why_interesting: string;
  expected_benefit: string;
  recommendation: string;
  evidence_json: string;
  verification: string;
  score_usefulness: number;
  score_relevance: number;
  score_feasibility: number;
  score_visual: number;
  score_complexity: number;
  total_score: number;
  origin: string;
  status: IdeaStatus;
  note: string | null;
  created_at: string;
  status_changed_at: string | null;
}

interface TaskRow {
  id: number;
  idea_id: number;
  title: string;
  brief: string;
  steps_json: string;
  checks_json: string;
  status: 'open' | 'done' | 'cancelled';
  created_at: string;
  done_at: string | null;
}

/** Сохраняет найденные идеи. Статус уже известной идеи (одобрена/отклонена) при повторном анализе не сбрасывается. */
export function upsertIdeas(db: Db, analysisId: number, host: string, url: string, ideas: IdeaCandidate[]): { created: number; updated: number } {
  let created = 0;
  let updated = 0;
  for (const idea of ideas) {
    const existing = one<{ id: number }>(db, 'SELECT id FROM ideas WHERE key = ? AND source_host = ?', idea.key, host);
    const s = idea.scores;
    const total = scoreTotal(s);
    // Шаги и проверки храним вместе с доказательствами, чтобы не плодить колонки.
    const evidence = JSON.stringify({ evidence: idea.evidence, meta: { steps: idea.steps, checks: idea.checks } });
    if (existing) {
      run(
        db,
        `UPDATE ideas SET analysis_id = ?, source_url = ?, title = ?, description = ?, why_interesting = ?, expected_benefit = ?,
           recommendation = ?, evidence_json = ?, verification = ?, score_usefulness = ?, score_relevance = ?, score_feasibility = ?,
           score_visual = ?, score_complexity = ?, total_score = ? WHERE id = ?`,
        analysisId, url, idea.title, idea.description, idea.whyInteresting, idea.expectedBenefit, idea.recommendation, evidence,
        idea.verification, s.usefulness, s.relevance, s.feasibility, s.visual, s.complexity, total, existing.id,
      );
      updated++;
    } else {
      run(
        db,
        `INSERT INTO ideas (analysis_id, key, title, description, source_host, source_url, why_interesting, expected_benefit,
           recommendation, evidence_json, verification, score_usefulness, score_relevance, score_feasibility, score_visual,
           score_complexity, total_score, origin, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
        analysisId, idea.key, idea.title, idea.description, host, url, idea.whyInteresting, idea.expectedBenefit,
        idea.recommendation, evidence, idea.verification, s.usefulness, s.relevance, s.feasibility, s.visual, s.complexity,
        total, idea.origin, nowIso(),
      );
      created++;
    }
  }
  return { created, updated };
}

function parseEvidence(json: string): { evidence: string[]; steps: string[]; checks: string[] } {
  try {
    const v = JSON.parse(json) as { evidence?: string[]; meta?: { steps?: string[]; checks?: string[] } };
    return { evidence: v.evidence ?? [], steps: v.meta?.steps ?? [], checks: v.meta?.checks ?? [] };
  } catch {
    return { evidence: [], steps: [], checks: [] };
  }
}

export function presentIdea(row: IdeaRow, task?: TaskRow | null): Record<string, unknown> {
  const meta = parseEvidence(row.evidence_json);
  return {
    id: row.id,
    analysisId: row.analysis_id,
    key: row.key,
    title: row.title,
    description: row.description,
    sourceHost: row.source_host,
    sourceUrl: row.source_url,
    whyInteresting: row.why_interesting,
    expectedBenefit: row.expected_benefit,
    recommendation: row.recommendation,
    evidence: meta.evidence,
    verification: row.verification,
    scores: {
      usefulness: row.score_usefulness,
      relevance: row.score_relevance,
      feasibility: row.score_feasibility,
      visual: row.score_visual,
      complexity: row.score_complexity,
    },
    totalScore: row.total_score,
    complexityLabel: complexityLabel(row.score_complexity),
    origin: row.origin,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
    task: task ? presentTask(task) : null,
  };
}

export function presentTask(t: TaskRow): Record<string, unknown> {
  let steps: string[] = [];
  let checks: string[] = [];
  try {
    steps = JSON.parse(t.steps_json) as string[];
    checks = JSON.parse(t.checks_json) as string[];
  } catch {
    // оставляем пустые списки
  }
  return {
    id: t.id,
    ideaId: t.idea_id,
    title: t.title,
    brief: t.brief,
    steps,
    checks,
    status: t.status,
    createdAt: t.created_at,
    doneAt: t.done_at,
  };
}

export interface IdeaFilters {
  status?: string;
  q?: string;
  minScore?: number;
  complexity?: string;
  origin?: string;
  verification?: string;
  analysisId?: number;
  sort?: string;
}

export function listIdeas(db: Db, f: IdeaFilters = {}): Array<Record<string, unknown>> {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (f.status) {
    const list = f.status.split(',').filter((s) => (IDEA_STATUSES as string[]).includes(s));
    if (list.length) {
      where.push(`i.status IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (f.q) {
    where.push('(i.title LIKE ? OR i.description LIKE ? OR i.source_host LIKE ?)');
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like);
  }
  if (typeof f.minScore === 'number' && Number.isFinite(f.minScore)) {
    where.push('i.total_score >= ?');
    params.push(f.minScore);
  }
  if (f.complexity === 'простая') where.push('i.score_complexity <= 2');
  if (f.complexity === 'средняя') where.push('i.score_complexity = 3');
  if (f.complexity === 'сложная') where.push('i.score_complexity >= 4');
  if (f.origin === 'rules' || f.origin === 'ai') {
    where.push('i.origin = ?');
    params.push(f.origin);
  }
  if (f.verification === 'static' || f.verification === 'needs_browser_check') {
    where.push('i.verification = ?');
    params.push(f.verification);
  }
  if (typeof f.analysisId === 'number') {
    where.push('i.analysis_id = ?');
    params.push(f.analysisId);
  }
  const order =
    f.sort === 'newest' ? 'i.id DESC' : f.sort === 'complexity' ? 'i.score_complexity ASC, i.total_score DESC' : 'i.total_score DESC, i.id DESC';
  const rows = all<IdeaRow>(db, `SELECT i.* FROM ideas i ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order} LIMIT 500`, ...params);
  return rows.map((r) => presentIdea(r, getTaskRow(db, r.id)));
}

export function getIdeaRow(db: Db, id: number): IdeaRow | undefined {
  return one<IdeaRow>(db, 'SELECT * FROM ideas WHERE id = ?', id);
}

export function getTaskRow(db: Db, ideaId: number): TaskRow | null {
  return one<TaskRow>(db, 'SELECT * FROM tasks WHERE idea_id = ?', ideaId) ?? null;
}

export function listTasks(db: Db, status?: string): Array<Record<string, unknown>> {
  const rows = status
    ? all<TaskRow>(db, 'SELECT * FROM tasks WHERE status = ? ORDER BY id DESC', status)
    : all<TaskRow>(db, 'SELECT * FROM tasks ORDER BY id DESC');
  return rows.map(presentTask);
}

const TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  new: ['approved', 'rejected'],
  approved: ['implemented', 'rejected', 'new'],
  rejected: ['new'],
  implemented: ['approved'],
};

/**
 * Меняет статус идеи.
 * ВАЖНО: эта функция только записывает решение и создаёт задачу в базе анализатора.
 * Код сайта она не меняет — изменения вносятся отдельно и только после одобрения.
 */
export function setIdeaStatus(db: Db, id: number, status: string, note?: string): Record<string, unknown> {
  if (!(IDEA_STATUSES as string[]).includes(status)) {
    throw new AnalyzerError('bad_request', `Неизвестный статус: ${status}`);
  }
  const idea = getIdeaRow(db, id);
  if (!idea) throw new AnalyzerError('not_found', 'Идея не найдена');
  const target = status as IdeaStatus;
  if (idea.status !== target && !TRANSITIONS[idea.status].includes(target)) {
    throw new AnalyzerError('invalid_transition', `Нельзя перевести идею из «${idea.status}» в «${target}»`);
  }
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) : null;
  run(db, 'UPDATE ideas SET status = ?, note = COALESCE(?, note), status_changed_at = ? WHERE id = ?', target, cleanNote || null, nowIso(), id);

  const meta = parseEvidence(idea.evidence_json);
  const task = getTaskRow(db, id);
  if (target === 'approved') {
    if (!task) {
      const brief = [
        `Идея: ${idea.title}`,
        `Источник: ${idea.source_url}`,
        `Что это: ${idea.description}`,
        `Рекомендация: ${idea.recommendation}`,
        'Изменения вносятся в код сайта вручную (или по отдельной команде) — анализатор сам ничего не меняет.',
      ].join('\n');
      run(
        db,
        'INSERT INTO tasks (idea_id, title, brief, steps_json, checks_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, `Внедрить: ${idea.title}`, brief, JSON.stringify(meta.steps), JSON.stringify(meta.checks), 'open', nowIso(),
      );
    } else {
      run(db, "UPDATE tasks SET status = 'open', done_at = NULL WHERE id = ?", task.id);
    }
  } else if (target === 'implemented') {
    if (task) run(db, "UPDATE tasks SET status = 'done', done_at = ? WHERE id = ?", nowIso(), task.id);
  } else if (task) {
    run(db, "UPDATE tasks SET status = 'cancelled' WHERE id = ?", task.id);
  }
  return presentIdea(getIdeaRow(db, id)!, getTaskRow(db, id));
}

// ---------------------------------------------------------------------------
// Статистика для панели
// ---------------------------------------------------------------------------

export function dashboardStats(db: Db): Record<string, unknown> {
  const ideaCounts: Record<string, number> = { new: 0, approved: 0, rejected: 0, implemented: 0 };
  for (const r of all<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) AS n FROM ideas GROUP BY status')) {
    ideaCounts[r.status] = Number(r.n);
  }
  const analysisCounts: Record<string, number> = { queued: 0, running: 0, done: 0, blocked: 0, error: 0 };
  for (const r of all<{ status: string; n: number }>(db, 'SELECT status, COUNT(*) AS n FROM analyses GROUP BY status')) {
    analysisCounts[r.status] = Number(r.n);
  }
  const sites = one<{ n: number }>(db, 'SELECT COUNT(DISTINCT host) AS n FROM analyses WHERE status = ?', 'done');
  const openTasks = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tasks WHERE status = 'open'");
  return {
    ideas: ideaCounts,
    analyses: analysisCounts,
    sitesAnalyzed: Number(sites?.n ?? 0),
    openTasks: Number(openTasks?.n ?? 0),
    top: listIdeas(db, { status: 'new', sort: 'score' }).slice(0, 3),
  };
}
