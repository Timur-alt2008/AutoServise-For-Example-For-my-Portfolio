import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { AnalysisSummary, AppConfig } from '../api';
import { ANALYSIS_STATUS, Badge, ERROR_HINTS, PageTitle, Spinner, fmtSeconds, useAsync, useInterval } from '../ui';

const MAX_URLS = 5;

interface Submitted {
  line: string;
  analysis?: AnalysisSummary;
  error?: string;
}

export function AddUrl({ config, onChanged }: { config: AppConfig; onChanged: () => void }) {
  const [text, setText] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState<Submitted[]>([]);

  const ids = useMemo(() => submitted.flatMap((s) => (s.analysis ? [s.analysis.id] : [])), [submitted]);
  const live = useAsync((signal) => (ids.length ? api<{ analyses: AnalysisSummary[] }>('/api/analyses?limit=200', { signal }) : Promise.resolve({ analyses: [] as AnalysisSummary[] })), [ids.join(',')]);
  const byId = new Map((live.data?.analyses ?? []).map((a) => [a.id, a]));
  const pending = ids.some((id) => {
    const a = byId.get(id) ?? submitted.find((s) => s.analysis?.id === id)?.analysis;
    return !a || a.status === 'queued' || a.status === 'running';
  });
  useInterval(() => {
    live.refresh();
    onChanged();
  }, pending ? 1500 : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const lines = [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
    if (lines.length === 0) {
      setFormError('Вставьте хотя бы один адрес сайта, например https://example.com');
      return;
    }
    if (lines.length > MAX_URLS) {
      setFormError(`За один раз можно добавить не больше ${MAX_URLS} адресов — так мы не нагружаем чужие сайты.`);
      return;
    }
    setBusy(true);
    const out: Submitted[] = [];
    for (const line of lines) {
      try {
        const res = await api<{ analysis: AnalysisSummary }>('/api/analyses', { method: 'POST', body: { url: line, useAi: useAi && config.ai.configured } });
        out.push({ line, analysis: res.analysis });
      } catch (err) {
        out.push({ line, error: err instanceof ApiError ? (ERROR_HINTS[err.code] ?? err.message) : 'Не удалось отправить адрес' });
      }
    }
    setSubmitted(out);
    setBusy(false);
    onChanged();
  }

  return (
    <>
      <PageTitle title="Добавить URL">
        Режим A: вы указываете сайты, которые хотите изучить. Анализатор проверит доступность, загрузит только разрешённые страницы и покажет, какие решения там найдены.
      </PageTitle>

      <form className="an-card" onSubmit={onSubmit} noValidate>
        <div className="an-field">
          <label htmlFor="urls">Адреса сайтов (по одному в строке, до {MAX_URLS})</label>
          <textarea id="urls" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://example-auto.com\nhttps://another-service.com'} spellCheck={false} aria-describedby="urls-hint" />
          <p className="an-hint" id="urls-hint">
            Достаточно адреса главной страницы. Адреса внутри локальной сети и с логином/паролем не принимаются.
          </p>
        </div>

        {config.ai.configured ? (
          <label className="an-check">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
            <span>
              Дополнить анализ с помощью ИИ <small>(на сторону ИИ уходит только краткая сводка о сайте, не весь код страницы)</small>
            </span>
          </label>
        ) : (
          <p className="an-hint">ИИ-дополнение выключено: в файле .env нет ключа ANTHROPIC_API_KEY. Анализ работает и без него.</p>
        )}

        {formError && (
          <p className="an-error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Отправляем…' : 'Запустить анализ'}
        </button>
      </form>

      <aside className="an-note">
        <h2 className="an-h3">Как анализатор обращается к чужим сайтам</h2>
        <ul className="an-list">
          <li>Читает robots.txt и не заходит туда, куда владелец сайта запретил ходить автоматически.</li>
          <li>Не обходит CAPTCHA, вход по паролю и другие защиты — такие сайты помечаются как недоступные.</li>
          <li>
            Делает паузу между запросами (сейчас {fmtSeconds(config.settings.fetchMinIntervalMs)} с), ограничивает время ожидания и загружает не больше {config.settings.maxPagesPerAnalysis} страниц за раз.
          </li>
          <li>Скачанные страницы кэшируются на {config.settings.cacheTtlHours} ч, повторный запуск не нагружает сайт.</li>
        </ul>
      </aside>

      {submitted.length > 0 && (
        <section className="an-section" aria-labelledby="launched" aria-live="polite">
          <h2 id="launched" className="an-h2">
            Запущено
          </h2>
          <ul className="an-rows">
            {submitted.map((s) => {
              const a = s.analysis ? (byId.get(s.analysis.id) ?? s.analysis) : undefined;
              const st = a ? ANALYSIS_STATUS[a.status] : undefined;
              return (
                <li key={s.line} className="an-row">
                  <div className="an-row__main">
                    <p className="an-row__title an-break">{a?.url ?? s.line}</p>
                    {s.error && <p className="an-row__err">{s.error}</p>}
                    {a && (a.status === 'error' || a.status === 'blocked') && (
                      <p className="an-row__err">{(a.errorCode && ERROR_HINTS[a.errorCode]) ?? a.errorMessage}</p>
                    )}
                  </div>
                  <div className="an-row__side">
                    {a && st && (
                      <>
                        {(a.status === 'queued' || a.status === 'running') && <span className="spinner spinner--dark" aria-hidden="true" />}
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <a className="an-link-btn" href={`#/analyzer/history/${a.id}`}>
                          Открыть
                        </a>
                      </>
                    )}
                    {s.error && <Badge tone="bad">не запущено</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
          {live.loading && ids.length > 0 && !live.data && <Spinner label="Проверяем статус…" />}
        </section>
      )}
    </>
  );
}
