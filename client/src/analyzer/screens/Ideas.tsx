import { useState } from 'react';
import { api } from '../api';
import type { Idea, IdeaStatus, Task } from '../api';
import { IdeaCard } from '../IdeaCard';
import { Empty, Loadable, PageTitle, copyText, fmtDate, useAsync } from '../ui';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'implemented', label: 'Реализованные' },
];

export function IdeasScreen({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [minScore, setMinScore] = useState('0');
  const [complexity, setComplexity] = useState('');
  const [origin, setOrigin] = useState('');
  const [verification, setVerification] = useState('');
  const [sort, setSort] = useState('score');

  const state = useAsync(
    (signal) => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (q.trim()) p.set('q', q.trim());
      if (Number(minScore) > 0) p.set('minScore', minScore);
      if (complexity) p.set('complexity', complexity);
      if (origin) p.set('origin', origin);
      if (verification) p.set('verification', verification);
      p.set('sort', sort);
      return api<{ ideas: Idea[] }>(`/api/ideas?${p.toString()}`, { signal });
    },
    [status, q, minScore, complexity, origin, verification, sort],
  );

  const changed = () => {
    state.refresh();
    onChanged();
  };
  const filtersActive = Boolean(q.trim()) || Number(minScore) > 0 || Boolean(complexity) || Boolean(origin) || Boolean(verification);

  return (
    <>
      <PageTitle title="Найденные идеи">
        Идеи появляются только после анализа реальных сайтов и только если на них найдены подтверждающие признаки. Ничего не применяется к сайту без вашего одобрения.
      </PageTitle>

      <form className="an-filters" onSubmit={(e) => e.preventDefault()} aria-label="Фильтры идей">
        <div className="an-field an-field--wide">
          <label htmlFor="f-q">Поиск</label>
          <input id="f-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или сайт" />
        </div>
        <div className="an-field">
          <label htmlFor="f-status">Статус</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="an-field">
          <label htmlFor="f-score">Оценка от</label>
          <select id="f-score" value={minScore} onChange={(e) => setMinScore(e.target.value)}>
            <option value="0">любая</option>
            <option value="40">40</option>
            <option value="60">60</option>
            <option value="70">70</option>
            <option value="80">80</option>
          </select>
        </div>
        <div className="an-field">
          <label htmlFor="f-cx">Сложность</label>
          <select id="f-cx" value={complexity} onChange={(e) => setComplexity(e.target.value)}>
            <option value="">любая</option>
            <option value="простая">простая</option>
            <option value="средняя">средняя</option>
            <option value="сложная">сложная</option>
          </select>
        </div>
        <div className="an-field">
          <label htmlFor="f-origin">Откуда идея</label>
          <select id="f-origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">любая</option>
            <option value="rules">по признакам на сайте</option>
            <option value="ai">предложена ИИ</option>
          </select>
        </div>
        <div className="an-field">
          <label htmlFor="f-ver">Проверка</label>
          <select id="f-ver" value={verification} onChange={(e) => setVerification(e.target.value)}>
            <option value="">любая</option>
            <option value="static">проверено по HTML</option>
            <option value="needs_browser_check">требует браузерной проверки</option>
          </select>
        </div>
        <div className="an-field">
          <label htmlFor="f-sort">Сортировка</label>
          <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">по оценке</option>
            <option value="newest">сначала новые</option>
            <option value="complexity">сначала простые</option>
          </select>
        </div>
      </form>

      <Loadable state={state}>
        {({ ideas }) =>
          ideas.length === 0 ? (
            filtersActive || status !== '' ? (
              <Empty title="Ничего не найдено">Измените фильтры или запустите анализ новых сайтов на вкладке «Добавить URL».</Empty>
            ) : (
              <Empty title="Пока нет ни одной идеи">Добавьте адреса сайтов на вкладке «Добавить URL» — после анализа здесь появятся реальные находки.</Empty>
            )
          ) : (
            <>
              <p className="an-count" aria-live="polite">
                Найдено: {ideas.length}
              </p>
              <div className="an-stack">
                {ideas.map((i) => (
                  <IdeaCard key={i.id} idea={i} onChanged={changed} />
                ))}
              </div>
            </>
          )
        }
      </Loadable>
    </>
  );
}

