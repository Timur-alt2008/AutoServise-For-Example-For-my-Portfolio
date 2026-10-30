import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import '../styles/analyzer.css';
import { api, ApiError, setToken } from './api';
import type { AppConfig, Stats } from './api';
import { IconClose, IconMenu } from '../components/Icons';
import { Spinner } from './ui';
import { Dashboard } from './screens/Dashboard';
import { AddUrl } from './screens/AddUrl';
import { Search } from './screens/Search';
import { HistoryDetails, HistoryList } from './screens/History';
import { ApprovedScreen, IdeasScreen, ImplementedScreen } from './screens/Ideas';
import { SettingsScreen } from './screens/Settings';

type TabKey = 'dashboard' | 'add' | 'search' | 'history' | 'ideas' | 'approved' | 'implemented' | 'settings';

const TABS: Array<{ key: TabKey; label: string; short: string }> = [
  { key: 'dashboard', label: 'Dashboard', short: 'Обзор' },
  { key: 'add', label: 'Добавить URL', short: 'Добавить URL' },
  { key: 'search', label: 'Найти референсы', short: 'Поиск' },
  { key: 'history', label: 'История анализа', short: 'История' },
  { key: 'ideas', label: 'Найденные идеи', short: 'Идеи' },
  { key: 'approved', label: 'Одобренные идеи', short: 'Одобренные' },
  { key: 'implemented', label: 'Реализованные улучшения', short: 'Реализованные' },
  { key: 'settings', label: 'Настройки источников', short: 'Настройки' },
];

interface Route {
  tab: TabKey | null;
  id: number | null;
  valid: boolean;
}

