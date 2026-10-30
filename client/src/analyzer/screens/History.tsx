import { useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, FEATURE_LABELS } from '../api';
import type { AnalysisDetail, AnalysisResult, AnalysisSummary, Idea } from '../api';
import { IdeaCard } from '../IdeaCard';
import { ANALYSIS_STATUS, Badge, Empty, ERROR_HINTS, ErrorBox, Loadable, PRESENCE, PageTitle, Spinner, VerificationBadge, fmtDate, plural, useAsync, useInterval } from '../ui';

const PRICE_LABEL: Record<string, string> = {
  listed: 'цены указаны',
  from: 'цены «от …»',
  on_request: 'цены по запросу',
  none: 'цены не найдены',
};

function RowActions({ a, onChanged, onDeleted }: { a: AnalysisSummary; onChanged: () => void; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const running = a.status === 'queued' || a.status === 'running';

  async function rerun() {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/analyses/${a.id}/rerun`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Не удалось повторить');
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    setBusy(true);
    setErr('');
    try {
      await api(`/api/analyses/${a.id}`, { method: 'DELETE' });
      onDeleted?.();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Не удалось удалить');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="an-actions">
      <button type="button" className="btn btn--outline btn--sm" disabled={busy || running} onClick={rerun}>
        Повторить
      </button>
      {confirm ? (
        <>
          <button type="button" className="btn btn--dark btn--sm" disabled={busy} onClick={del}>
            Да, удалить
          </button>
          <button type="button" className="an-link-btn" onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </>
      ) : (
        <button type="button" className="btn btn--outline btn--sm" disabled={busy || running} onClick={() => setConfirm(true)}>
          Удалить
        </button>
      )}
      {err && (
        <p className="an-row__err" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

export function HistoryList({ onChanged }: { onChanged: () => void }) {
  const state = useAsync((signal) => api<{ analyses: AnalysisSummary[] }>('/api/analyses?limit=200', { signal }), []);
  const busy = state.data?.analyses.some((a) => a.status === 'queued' || a.status === 'running') ?? false;
  useInterval(() => state.refresh(), busy ? 2000 : null);
  const changed = () => {
    state.refresh();
    onChanged();
  };

  return (
    <>
      <PageTitle title="История анализа">Все запуски: что было проанализировано, когда и чем закончилось. Любой анализ можно повторить.</PageTitle>
      <Loadable state={state}>
        {({ analyses }) =>
          analyses.length === 0 ? (
            <Empty
              title="История пуста"
              action={
                <a className="btn btn--primary btn--sm" href="#/analyzer/add">
                  Добавить URL
                </a>
              }
            >
              Здесь появятся только настоящие запуски анализа.
            </Empty>
          ) : (
            <ul className="an-rows">
              {analyses.map((a) => {
                const st = ANALYSIS_STATUS[a.status];
                return (
                  <li key={a.id} className="an-row an-row--block">
                    <div className="an-row__main">
                      <p className="an-row__title">
                        <a href={`#/analyzer/history/${a.id}`}>{a.host}</a>
                      </p>
                      <p className="an-row__meta an-break">{a.url}</p>
                      <p className="an-row__meta">
                        {fmtDate(a.createdAt)}
                        {a.useAi ? ' · с ИИ' : ''}
                        {a.rerunOf ? ` · повтор анализа №${a.rerunOf}` : ''}
                      </p>
                      {(a.status === 'error' || a.status === 'blocked') && (
                        <p className="an-row__err">{(a.errorCode && ERROR_HINTS[a.errorCode]) ?? a.errorMessage}</p>
                      )}
                    </div>
                    <div className="an-row__side an-row__side--col">
                      <span className="an-row__status">
                        {(a.status === 'queued' || a.status === 'running') && <span className="spinner spinner--dark" aria-hidden="true" />}
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                      <a className="btn btn--dark btn--sm" href={`#/analyzer/history/${a.id}`}>
                        Подробнее
                      </a>
                      <RowActions a={a} onChanged={changed} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Loadable>
    </>
  );
}

/* ---------------------------------------------------------------- разбор сайта */

function Block({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="an-block" open={open}>
      <summary>{title}</summary>
      <div className="an-block__body">{children}</div>
    </details>
  );
}

function Report({ r }: { r: AnalysisResult }) {
  const a = r.analysis;
  const features = Object.entries(a.features);
  const found = features.filter(([, f]) => f.present !== 'no');
  const absent = features.filter(([, f]) => f.present === 'no');
  return (
    <>
      <Block title="Структура сайта" open>
        <dl className="an-facts">
          <div>
            <dt>Заголовок страницы</dt>
            <dd>{a.meta.title || '—'}</dd>
          </div>
          <div>
            <dt>Главные заголовки (H1)</dt>
            <dd>{a.structure.h1.length ? a.structure.h1.join(' · ') : 'не найдены'}</dd>
          </div>
          <div>
            <dt>Разделы (H2)</dt>
            <dd>{a.structure.h2.length ? a.structure.h2.slice(0, 12).join(' · ') : 'не найдены'}</dd>
          </div>
          <div>
            <dt>Меню</dt>
            <dd>
              {a.structure.nav.items.length ? a.structure.nav.items.map((i) => i.text).join(' · ') : 'не найдено'}
              {a.structure.nav.mobileMenuHint && <> · есть признаки мобильного меню (<em>работу проверьте в браузере</em>)</>}
            </dd>
          </div>
          <div>
            <dt>Услуги</dt>
            <dd>{a.structure.services.detected ? a.structure.services.items.slice(0, 12).join(' · ') : 'блок услуг не определён'}</dd>
          </div>
          <div>
            <dt>Подача цен</dt>
            <dd>
              {PRICE_LABEL[a.structure.prices.presentation] ?? a.structure.prices.presentation}
              {a.structure.prices.mentions.length > 0 && (
                <ul className="an-list">
                  {a.structure.prices.mentions.slice(0, 5).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt>Формы</dt>
            <dd>
              {a.structure.forms.count === 0 ? 'форм на странице нет' : `${a.structure.forms.count} шт.`}
              {a.structure.forms.fields.length > 0 && <> · поля: {a.structure.forms.fields.slice(0, 12).join(', ')}</>}
            </dd>
          </div>
          <div>
            <dt>Контакты</dt>
            <dd>
              ссылок «позвонить»: {a.structure.contacts.phoneLinks}; email: {a.structure.contacts.hasEmail ? 'есть' : 'нет'}; адрес: {a.structure.contacts.hasAddress ? 'есть' : 'не найден'}; график: {a.structure.contacts.hasWorkingHours ? 'есть' : 'не найден'}
            </dd>
          </div>
        </dl>
      </Block>

      <Block title="Дизайн">
        <dl className="an-facts">
          <div>
            <dt>Основные цвета из стилей</dt>
            <dd>
              {a.design.colors.length === 0 ? (
                'не определены'
              ) : (
                <ul className="an-swatches">
                  {a.design.colors.slice(0, 10).map((c) => (
                    <li key={c.hex}>
                      <span className="an-swatch" style={{ background: c.hex }} aria-hidden="true" />
                      <code>{c.hex}</code>
                    </li>
                  ))}
                </ul>
              )}
              {a.design.accents.length > 0 && <p className="an-hint">Вероятные акценты: {a.design.accents.join(', ')}</p>}
            </dd>
          </div>
          <div>
            <dt>Шрифты</dt>
            <dd>
              {a.design.fonts.length ? a.design.fonts.join(', ') : 'не определены'}
              {a.design.fontProviders.length > 0 && <> · источник: {a.design.fontProviders.join(', ')}</>}
            </dd>
          </div>
          <div>
            <dt>Главный экран</dt>
            <dd>
              {a.design.hero.found ? `найден; ${a.design.hero.hasMedia ? 'с изображением/видео' : 'без крупной картинки'}; ${a.design.hero.hasH1 ? 'есть заголовок H1' : 'нет H1'}` : 'не определён'}
              {a.design.hero.ctaTexts.length > 0 && <> · кнопки: «{a.design.hero.ctaTexts.join('», «')}»</>}
              {a.design.hero.layoutHint && <> · {a.design.hero.layoutHint}</>}
            </dd>
          </div>
          <div>
            <dt>Раскладка и изображения</dt>
            <dd>
              CSS Grid: {a.design.layout.usesCssGrid ? 'да' : 'нет'}; Flexbox: {a.design.layout.usesFlex ? 'да' : 'нет'}; изображений: {a.design.layout.images} (с ленивой загрузкой: {a.design.layout.lazyImages}); адаптивные изображения: {a.design.layout.responsiveImages ? 'да' : 'нет'}
            </dd>
          </div>
          <div>
            <dt>Анимации</dt>
            <dd>
              переходов в стилях: {a.design.motion.transitions ? 'есть' : 'нет'}; keyframes: {a.design.motion.keyframes}
              {a.design.motion.libraries.length > 0 && <>; библиотеки: {a.design.motion.libraries.join(', ')}</>}{' '}
              <Badge tone="warn">требует браузерной проверки</Badge>
            </dd>
          </div>
        </dl>
      </Block>

      <Block title={`Функции: найдено ${found.length} из ${features.length}`}>
        <p className="an-hint">«Требует браузерной проверки» — наличие элемента видно в HTML, но как он работает, без открытия страницы в браузере сказать нельзя.</p>
        <ul className="an-features">
          {found.map(([key, f]) => (
            <li key={key}>
              <div className="an-features__head">
                <strong>{FEATURE_LABELS[key] ?? key}</strong>
                <Badge tone={PRESENCE[f.present].tone}>{PRESENCE[f.present].label}</Badge>
                <VerificationBadge v={f.verification} />
              </div>
              {f.evidence.length > 0 && <p className="an-features__ev">{f.evidence.slice(0, 3).join(' · ')}</p>}
            </li>
          ))}
        </ul>
        {absent.length > 0 && (
          <p className="an-hint">Не найдено: {absent.map(([k]) => FEATURE_LABELS[k] ?? k).join(', ')}.</p>
        )}
      </Block>

      <Block title="Технические сведения">
        <dl className="an-facts">
          <div>
            <dt>Технологии (по признакам в коде)</dt>
            <dd>{a.technical.frameworks.length ? a.technical.frameworks.join(', ') : 'не определены'}</dd>
          </div>
          <div>
            <dt>Скрипты и ссылки</dt>
            <dd>
              скриптов: {a.technical.scripts}; внутренних ссылок: {a.technical.internalLinks}; внешних: {a.technical.externalLinks}
            </dd>
          </div>
          <div>
            <dt>Мобильная версия</dt>
            <dd>{a.meta.hasViewport ? 'тег viewport есть' : 'тега viewport нет — вероятно, не адаптирован'}; язык: {a.meta.lang || 'не указан'}</dd>
          </div>
        </dl>
      </Block>

      {a.rejectedPatterns.length > 0 && (
        <Block title={`Приёмы, которые мы не рекомендуем (${a.rejectedPatterns.length})`}>
          <ul className="an-features">
            {a.rejectedPatterns.map((p) => (
              <li key={p.pattern + p.evidence}>
                <strong>{p.pattern}</strong>
                <p className="an-features__ev">{p.reason}</p>
                <p className="an-features__ev">Найдено: {p.evidence}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={`Отсеянные идеи (${r.filtered.length})`}>
        {r.filtered.length === 0 ? (
          <p className="an-hint">Ничего не отсеяно.</p>
        ) : (
          <ul className="an-features">
            {r.filtered.map((f) => (
              <li key={f.key}>
                <div className="an-features__head">
                  <strong>{f.title}</strong>
                  <Badge tone={f.kind === 'already_in_project' ? 'info' : 'warn'}>{f.kind === 'already_in_project' ? 'уже есть в проекте' : 'не прошла фильтр реалистичности'}</Badge>
                </div>
                <p className="an-features__ev">{f.reason}</p>
                {f.failedChecks.length > 0 && (
                  <ul className="an-list">
                    {f.failedChecks.map((c) => (
                      <li key={c}>Не выполнено: {c}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

export function HistoryDetails({ id, onChanged }: { id: number; onChanged: () => void }) {
  const state = useAsync((signal) => api<{ analysis: AnalysisDetail; ideas: Idea[] }>(`/api/analyses/${id}`, { signal }), [id]);
  const status = state.data?.analysis.status;
  useInterval(() => state.refresh(), status === 'queued' || status === 'running' ? 1500 : null);
  const changed = () => {
    state.refresh();
    onChanged();
  };

  return (
    <>
      <p className="an-back">
        <a href="#/analyzer/history">← К истории анализа</a>
      </p>
      {state.error && !state.data && state.error.status === 404 ? (
        <Empty
          title="Такого анализа нет"
          action={
            <a className="btn btn--primary btn--sm" href="#/analyzer/history">
              К истории анализа
            </a>
          }
        >
          Возможно, он был удалён.
        </Empty>
      ) : (
      <Loadable state={state}>
        {({ analysis: a, ideas }) => {
          const st = ANALYSIS_STATUS[a.status];
          const res = a.result;
          return (
            <>
              <PageTitle title={a.host} />
              <div className="an-card an-card--tight">
                <p className="an-break">
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.url}
                  </a>
                </p>
                <p className="an-row__status">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="an-hint">
                    запущен {fmtDate(a.createdAt)}
                    {a.finishedAt ? `, завершён ${fmtDate(a.finishedAt)}` : ''}
                    {a.useAi ? ' · с ИИ' : ''}
                  </span>
                </p>
                <RowActions a={a} onChanged={changed} onDeleted={() => (window.location.hash = '#/analyzer/history')} />
              </div>

              {(a.status === 'queued' || a.status === 'running') && <Spinner label="Анализ выполняется — страница обновится сама…" />}
              {(a.status === 'error' || a.status === 'blocked') && (
                <ErrorBox error={{ message: `${(a.errorCode && ERROR_HINTS[a.errorCode]) ?? a.errorMessage ?? 'Анализ не удался'}` }} />
              )}

              {res && a.status === 'done' && (
                <>
                  <ul className="an-tiles an-tiles--small">
                    <li className="an-tile">
                      <strong>{res.stats.pagesFetched}</strong>
                      <span>{plural(res.stats.pagesFetched, ['страница загружена', 'страницы загружены', 'страниц загружено'])}</span>
                    </li>
                    <li className="an-tile">
                      <strong>{res.stats.fromCache}</strong>
                      <span>из кэша</span>
                    </li>
                    <li className="an-tile">
                      <strong>{res.stats.ideasCreated}</strong>
                      <span>{plural(res.stats.ideasCreated, ['новая идея', 'новые идеи', 'новых идей'])}</span>
                    </li>
                    <li className="an-tile">
                      <strong>{res.stats.ideasUpdated}</strong>
                      <span>{plural(res.stats.ideasUpdated, ['идея обновлена', 'идеи обновлены', 'идей обновлено'])}</span>
                    </li>
                  </ul>

                  {res.pageIssues.length > 0 && (
                    <div className="an-banner an-banner--warn" role="note">
                      <strong>Некоторые страницы не удалось прочитать:</strong>
                      <ul className="an-list">
                        {res.pageIssues.map((p) => (
                          <li key={p.url + p.code}>
                            <span className="an-break">{p.url}</span> — {ERROR_HINTS[p.code] ?? p.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {res.ai.requested && (
                    <p className="an-banner an-banner--info" role="note">
                      {res.ai.used ? `ИИ-дополнение выполнено: добавлено идей — ${res.ai.ideas}.` : `ИИ-дополнение не выполнено${res.ai.error ? `: ${res.ai.error}` : ''}.`}
                    </p>
                  )}

                  <section className="an-section" aria-labelledby="site-ideas">
                    <h2 id="site-ideas" className="an-h2">
                      Идеи с этого сайта ({ideas.length})
                    </h2>
                    {ideas.length === 0 ? (
                      <Empty title="Подходящих идей не найдено">
                        Это нормально: идея предлагается только если на сайте найден подтверждающий признак, а её применимость к EXAMPLE Auto Service проверена. Причины отсева — в блоке «Отсеянные идеи» ниже.
                      </Empty>
                    ) : (
                      <div className="an-stack">
                        {ideas.map((i) => (
                          <IdeaCard key={i.id} idea={i} onChanged={changed} />
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="an-section" aria-labelledby="site-report">
                    <h2 id="site-report" className="an-h2">
                      Разбор сайта
                    </h2>
                    <p className="an-hint">Проанализированные страницы: {res.analysis.analyzedPages.map((p) => p.url).join(', ')}</p>
                    <Report r={res} />
                  </section>
                </>
              )}
            </>
          );
        }}
      </Loadable>
      )}
    </>
  );
}
