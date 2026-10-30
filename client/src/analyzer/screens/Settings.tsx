import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { AppConfig, Settings as SettingsData } from '../api';
import { Badge, PageTitle } from '../ui';

export function SettingsScreen({ config, onSaved }: { config: AppConfig; onSaved: () => void }) {
  const s = config.settings;
  const lim = config.limits;
  const [interval, setIntervalSec] = useState(String(s.fetchMinIntervalMs / 1000));
  const [timeout, setTimeoutSec] = useState(String(s.fetchTimeoutMs / 1000));
  const [ttl, setTtl] = useState(String(s.cacheTtlHours));
  const [pages, setPages] = useState(String(s.maxPagesPerAnalysis));
  const [blocked, setBlocked] = useState(s.blockedDomains.join('\n'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    setIntervalSec(String(s.fetchMinIntervalMs / 1000));
    setTimeoutSec(String(s.fetchTimeoutMs / 1000));
    setTtl(String(s.cacheTtlHours));
    setPages(String(s.maxPagesPerAnalysis));
    setBlocked(s.blockedDomains.join('\n'));
  }, [s]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api<{ settings: SettingsData }>('/api/settings', {
        method: 'PUT',
        body: {
          fetchMinIntervalMs: Math.round(Number(interval) * 1000),
          fetchTimeoutMs: Math.round(Number(timeout) * 1000),
          cacheTtlHours: Number(ttl),
          maxPagesPerAnalysis: Number(pages),
          blockedDomains: blocked.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
        },
      });
      setMsg({ tone: 'ok', text: 'Настройки сохранены.' });
      onSaved();
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof ApiError ? err.message : 'Не удалось сохранить настройки' });
    } finally {
      setBusy(false);
    }
  }

  async function clearCache() {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/cache/clear', { method: 'POST' });
      setMsg({ tone: 'ok', text: 'Кэш очищен: следующий анализ загрузит страницы заново.' });
    } catch (err) {
      setMsg({ tone: 'bad', text: err instanceof ApiError ? err.message : 'Не удалось очистить кэш' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Настройки источников">Ограничения при обращении к чужим сайтам и подключение внешних сервисов.</PageTitle>

      <form className="an-card" onSubmit={save} noValidate>
        <h2 className="an-h2">Ограничения</h2>
        <div className="an-grid2">
          <div className="an-field">
            <label htmlFor="s-int">Пауза между запросами к одному сайту, секунд</label>
            <input id="s-int" type="number" inputMode="decimal" step="any" min={lim.fetchMinIntervalMs.min / 1000} max={lim.fetchMinIntervalMs.max / 1000} value={interval} onChange={(e) => setIntervalSec(e.target.value)} />
            <p className="an-hint">От {lim.fetchMinIntervalMs.min / 1000} до {lim.fetchMinIntervalMs.max / 1000}. Чем больше, тем бережнее к чужому сайту.</p>
          </div>
          <div className="an-field">
            <label htmlFor="s-to">Время ожидания ответа, секунд</label>
            <input id="s-to" type="number" inputMode="decimal" step="any" min={lim.fetchTimeoutMs.min / 1000} max={lim.fetchTimeoutMs.max / 1000} value={timeout} onChange={(e) => setTimeoutSec(e.target.value)} />
            <p className="an-hint">От {lim.fetchTimeoutMs.min / 1000} до {lim.fetchTimeoutMs.max / 1000}.</p>
          </div>
          <div className="an-field">
            <label htmlFor="s-ttl">Хранить страницы в кэше, часов</label>
            <input id="s-ttl" type="number" inputMode="numeric" min={lim.cacheTtlHours.min} max={lim.cacheTtlHours.max} value={ttl} onChange={(e) => setTtl(e.target.value)} />
            <p className="an-hint">От {lim.cacheTtlHours.min} до {lim.cacheTtlHours.max}. 0 — не кэшировать.</p>
          </div>
          <div className="an-field">
            <label htmlFor="s-pg">Максимум страниц за один анализ</label>
            <input id="s-pg" type="number" inputMode="numeric" min={lim.maxPagesPerAnalysis.min} max={lim.maxPagesPerAnalysis.max} value={pages} onChange={(e) => setPages(e.target.value)} />
            <p className="an-hint">От {lim.maxPagesPerAnalysis.min} до {lim.maxPagesPerAnalysis.max}. Сканировать весь сайт анализатор не будет.</p>
          </div>
        </div>
        <div className="an-field">
          <label htmlFor="s-bl">Запрещённые домены (по одному в строке)</label>
          <textarea id="s-bl" rows={3} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="example.com" spellCheck={false} />
          <p className="an-hint">Эти сайты анализатор не откроет никогда, а в поиске они скрываются.</p>
        </div>
        <label className="an-check an-check--locked">
          <input type="checkbox" checked disabled readOnly />
          <span>
            Соблюдать robots.txt <small>(включено всегда — отключить нельзя)</small>
          </span>
        </label>
        {msg && (
          <p className={msg.tone === 'ok' ? 'an-banner an-banner--ok' : 'an-error'} role={msg.tone === 'ok' ? 'status' : 'alert'}>
            {msg.text}
          </p>
        )}
        <div className="an-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Сохранить
          </button>
          <button type="button" className="btn btn--outline" disabled={busy} onClick={clearCache}>
            Очистить кэш страниц
          </button>
        </div>
      </form>

      <section className="an-section" aria-labelledby="keys">
        <h2 id="keys" className="an-h2">
          Ключи и внешние сервисы
        </h2>
        <p className="an-hint">Ключи вписываются только в файл <code>.env</code> в папке проекта и после этого нужен перезапуск. Из браузера их ввести нельзя — так они не утекут.</p>
        <div className="an-tablewrap">
          <table className="an-table">
            <thead>
              <tr>
                <th scope="col">Возможность</th>
                <th scope="col">Что вписать в .env</th>
                <th scope="col">Состояние</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Поиск референсов (режим B)</td>
                <td data-label="Что вписать в .env">
                  <code>BRAVE_API_KEY</code> или <code>GOOGLE_CSE_KEY</code> + <code>GOOGLE_CSE_CX</code>
                </td>
                <td data-label="Состояние">
                  <Badge tone={config.search.configured ? 'ok' : 'warn'}>{config.search.configured ? `есть: ${config.search.providers.join(', ')}` : 'нет ключа'}</Badge>
                </td>
              </tr>
              <tr>
                <td>ИИ-дополнение анализа</td>
                <td data-label="Что вписать в .env">
                  <code>ANTHROPIC_API_KEY</code>
                </td>
                <td data-label="Состояние">
                  <Badge tone={config.ai.configured ? 'ok' : 'muted'}>{config.ai.configured ? 'есть' : 'выключено'}</Badge>
                </td>
              </tr>
              <tr>
                <td>Заявки с сайта в Telegram</td>
                <td data-label="Что вписать в .env">
                  <code>BOOKING_TELEGRAM_BOT_TOKEN</code> + <code>BOOKING_TELEGRAM_CHAT_ID</code> и <code>VITE_BOOKING_ENDPOINT=/api/bookings</code>
                </td>
                <td data-label="Состояние">
                  <Badge tone={config.booking.configured ? 'ok' : 'muted'}>{config.booking.configured ? 'сервер готов' : 'демо-режим'}</Badge>
                </td>
              </tr>
              <tr>
                <td>Пароль панели</td>
                <td data-label="Что вписать в .env">
                  <code>ADMIN_TOKEN</code> (нужен, только если сервер доступен не только вам)
                </td>
                <td data-label="Состояние">
                  <Badge tone={config.secured ? 'ok' : 'muted'}>{config.secured ? 'включён' : 'не задан (доступ только с этого компьютера)'}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