function taskToText(idea: Idea, task: Task): string {
  return [
    `ЗАДАЧА: ${task.title}`,
    '',
    task.brief,
    '',
    'Шаги:',
    ...task.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Что проверить после внедрения:',
    ...task.checks.map((c) => `- ${c}`),
    '',
    `Источник вдохновения: ${idea.sourceUrl} (не копировать тексты, изображения, логотипы и код)`,
  ].join('\n');
}

function TaskCard({ idea, onChanged }: { idea: Idea; onChanged: () => void }) {
  const task = idea.task;
  const [copied, setCopied] = useState<'ok' | 'fail' | ''>('');
  if (!task) return <IdeaCard idea={idea} onChanged={onChanged} hint={false} />;
  return (
    <div className="an-taskwrap">
      <IdeaCard idea={idea} onChanged={onChanged} hint={false} />
      <section className="an-task" aria-label={`Задача: ${task.title}`}>
        <h4 className="an-task__title">{task.title}</h4>
        <p className="an-fine">Создана {fmtDate(task.createdAt)}</p>
        <div className="an-task__cols">
          <div>
            <h5>Шаги</h5>
            <ol className="an-list an-list--num">
              {task.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <h5>Проверки после внедрения</h5>
            <ul className="an-list">
              {task.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="an-task__actions">
          <button
            type="button"
            className="btn btn--dark btn--sm"
            onClick={async () => setCopied((await copyText(taskToText(idea, task))) ? 'ok' : 'fail')}
          >
            Скопировать задачу
          </button>
          <span className="an-fine" role="status">
            {copied === 'ok' && 'Скопировано — вставьте в сообщение помощнику-программисту.'}
            {copied === 'fail' && 'Не удалось скопировать — выделите текст вручную.'}
          </span>
        </div>
      </section>
    </div>
  );
}

function StatusList({ status, title, lead, emptyTitle, emptyText, onChanged, withTask }: {
  status: IdeaStatus;
  title: string;
  lead: string;
  emptyTitle: string;
  emptyText: string;
  onChanged: () => void;
  withTask: boolean;
}) {
  const state = useAsync((signal) => api<{ ideas: Idea[] }>(`/api/ideas?status=${status}&sort=newest`, { signal }), [status]);
  const changed = () => {
    state.refresh();
    onChanged();
  };
  return (
    <>
      <PageTitle title={title}>{lead}</PageTitle>
      <Loadable state={state}>
        {({ ideas }) =>
          ideas.length === 0 ? (
            <Empty title={emptyTitle}>{emptyText}</Empty>
          ) : (
            <div className="an-stack">
              {ideas.map((i) => (withTask ? <TaskCard key={i.id} idea={i} onChanged={changed} /> : <IdeaCard key={i.id} idea={i} onChanged={changed} hint={false} />))}
            </div>
          )
        }
      </Loadable>
    </>
  );
}

export function ApprovedScreen({ onChanged }: { onChanged: () => void }) {
  return (
    <StatusList
      status="approved"
      title="Одобренные идеи"
      lead="Каждая одобренная идея превращается в конкретную задачу. Анализатор сам не меняет сайт: скопируйте задачу, внедрите изменение, проверьте на телефоне и компьютере и нажмите «Отметить реализованной»."
      emptyTitle="Нет одобренных идей"
      emptyText="Откройте «Найденные идеи» и одобрите те, что подходят проекту."
      onChanged={onChanged}
      withTask
    />
  );
}

export function ImplementedScreen({ onChanged }: { onChanged: () => void }) {
  return (
    <StatusList
      status="implemented"
      title="Реализованные улучшения"
      lead="Идеи, которые вы внедрили в сайт после одобрения."
      emptyTitle="Пока ничего не реализовано"
      emptyText="Когда внедрите одобренную идею, отметьте её реализованной — она появится здесь."
      onChanged={onChanged}
      withTask={false}
    />
  );
}
