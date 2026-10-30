import { api } from '../api';
import type { AppConfig, Stats } from '../api';
import { IdeaCard } from '../IdeaCard';
import { Badge, Empty, Loadable, PageTitle, plural, useAsync } from '../ui';

export function Dashboard({ config, statsVersion, onChanged }: { config: AppConfig; statsVersion: number; onChanged: () => void }) {
  const state = useAsync((signal) => api<Stats>('/api/stats', { signal }), [statsVersion]);
  return (
    <>
      <PageTitle title="Dashboard">
        Сводка по реальным анализам. Здесь нет демонстрационных цифр: пока вы не запустили анализ, все значения нули.
      </PageTitle>
      <Loadable state={state}>
        {(s) => {
          const totalAnalyses = Object.values(s.analyses).reduce((a, b) => a + b, 0);
          const busy = s.analyses.queued + s.analyses.running;
          return (
            <>
              {busy > 0 && (
                <p className="an-banner an-banner--info" role="status">
                  Сейчас выполняется анализов: {busy}. Результаты появятся в «Истории анализа».
                </p>
              )}
              <ul className="an-tiles">
                <li className="an-tile">
                  <strong>{s.sitesAnalyzed}</strong>
                  <span>{plural(s.sitesAnalyzed, ['сайт проанализирован', 'сайта проанализировано', 'сайтов проанализировано'])}</span>
                </li>
                <li className="an-tile">
                  <strong>{s.ideas.new}</strong>
                  <span>{plural(s.ideas.new, ['новая идея', 'новые идеи', 'новых идей'])}</span>
                </li>
                <li className="an-tile">
                  <strong>{s.ideas.approved}</strong>
                  <span>одобрено</span>
                </li>
                <li className="an-tile">
                  <strong>{s.openTasks}</strong>
                  <span>{plural(s.openTasks, ['открытая задача', 'открытые задачи', 'открытых задач'])}</span>
                </li>
                <li className="an-tile">
                  <strong>{s.ideas.implemented}</strong>
                  <span>реализовано</span>
                </li>
              </ul>

              {totalAnalyses === 0 && (
                <Empty
                  title="Анализов пока нет"
                  action={
                    <a className="btn btn--primary btn--sm" href="#/analyzer/add">
                      Добавить URL
                    </a>
                  }
                >
                  Добавьте адрес сайта автосервиса — анализатор загрузит разрешённые страницы, найдёт полезные решения и предложит идеи. До этого момента панель пуста.
                </Empty>
              )}

              {s.top.length > 0 && (
                <section className="an-section" aria-labelledby="top-ideas">
                  <h2 id="top-ideas" className="an-h2">
                    Лучшие новые идеи
                  </h2>
                  <div className="an-stack">
                    {s.top.map((i) => (
                      <IdeaCard key={i.id} idea={i} onChanged={onChanged} />
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        }}
      </Loadable>

      <section className="an-section" aria-labelledby="integrations">
        <h2 id="integrations" className="an-h2">
          Что подключено
        </h2>
        <ul className="an-integrations">
          <li>
            <div>
              <strong>Анализ по ссылкам (режим A)</strong>
              <p>Работает без ключей и внешних сервисов.</p>
            </div>
            <Badge tone="ok">работает</Badge>
          </li>
          <li>
            <div>
              <strong>Автоматический поиск референсов (режим B)</strong>
              <p>
                {config.search.configured
                  ? `Подключён: ${config.search.providers.join(', ')}.`
                  : 'Нужен ключ поискового API в файле .env (BRAVE_API_KEY или GOOGLE_CSE_KEY + GOOGLE_CSE_CX). Пока можно добавлять адреса вручную.'}
              </p>
            </div>
            <Badge tone={config.search.configured ? 'ok' : 'warn'}>{config.search.configured ? 'подключён' : 'не настроен'}</Badge>
          </li>
          <li>
            <div>
              <strong>ИИ-дополнение анализа</strong>
              <p>{config.ai.configured ? `Подключено (модель ${config.ai.model}).` : 'Необязательно. Включается ключом ANTHROPIC_API_KEY в .env.'}</p>
            </div>
            <Badge tone={config.ai.configured ? 'ok' : 'muted'}>{config.ai.configured ? 'подключено' : 'выключено'}</Badge>
          </li>
          <li>
            <div>
              <strong>Приём заявок с сайта (Telegram)</strong>
              <p>{config.booking.configured ? 'Заявки пересылаются в Telegram.' : 'Сайт работает в демонстрационном режиме: заявки никуда не отправляются.'}</p>
            </div>
            <Badge tone={config.booking.configured ? 'ok' : 'muted'}>{config.booking.configured ? 'подключено' : 'демо-режим'}</Badge>
          </li>
        </ul>
      </section>
    </>
  );
}
