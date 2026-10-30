import { useState } from 'react';
import { api, ApiError } from './api';
import type { Idea, IdeaStatus } from './api';
import { Badge, IDEA_STATUS, ScoreBars, VerificationBadge, fmtDate } from './ui';

interface Props {
  idea: Idea;
  onChanged: () => void;
  /** Показывать ли блок «Что дальше» после одобрения */
  hint?: boolean;
}

/** Карточка идеи с оценками, источником и кнопками решения (одобрить / отклонить / реализована). */
export function IdeaCard({ idea, onChanged, hint = true }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const st = IDEA_STATUS[idea.status];

  async function change(status: IdeaStatus, noteText?: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/ideas/${idea.id}`, { method: 'PATCH', body: { status, note: noteText } });
      setRejecting(false);
      setNote('');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  }

  const detailsId = `idea-${idea.id}-details`;

  return (
    <article className={`an-idea an-idea--${idea.status}`}>
      <header className="an-idea__head">
        <div className="an-idea__score" aria-label={`Итоговая оценка ${idea.totalScore} из 100`}>
          <strong>{idea.totalScore}</strong>
          <span>из 100</span>
        </div>
        <div className="an-idea__main">
          <div className="an-idea__badges">
            <Badge tone={st.tone}>{st.label}</Badge>
            <Badge tone="muted">Сложность: {idea.complexityLabel}</Badge>
            <VerificationBadge v={idea.verification} />
            {idea.origin === 'ai' && <Badge tone="info">предложено ИИ</Badge>}
          </div>
          <h3 className="an-idea__title">{idea.title}</h3>
          <p className="an-idea__desc">{idea.description}</p>
          <p className="an-idea__source">
            Источник:{' '}
            <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer">
              {idea.sourceHost}
            </a>
          </p>
        </div>
      </header>

      <div className="an-idea__actions">
        {idea.status === 'new' && (
          <>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => change('approved')}>
              Одобрить
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => setRejecting((v) => !v)} aria-expanded={rejecting}>
              Отклонить
            </button>
          </>
        )}
        {idea.status === 'approved' && (
          <>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => change('implemented')}>
              Отметить реализованной
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => setRejecting((v) => !v)} aria-expanded={rejecting}>
              Отклонить
            </button>
            <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => change('new')}>
              Вернуть в новые
            </button>
          </>
        )}
        {idea.status === 'rejected' && (
          <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => change('new')}>
            Вернуть в новые
          </button>
        )}
        {idea.status === 'implemented' && (
          <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => change('approved')}>
            Вернуть в одобренные
          </button>
        )}
        <button type="button" className="an-link-btn" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
          {open ? 'Скрыть подробности' : 'Подробности'}
        </button>
      </div>

      {rejecting && (
        <form
          className="an-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void change('rejected', note);
          }}
        >
          <label htmlFor={`note-${idea.id}`}>Причина (необязательно)</label>
          <input id={`note-${idea.id}`} type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Например: не подходит по стилю" />
          <button type="submit" className="btn btn--dark btn--sm" disabled={busy}>
            Подтвердить отклонение
          </button>
        </form>
      )}

      {error && (
        <p className="an-idea__error" role="alert">
          {error}
        </p>
      )}

      {hint && idea.status === 'approved' && (
        <p className="an-idea__hint">
          Создана задача — см. раздел «Одобренные идеи». Код сайта при этом <strong>не менялся</strong>: внедрять изменения вы будете сами или отдельной командой.
        </p>
      )}
      {idea.note && <p className="an-idea__note">Заметка: {idea.note}</p>}

      {open && (
        <div id={detailsId} className="an-idea__details">
          <ScoreBars scores={idea.scores} />
          <dl className="an-facts">
            <div>
              <dt>Почему это интересно</dt>
              <dd>{idea.whyInteresting}</dd>
            </div>
            <div>
              <dt>Ожидаемая польза</dt>
              <dd>{idea.expectedBenefit}</dd>
            </div>
            <div>
              <dt>Рекомендация</dt>
              <dd>{idea.recommendation}</dd>
            </div>
            {idea.evidence.length > 0 && (
              <div>
                <dt>Что найдено на сайте-источнике</dt>
                <dd>
                  <ul className="an-list">
                    {idea.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt>Страница-источник</dt>
              <dd>
                <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" className="an-break">
                  {idea.sourceUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt>Обновлено</dt>
              <dd>{fmtDate(idea.statusChangedAt)}</dd>
            </div>
          </dl>
          <p className="an-fine">Идея — вдохновение, а не готовое решение: не копируйте чужие тексты, изображения, логотипы и код.</p>
        </div>
      )}
    </article>
  );
}
