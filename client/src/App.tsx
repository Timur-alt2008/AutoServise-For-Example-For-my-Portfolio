import { Suspense, lazy, useEffect, useState } from 'react';
import { Site } from './components/site/Site';

// Панель анализатора грузится отдельным файлом и не утяжеляет сайт
const AnalyzerApp = lazy(() => import('./analyzer/AnalyzerApp'));

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const isAnalyzer = hash.startsWith('#/analyzer');

  useEffect(() => {
    // тёмная тема сайта (класс задан в index.html, чтобы не было вспышки светлого фона) — не для панели
    document.body.classList.toggle('site-body', !isAnalyzer);
    if (isAnalyzer) window.scrollTo(0, 0);
  }, [isAnalyzer]);

  if (isAnalyzer) {
    return (
      <Suspense fallback={<div className="an-boot" role="status">Загрузка панели…</div>}>
        <AnalyzerApp hash={hash} />
      </Suspense>
    );
  }
  return <Site />;
}