function parseHash(hash: string): Route {
  const rest = hash.replace(/^#\/analyzer\/?/, '').replace(/\/+$/, '');
  if (!rest) return { tab: 'dashboard', id: null, valid: true };
  const [tabRaw, idRaw, ...extra] = rest.split('/');
  const tab = TABS.find((t) => t.key === tabRaw)?.key ?? null;
  if (!tab || extra.length > 0) return { tab: null, id: null, valid: false };
  if (idRaw !== undefined) {
    const id = Number(idRaw);
    if (tab !== 'history' || !Number.isInteger(id) || id < 1) return { tab: null, id: null, valid: false };
    return { tab, id, valid: true };
  }
  return { tab, id: null, valid: true };
}

function AuthGate({ onSubmit, wrong }: { onSubmit: (token: string) => void; wrong: boolean }) {
  const [value, setValue] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }
  return (
    <div className="an-gate">
      <form className="an-card" onSubmit={submit}>
        <h1 className="an-h2">Нужен пароль</h1>
        <p className="an-hint">На сервере задан пароль панели (<code>ADMIN_TOKEN</code> в файле <code>.env</code>). Он хранится только до закрытия вкладки.</p>
        <div className="an-field">
          <label htmlFor="gate-token">Пароль администратора</label>
          <input id="gate-token" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {wrong && (
          <p className="an-error" role="alert">
            Пароль не подошёл. Проверьте значение ADMIN_TOKEN в файле .env.
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
          Войти
        </button>
      </form>
    </div>
  );
}

export default function AnalyzerApp({ hash }: { hash: string }) {
  const route = parseHash(hash);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<ApiError | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [wrongToken, setWrongToken] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const loadConfig = useCallback(async (afterToken = false) => {
    setLoadingConfig(true);
    try {
      const c = await api<AppConfig>('/api/config');
      setConfig(c);
      setConfigError(null);
      setNeedsAuth(false);
      setWrongToken(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') {
        setNeedsAuth(true);
        setWrongToken(afterToken);
        setConfig(null);
      } else {
        setConfigError(e instanceof ApiError ? e : new ApiError('error', (e as Error).message, 0));
      }
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Счётчики в меню
  useEffect(() => {
    if (!config) return;
    const ctl = new AbortController();
    api<Stats>('/api/stats', { signal: ctl.signal })
      .then(setStats)
      .catch(() => {
        /* счётчики — второстепенные, ошибку не показываем */
      });
    return () => ctl.abort();
  }, [config, statsVersion]);

  const onChanged = useCallback(() => setStatsVersion((v) => v + 1), []);

  // Заголовок вкладки и фокус при смене раздела
  const activeTab = route.tab;
  const activeLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Раздел не найден';
  useEffect(() => {
    const prev = document.title;
    document.title = `${activeLabel} — Анализатор референсов`;
    return () => {
      document.title = prev;
    };
  }, [activeLabel]);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const counts: Partial<Record<TabKey, number>> = stats
    ? {
        history: Object.values(stats.analyses).reduce((a, b) => a + b, 0),
        ideas: stats.ideas.new,
        approved: stats.ideas.approved,
        implemented: stats.ideas.implemented,
      }
    : {};

  function renderScreen(cfg: AppConfig) {
    if (!route.valid || !route.tab) {
      return (
        <div className="an-empty">
          <h1 className="an-empty__title">Такого раздела нет</h1>
          <div className="an-empty__action">
            <a className="btn btn--primary btn--sm" href="#/analyzer">
              Открыть Dashboard
            </a>
          </div>
        </div>
      );
    }
    switch (route.tab) {
      case 'dashboard':
        return <Dashboard config={cfg} statsVersion={statsVersion} onChanged={onChanged} />;
      case 'add':
        return <AddUrl config={cfg} onChanged={onChanged} />;
      case 'search':
        return <Search config={cfg} onChanged={onChanged} />;
      case 'history':
        return route.id ? <HistoryDetails key={route.id} id={route.id} onChanged={onChanged} /> : <HistoryList onChanged={onChanged} />;
      case 'ideas':
        return <IdeasScreen onChanged={onChanged} />;
      case 'approved':
        return <ApprovedScreen onChanged={onChanged} />;
      case 'implemented':
        return <ImplementedScreen onChanged={onChanged} />;
      case 'settings':
        return <SettingsScreen config={cfg} onSaved={() => void loadConfig()} />;
    }
  }

  const nav = (
    <ul className="an-nav__list">
      {TABS.map((t) => {
        const current = t.key === activeTab;
        const count = counts[t.key];
        return (
          <li key={t.key}>
            <a href={`#/analyzer/${t.key === 'dashboard' ? '' : t.key}`} className="an-nav__link" aria-current={current ? 'page' : undefined}>
              <span>{t.label}</span>
              {count !== undefined && count > 0 && (
                <span className="an-nav__count">
                  {count}
                  <span className="sr-only"> шт.</span>
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="an-app">
      <header className="an-header">
        <div className="an-header__inner">
          <a className="an-brand" href="#/analyzer">
            <span className="an-brand__mark" aria-hidden="true">
              E
            </span>
            <span className="an-brand__text">
              <strong>Анализатор референсов</strong>
              <small>EXAMPLE Auto Service</small>
            </span>
          </a>
          <a className="an-header__site" href="#/">
            ← На сайт
          </a>
          <button
            type="button"
            className="an-header__menu"
            aria-expanded={menuOpen}
            aria-controls="an-mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
            <span>{menuOpen ? 'Закрыть' : 'Разделы'}</span>
          </button>
        </div>
        {menuOpen && (
          <nav id="an-mobile-nav" className="an-mobilenav" aria-label="Разделы панели">
            {nav}
          </nav>
        )}
      </header>

      <div className="an-layout">
        <nav className="an-sidebar" aria-label="Разделы панели">
          {nav}
          <p className="an-sidebar__note">
            Анализатор ничего не меняет в коде сайта сам. Идея становится задачей только после вашего одобрения.
          </p>
        </nav>

        <main className="an-main" id="an-main" ref={mainRef} tabIndex={-1}>
          {loadingConfig && !config && !needsAuth && <Spinner label="Подключение к серверу анализатора…" />}
          {needsAuth && (
            <AuthGate
              wrong={wrongToken}
              onSubmit={(t) => {
                setToken(t);
                void loadConfig(true);
              }}
            />
          )}
          {configError && !config && !needsAuth && (
            <div className="an-card an-card--error" role="alert">
              <h1 className="an-h2">Сервер анализатора недоступен</h1>
              <p>{configError.message}</p>
              <p className="an-hint">
                Панель работает только вместе с сервером. Запустите проект командой <code>npm run dev</code> (или файлом <code>start.bat</code>) и обновите страницу. Сайт-пример при этом работает и без сервера.
              </p>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void loadConfig()}>
                Проверить ещё раз
              </button>
            </div>
          )}
          {config && renderScreen(config)}
        </main>
      </div>
    </div>
  );
}
