import { STANDARD_CHECKS, TEMPLATES } from './catalog.ts';
import type { FilteredIdea, IdeaCandidate, RealismChecks, Scores, SiteAnalysis } from './types.ts';
import { FEATURE_LABELS, REALISM_QUESTIONS } from './types.ts';

/** Слова, по которым идея отбрасывается как «фантастика» (требование ТЗ). */
export const FORBIDDEN_STYLE =
  /голограмм|hologra|псевдо-?3d|3d[- ]интерфейс|неонов|neon|космическ|футуристич|киберпанк|cyberpunk|частиц[аы] |particles|glitch|глитч/i;

/** Итоговая оценка 0–100 по пяти параметрам ТЗ. Сложность считается «наоборот»: проще — лучше. */
export function scoreTotal(s: Scores): number {
  const raw = s.usefulness * 0.3 + s.relevance * 0.2 + s.feasibility * 0.2 + s.visual * 0.15 + (6 - s.complexity) * 0.15;
  return Math.round((raw / 5) * 100);
}

export function complexityLabel(complexity: number): 'простая' | 'средняя' | 'сложная' {
  return complexity <= 2 ? 'простая' : complexity === 3 ? 'средняя' : 'сложная';
}

export function failedRealismChecks(r: RealismChecks): string[] {
  return (Object.keys(REALISM_QUESTIONS) as Array<keyof RealismChecks>).filter((k) => !r[k]).map((k) => REALISM_QUESTIONS[k]);
}

export interface Evaluation {
  ok: boolean;
  failed: string[];
}

/** Фильтр реалистичности: восемь вопросов + проверка на «фантастику». */
export function evaluateCandidate(c: Pick<IdeaCandidate, 'title' | 'description' | 'realism'>): Evaluation {
  const failed = failedRealismChecks(c.realism);
  if (FORBIDDEN_STYLE.test(`${c.title} ${c.description}`)) {
    failed.push(REALISM_QUESTIONS.matchesBrandStyle);
  }
  return { ok: failed.length === 0, failed: [...new Set(failed)] };
}

export interface IdeaSource {
  host: string;
  url: string;
}

export interface BuildResult {
  ideas: IdeaCandidate[];
  filtered: FilteredIdea[];
}

/**
 * Превращает результат анализа страницы в список идей.
 * Идея предлагается только если её признак найден на сайте-источнике.
 */
export function buildIdeas(analysis: SiteAnalysis, source: IdeaSource): BuildResult {
  const ideas: IdeaCandidate[] = [];
  const filtered: FilteredIdea[] = [];
  const seen = new Set<string>();

  for (const t of TEMPLATES) {
    const f = analysis.features[t.trigger];
    if (!f || f.present === 'no') continue;
    if (t.triggerEvidence && !f.evidence.some((e) => t.triggerEvidence!.test(e))) continue;
    if (seen.has(t.key)) continue;
    seen.add(t.key);

    if (t.alreadyInProject) {
      filtered.push({
        key: t.key,
        title: t.title,
        kind: 'already_in_project',
        reason: t.alreadyInProject,
        failedChecks: [],
        evidence: f.evidence,
      });
      continue;
    }

    const evaluation = evaluateCandidate({ title: t.title, description: t.description, realism: t.realism });
    if (!evaluation.ok) {
      filtered.push({
        key: t.key,
        title: t.title,
        kind: 'realism',
        reason: t.realismNote ?? `Не прошла фильтр реалистичности: ${evaluation.failed.join('; ')}`,
        failedChecks: evaluation.failed,
        evidence: f.evidence,
      });
      continue;
    }

    const browserNote =
      f.verification === 'needs_browser_check'
        ? 'Сначала откройте страницу в браузере и посмотрите, как это работает: по HTML проверить поведение нельзя. '
        : '';
    const confidence = f.present === 'likely' ? ' (признаки косвенные)' : '';

    ideas.push({
      key: t.key,
      title: t.title,
      description: t.description,
      whyInteresting: `На сайте ${source.host} найдено: ${FEATURE_LABELS[t.trigger]}${confidence}. ${t.problem}`,
      expectedBenefit: t.benefit,
      recommendation: `${browserNote}${t.recommendation}`.trim(),
      scores: { ...t.scores },
      evidence: f.evidence,
      verification: f.verification,
      origin: 'rules',
      steps: t.steps,
      checks: STANDARD_CHECKS,
      realism: t.realism,
    });
  }

  ideas.sort((a, b) => scoreTotal(b.scores) - scoreTotal(a.scores));
  return { ideas, filtered };
}
