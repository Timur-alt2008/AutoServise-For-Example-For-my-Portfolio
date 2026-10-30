import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from './api';
import type { AnalysisStatus, IdeaStatus, Presence, Scores, Verification } from './api';

/* ------------------------------------------------------------ загрузка данных */

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  /** Тихое обновление без индикатора загрузки (для опроса сервера) */
  refresh: () => void;
}

export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [silent, setSilent] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const ctl = new AbortController();
    if (!silent) setLoading(true);
    loaderRef
      .current(ctl.signal)
      .then((d) => {
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        setError(e instanceof ApiError ? e : new ApiError('error', (e as Error).message, 0));
        setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setSilent(false);
    setTick((t) => t + 1);
  }, []);
  const refresh = useCallback(() => {
    setSilent(true);
    setTick((t) => t + 1);
  }, []);
  return { data, error, loading, reload, refresh };
}

export function useInterval(callback: () => void, ms: number | null) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/* ----------------------------------------------------------------- форматирование */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Миллисекунды → секунды для показа: 2000 → «2», 400 → «0,4» */
export function fmtSeconds(ms: number): string {
  return (Math.round(ms / 100) / 10).toLocaleString('ru-RU');
}

/** Склонение по числу: plural(1, ['сайт','сайта','сайтов']) → «сайт» */
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

export const ANALYSIS_STATUS: Record<AnalysisStatus, { label: string; tone: string }> = {
  queued: { label: 'В очереди', tone: 'info' },
  running: { label: 'Выполняется', tone: 'info' },
  done: { label: 'Готово', tone: 'ok' },
  blocked: { label: 'Доступ запрещён', tone: 'warn' },
  error: { label: 'Ошибка', tone: 'bad' },
};

export const IDEA_STATUS: Record<IdeaStatus, { label: string; tone: string }> = {
  new: { label: 'Новая', tone: 'info' },
  approved: { label: 'Одобрена', tone: 'ok' },
  rejected: { label: 'Отклонена', tone: 'muted' },
  implemented: { label: 'Реализована', tone: 'done' },
};

export const PRESENCE: Record<Presence, { label: string; tone: string }> = {
  yes: { label: 'найдено', tone: 'ok' },
  likely: { label: 'вероятно', tone: 'warn' },
  no: { label: 'не найдено', tone: 'muted' },
};

/** Понятные пояснения к кодам ошибок сервера */
export const ERROR_HINTS: Record<string, string> = {
  robots_disallowed: 'Владелец сайта запретил автоматический доступ в файле robots.txt. Мы это правило соблюдаем и не обходим. Откройте сайт вручную в браузере.',
  robots_unreachable: 'Не удалось получить правила robots.txt (сайт блокирует запрос или недоступен). Без правил мы сайт не читаем.',
  blocked: 'Сайт показал проверку «вы не робот» или закрыл доступ. Мы не обходим CAPTCHA и защиту — изучите этот сайт вручную.',
  timeout: 'Сайт не ответил вовремя. Попробуйте повторить позже.',
  dns_error: 'Не удалось найти такой сайт. Проверьте адрес на опечатки.',
  connection_refused: 'Сайт не принимает соединение.',
  private_address: 'Адреса внутри локальной сети анализировать нельзя — это защита от ошибок и злоупотреблений.',
  invalid_url: 'Адрес указан неверно. Пример: https://example.com',
  unsupported_content: 'По этому адресу не веб-страница (HTML).',
  http_error: 'Сайт ответил ошибкой.',
  too_many_redirects: 'Слишком много перенаправлений.',
  interrupted: 'Анализ прервался при перезапуске сервера. Запустите его повторно.',
};

/* --------------------------------------------------------------------- элементы */

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`an-badge an-badge--${tone}`}>{children}</span>;
}

export function Spinner({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="an-loading" role="status">
      <span className="spinner spinner--dark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: ApiError | { message: string }; onRetry?: () => void }) {
  return (
    <div className="an-error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="an-empty">
      <h3 className="an-empty__title">{title}</h3>
      {children && <div className="an-empty__text">{children}</div>}
      {action && <div className="an-empty__action">{action}</div>}
    </div>
  );
}

/** Состояния «загрузка / ошибка / данные» для экранов с запросом */
export function Loadable<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error && !state.data) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  return <>{children(state.data)}</>;
}

const SCORE_LABELS: Array<[keyof Scores, string]> = [
  ['usefulness', 'Полезность'],
  ['relevance', 'Подходит проекту'],
  ['feasibility', 'Реализуемость'],
  ['visual', 'Визуальный эффект'],
];

export function ScoreBars({ scores }: { scores: Scores }) {
  return (
    <dl className="an-scores">
      {SCORE_LABELS.map(([key, label]) => (
        <div key={key} className="an-score">
          <dt>{label}</dt>
          <dd>
            <span className="an-score__bar" aria-hidden="true">
              <span style={{ width: `${(scores[key] / 5) * 100}%` }} />
            </span>
            <span className="an-score__val">{scores[key]}/5</span>
          </dd>
        </div>
      ))}
      <div className="an-score">
        <dt>Сложность</dt>
        <dd>
          <span className="an-score__bar an-score__bar--cx" aria-hidden="true">
            <span style={{ width: `${(scores.complexity / 5) * 100}%` }} />
          </span>
          <span className="an-score__val">{scores.complexity}/5</span>
        </dd>
      </div>
    </dl>
  );
}

export function VerificationBadge({ v }: { v: Verification }) {
  return v === 'needs_browser_check' ? <Badge tone="warn">требует браузерной проверки</Badge> : <Badge tone="muted">проверено по HTML</Badge>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="an-pagehead">
      <h1 className="an-h1">{title}</h1>
      {children && <p className="an-lead">{children}</p>}
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
