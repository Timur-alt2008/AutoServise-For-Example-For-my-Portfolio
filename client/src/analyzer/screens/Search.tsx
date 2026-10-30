import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { AnalysisSummary, AppConfig, SearchHit } from '../api';
import { ANALYSIS_STATUS, Badge, Empty, ERROR_HINTS, ErrorBox, PageTitle, Spinner, useAsync, useInterval } from '../ui';

/** Живой статус запущенного анализа: обновляется, пока он идёт, и показывает итог. */
function RunStatus({ id, onFinished }: { id: number; onFinished: () => void }) {
  const state = useAsync((signal) => api<{ analysis: AnalysisSummary }>(`/api/analyses/${id}`, { signal }), [id]);
  const a = state.data?.analysis;
  const running = !a || a.status === 'queued' || a.status === 'running';
  useInterval(() => state.refresh(), running && !state.error ? 1500 : null);
  const wasRunning = useRef(true);
  useEffect(() => {
    if (!running && wasRunning.current) {
      wasRunning.current = false;
      onFinished();
    }
  }, [running, onFinished]);
  const st = ANALYSIS_STATUS[a?.status ?? 'queued'];
  return (
    <>
      <span className="an-row__status">
        {running && <span className="spinner spinner--dark" aria-hidden="true" />}
        <Badge tone={st.tone}>{st.label}</Badge>
      </span>
      <a className="an-link-btn" href={`#/analyzer/history/${id}`}>
        {a && !running ? 'Результат' : 'Открыть'}
      </a>
    </>
  );
}

export function Search({ config, onChanged }: { config: AppConfig; onChanged: () => void }) {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState(config.search.providers[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [results, setResults] = useState<{ hits: SearchHit[]; cached: boolean; provider: string; query: string } | null>(null);
  const [started, setStarted] = useState<Record<number, { id?: number; error?: string; busy?: boolean }>>({});

  if (!config.search.configured) {
    return (
      <>
        <PageTitle title="Найти референсы">Режим B: поиск сайтов по тематическим запросам через поисковый API.</PageTitle>
        <div className="an-notconfigured" role="status">
          <h2 className="an-h2">Автоматический поиск не настроен</h2>
          <p>
            Для поиска нужен ключ поискового сервиса. Мы не подставляем «ненастоящие» результаты, поэтому без ключа поиск выключен. Пока вы можете добавлять сайты вручную.
          </p>
          <ol className="an-list an-list--num">
            <li>
              Получите ключ: <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer">Brave Search API</a> (есть бесплатный тариф) или{' '}
              <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noopener noreferrer">Google Programmable Search</a>.
            </li>
            <li>Откройте файл <code>.env</code> в папке проекта и впишите ключ: <code>BRAVE_API_KEY=ваш_ключ</code> (для Google — <code>GOOGLE_CSE_KEY</code> и <code>GOOGLE_CSE_CX</code>).</li>
            <li>Перезапустите проект (закройте окно и запустите <code>start.bat</code> снова).</li>
          </ol>
          <p className="an-hint">Ключ хранится только на вашем компьютере в файле .env и никогда не попадает в браузер.</p>
          <a className="btn btn--primary btn--sm" href="#/analyzer/add">
            Добавить сайты вручную
          </a>
        </div>
        <section className="an-section">
          <h2 className="an-h3">Запросы из технического задания</h2>
          <ul className="an-chips an-chips--static">
            {config.search.presets.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setError(new ApiError('bad_request', 'Введите запрос — не короче трёх символов', 400));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ provider: string; cached: boolean; results: SearchHit[] }>('/api/search', { method: 'POST', body: { query: q, provider } });
      setResults({ hits: res.results, cached: res.cached, provider: res.provider, query: q });
      setStarted({});
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('error', 'Не удалось выполнить поиск', 0));
    } finally {
      setLoading(false);
    }
  }

  async function analyze(hit: SearchHit) {
    setStarted((s) => ({ ...s, [hit.id]: { busy: true } }));
    try {
      const res = await api<{ analysis: AnalysisSummary }>(`/api/search/results/${hit.id}/analyze`, { method: 'POST' });
      setStarted((s) => ({ ...s, [hit.id]: { id: res.analysis.id } }));
      onChanged();
    } catch (err) {
      const msg = err instanceof ApiError ? (ERROR_HINTS[err.code] ?? err.message) : 'Не удалось запустить анализ';
      setStarted((s) => ({ ...s, [hit.id]: { error: msg } }));
    }
  }

  return (
    <>
      <PageTitle title="Найти референсы">
        Режим B: поиск сайтов через поисковый API ({config.search.providers.join(', ')}). Результаты сохраняются на 24 часа, чтобы не тратить лимиты.
      </PageTitle>

      <form className="an-card" onSubmit={onSubmit} noValidate>
        <div className="an-field">
          <label htmlFor="q">Поисковый запрос</label>
          <input id="q" type="text" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} placeholder="Например: Car service booking website" />
        </div>
        <div className="an-presets" role="group" aria-label="Готовые запросы">
          {config.search.presets.map((p) => (
            <button key={p} type="button" className="an-chip" onClick={() => setQuery(p)}>
              {p}
            </button>
          ))}
        </div>
        {config.search.providers.length > 1 && (
          <div className="an-field an-field--inline">
            <label htmlFor="prov">Поисковый сервис</label>
            <select id="prov" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {config.search.providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Ищем…' : 'Найти сайты'}
        </button>
      </form>

      {loading && <Spinner label="Выполняем поиск…" />}
      {error && <ErrorBox error={error} />}

      {results && !loading && (
        <section className="an-section" aria-live="polite">
          <h2 className="an-h2">Результаты: «{results.query}»</h2>
          {results.cached && <p className="an-hint">Показаны сохранённые результаты (поиск за последние 24 часа).</p>}
          {results.hits.length === 0 ? (
            <Empty title="Ничего подходящего не найдено">Попробуйте другой запрос. Соцсети, каталоги и энциклопедии мы отфильтровываем автоматически.</Empty>
          ) : (
            <ul className="an-rows">
              {results.hits.map((h) => {
                const st = started[h.id];
                return (
                  <li key={h.id} className="an-row">
                    <div className="an-row__main">
                      <p className="an-row__title">{h.title || h.host}</p>
                      <p className="an-row__meta an-break">
                        <a href={h.url} target="_blank" rel="noopener noreferrer">
                          {h.host}
                        </a>
                      </p>
                      {h.snippet && <p className="an-row__snippet">{h.snippet}</p>}
                      {st?.error && <p className="an-row__err">{st.error}</p>}
                    </div>
                    <div className="an-row__side">
                      {st?.id ? (
                        <>
                          <RunStatus id={st.id} onFinished={onChanged} />
                        </>
                      ) : (
                        <button type="button" className="btn btn--outline btn--sm" disabled={st?.busy} onClick={() => analyze(h)}>
                          {st?.busy ? 'Запуск…' : 'Проанализировать'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
