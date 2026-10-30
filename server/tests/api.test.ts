import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
import type { App } from '../src/app.ts';
import { ROOT } from '../src/config.ts';
import type { Config } from '../src/config.ts';
import { RICH_CONTACTS, RICH_CSS, RICH_HOME, RICH_SERVICES } from './fixtures.ts';
import type { FakeSite } from './helpers.ts';
import { startFakeSite, testConfig } from './helpers.ts';

interface Harness {
  app: App;
  base: string;
  call(method: string, p: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; json: any }>;
  close(): Promise<void>;
}

async function harness(overrides: Partial<Config> = {}): Promise<Harness> {
  const config = testConfig({ port: 0, ...overrides });
  const app = createApp(config);
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  return {
    app,
    base,
    async call(method, p, body, headers = {}) {
      const res = await fetch(`${base}${p}`, {
        method,
        headers: {
          ...(method !== 'GET' ? { 'x-analyzer-client': '1' } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      return { status: res.status, json };
    },
    close: () => app.close(),
  };
}

function motorSite(): Promise<FakeSite> {
  return startFakeSite({
    '/': { body: RICH_HOME },
    '/services': { body: RICH_SERVICES },
    '/contacts': { body: RICH_CONTACTS },
    '/prices': { body: '<html><head><title>Цены</title></head><body><h1>Цены</h1><p>Диагностика от 400 грн</p></body></html>' },
    '/style.css': { headers: { 'content-type': 'text/css' }, body: RICH_CSS },
    '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /admin\n' },
  });
}

async function waitDone(h: Harness, id: number): Promise<any> {
  await h.app.service.idle();
  const { json } = await h.call('GET', `/api/analyses/${id}`);
  return json;
}

/** Хэш всех файлов интерфейса: нужен, чтобы доказать, что анализатор не меняет код сайта. */
function hashTree(dir: string): string {
  const hash = createHash('sha256');
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else hash.update(full).update(readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------

test('добавление URL → анализ нескольких страниц → идеи в панели', async () => {
  const site = await motorSite();
  const h = await harness();
  try {
    const created = await h.call('POST', '/api/analyses', { url: site.url });
    assert.equal(created.status, 202);
    assert.equal(created.json.analysis.status, 'queued');
    const id = created.json.analysis.id as number;

    const done = await waitDone(h, id);
    assert.equal(done.analysis.status, 'done', JSON.stringify(done.analysis.errorMessage));
    const r = done.analysis.result;
    assert.equal(r.stats.pagesFetched, 4, 'главная + услуги + цены + контакты (4 страницы — лимит настроек)');
    assert.equal(r.stats.stylesheetsFetched, 1);
    assert.ok(r.analysis.design.accents.includes('#e87532'), 'цвета взяты из загруженной таблицы стилей');
    assert.ok(r.analysis.features.faq.present === 'yes');
    assert.ok(done.ideas.length >= 8);
    assert.ok(done.ideas.every((i: any) => i.status === 'new'), 'все найденные идеи начинают со статуса «новая»');
    assert.ok(r.filtered.some((f: any) => f.kind === 'already_in_project'));
    assert.ok(r.filtered.some((f: any) => f.kind === 'realism'));
    assert.equal(r.pageIssues.length, 0);

    // закрытый robots.txt раздел не запрашивался; сайт видел честного бота
    assert.ok(!site.hits.some((x) => x.path.startsWith('/admin')));
    assert.ok(site.hits.every((x) => x.userAgent.includes('WebInspirationAnalyzer')));

    const list = await h.call('GET', '/api/analyses');
    assert.equal(list.json.analyses.length, 1);
    assert.equal(list.json.analyses[0].result, undefined, 'в списке нет тяжёлых результатов');

    const stats = await h.call('GET', '/api/stats');
    assert.equal(stats.json.analyses.done, 1);
    assert.equal(stats.json.ideas.new, done.ideas.length);
    assert.equal(stats.json.sitesAnalyzed, 1);
  } finally {
    await h.close();
    await site.close();
  }
});

test('повторный анализ берёт страницы из кэша и не сбрасывает решения пользователя', async () => {
  const site = await motorSite();
  const h = await harness();
  try {
    const first = await h.call('POST', '/api/analyses', { url: site.url });
    await waitDone(h, first.json.analysis.id);
    const before = site.hits.length;

    const ideas = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    const rejected = ideas[0];
    assert.equal((await h.call('PATCH', `/api/ideas/${rejected.id}`, { status: 'rejected', note: 'не подходит' })).status, 200);

    const rerun = await h.call('POST', `/api/analyses/${first.json.analysis.id}/rerun`, {});
    assert.equal(rerun.status, 202);
    assert.equal(rerun.json.analysis.rerunOf, first.json.analysis.id);
    const second = await waitDone(h, rerun.json.analysis.id);
    assert.equal(second.analysis.status, 'done');
    assert.equal(site.hits.length, before, 'повтор не обращался к сайту — всё из кэша');
    assert.ok(second.analysis.result.stats.fromCache >= 5);
    assert.equal(second.analysis.result.stats.ideasCreated, 0, 'новых идей нет — те же найдены повторно');
    assert.ok(second.analysis.result.stats.ideasUpdated > 0);

    const after = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    assert.equal(after.length, ideas.length, 'дубликаты не создаются');
    const same = after.find((i) => i.id === rejected.id);
    assert.equal(same.status, 'rejected', 'отклонённая идея не воскресает после повторного анализа');
    assert.equal(same.note, 'не подходит');
  } finally {
    await h.close();
    await site.close();
  }
});

test('одобрение, отклонение, реализация: статусы, задачи и запрет недопустимых переходов', async () => {
  const site = await motorSite();
  const h = await harness();
  try {
    const a = await h.call('POST', '/api/analyses', { url: site.url });
    await waitDone(h, a.json.analysis.id);
    const ideas = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    const [i1, i2] = ideas;

    // новая → реализована напрямую нельзя
    const bad = await h.call('PATCH', `/api/ideas/${i1.id}`, { status: 'implemented' });
    assert.equal(bad.status, 409);
    assert.equal(bad.json.error.code, 'invalid_transition');
    assert.equal((await h.call('PATCH', `/api/ideas/${i1.id}`, { status: 'абракадабра' })).status, 400);
    assert.equal((await h.call('PATCH', '/api/ideas/99999', { status: 'approved' })).status, 404);

    // одобрить → появляется конкретная задача
    const approved = await h.call('PATCH', `/api/ideas/${i1.id}`, { status: 'approved' });
    assert.equal(approved.json.idea.status, 'approved');
    assert.equal(approved.json.idea.task.status, 'open');
    assert.ok(approved.json.idea.task.title.startsWith('Внедрить:'));
    assert.ok(approved.json.idea.task.steps.length >= 2);
    assert.ok(approved.json.idea.task.checks.some((c: string) => c.includes('320')));
    assert.equal((await h.call('GET', '/api/tasks?status=open')).json.tasks.length, 1);

    // отметить реализованной → задача закрыта
    const impl = await h.call('PATCH', `/api/ideas/${i1.id}`, { status: 'implemented' });
    assert.equal(impl.json.idea.task.status, 'done');
    assert.ok(impl.json.idea.task.doneAt);
    assert.equal((await h.call('GET', '/api/tasks?status=open')).json.tasks.length, 0);

    // отклонить другую; вернуть в новые
    assert.equal((await h.call('PATCH', `/api/ideas/${i2.id}`, { status: 'rejected' })).json.idea.status, 'rejected');
    assert.equal((await h.call('PATCH', `/api/ideas/${i2.id}`, { status: 'new' })).json.idea.status, 'new');
    // одобрить и отклонить — задача отменяется
    await h.call('PATCH', `/api/ideas/${i2.id}`, { status: 'approved' });
    const rej = await h.call('PATCH', `/api/ideas/${i2.id}`, { status: 'rejected' });
    assert.equal(rej.json.idea.task.status, 'cancelled');

    // фильтры списка
    const byStatus = (s: string) => h.call('GET', `/api/ideas?status=${s}`).then((r) => r.json.ideas as any[]);
    assert.equal((await byStatus('implemented')).length, 1);
    assert.equal((await byStatus('rejected')).length, 1);
    assert.equal((await byStatus('approved')).length, 0);
    assert.equal((await byStatus('new')).length, ideas.length - 2);
    const search = (await h.call('GET', '/api/ideas?q=' + encodeURIComponent('Telegram'))).json.ideas as any[];
    assert.ok(search.length >= 1 && search.every((i) => /telegram/i.test(i.title + i.description)));
    const simple = (await h.call('GET', '/api/ideas?complexity=' + encodeURIComponent('простая'))).json.ideas as any[];
    assert.ok(simple.length > 0 && simple.every((i) => i.scores.complexity <= 2));
    const high = (await h.call('GET', '/api/ideas?minScore=85')).json.ideas as any[];
    assert.ok(high.every((i) => i.totalScore >= 85));
  } finally {
    await h.close();
    await site.close();
  }
});

test('анализатор не меняет файлы сайта (интерфейс) ни при анализе, ни при одобрении идей', async () => {
  const dirs = [path.join(ROOT, 'client', 'src'), path.join(ROOT, 'client', 'index.html')].filter((p) => {
    try {
      statSync(p);
      return true;
    } catch {
      return false;
    }
  });
  const hashAll = () => dirs.map((d) => (statSync(d).isDirectory() ? hashTree(d) : createHash('sha256').update(readFileSync(d)).digest('hex'))).join('|');
  const before = hashAll();
  const site = await motorSite();
  const h = await harness();
  try {
    const a = await h.call('POST', '/api/analyses', { url: site.url });
    await waitDone(h, a.json.analysis.id);
    const ideas = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    for (const i of ideas.slice(0, 3)) await h.call('PATCH', `/api/ideas/${i.id}`, { status: 'approved' });
    for (const i of ideas.slice(0, 2)) await h.call('PATCH', `/api/ideas/${i.id}`, { status: 'implemented' });
    assert.equal(hashAll(), before, 'код сайта остался прежним');
    assert.ok(dirs.length > 0, 'проверяемые файлы существуют');
  } finally {
    await h.close();
    await site.close();
  }
});

test('ошибки: неверный адрес, недоступный сайт, robots.txt, защита от ботов, внутренние адреса', async () => {
  const site = await startFakeSite({
    '/': { body: RICH_HOME },
    '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /' },
  });
  const wall = await startFakeSite({ '/': { status: 403, body: 'Forbidden' } });
  const h = await harness();
  const secure = await harness({ allowPrivateHosts: false });
  try {
    assert.equal((await h.call('POST', '/api/analyses', {})).status, 400);
    assert.equal((await h.call('POST', '/api/analyses', { url: 'ftp://x.example' })).status, 400);
    assert.equal((await h.call('POST', '/api/analyses', { url: '   ' })).json.error.code, 'invalid_url');

    // robots.txt запрещает всё → «blocked», страница не запрашивалась
    const closed = await h.call('POST', '/api/analyses', { url: site.url });
    const c = await waitDone(h, closed.json.analysis.id);
    assert.equal(c.analysis.status, 'blocked');
    assert.equal(c.analysis.errorCode, 'robots_disallowed');
    assert.match(c.analysis.errorMessage, /robots\.txt/);
    assert.deepEqual(site.hits.map((x) => x.path), ['/robots.txt']);

    // 403 → blocked, без повторов
    const forbidden = await h.call('POST', '/api/analyses', { url: wall.url });
    const f = await waitDone(h, forbidden.json.analysis.id);
    assert.equal(f.analysis.status, 'blocked');
    assert.equal(f.analysis.errorCode, 'blocked');
    assert.equal(wall.hits.filter((x) => x.path === '/').length, 1);

    // недоступный сайт: закрыли порт
    const dead = await startFakeSite({});
    const deadUrl = dead.url;
    await dead.close();
    const gone = await h.call('POST', '/api/analyses', { url: deadUrl });
    const g = await waitDone(h, gone.json.analysis.id);
    assert.equal(g.analysis.status, 'error');
    assert.ok(['connection_refused', 'robots_unreachable', 'network_error'].includes(g.analysis.errorCode), g.analysis.errorCode);
    assert.ok(g.analysis.errorMessage.length > 10);

    // повторный запуск после ошибки
    const rr = await h.call('POST', `/api/analyses/${g.analysis.id}/rerun`, {});
    assert.equal(rr.status, 202);
    await h.app.service.idle();

    // внутренние адреса запрещены в обычном режиме
    const priv = await secure.call('POST', '/api/analyses', { url: 'http://127.0.0.1:8080/' });
    assert.equal(priv.status, 400);
    const priv2 = await secure.call('POST', '/api/analyses', { url: 'https://localhost/' });
    assert.equal(priv2.status, 400);

    // удалить можно только завершённый анализ
    assert.equal((await h.call('DELETE', `/api/analyses/${g.analysis.id}`)).status, 200);
    assert.equal((await h.call('GET', `/api/analyses/${g.analysis.id}`)).status, 404);
  } finally {
    await h.close();
    await secure.close();
    await site.close();
    await wall.close();
  }
});

test('тайм-аут: медленный сайт не вешает анализ', async () => {
  const slow = await startFakeSite({ '/': { body: RICH_HOME, delayMs: 3000 }, '/robots.txt': { status: 404, body: '' } });
  const h = await harness({ fetchTimeoutMs: 300 });
  try {
    const t0 = Date.now();
    const r = await h.call('POST', '/api/analyses', { url: slow.url });
    const done = await waitDone(h, r.json.analysis.id);
    assert.equal(done.analysis.status, 'error');
    assert.equal(done.analysis.errorCode, 'timeout');
    assert.ok(Date.now() - t0 < 2500);
  } finally {
    await h.close();
    await slow.close();
  }
});

test('удаление анализа сохраняет решения по идеям', async () => {
  const site = await motorSite();
  const h = await harness();
  try {
    const a = await h.call('POST', '/api/analyses', { url: site.url });
    await waitDone(h, a.json.analysis.id);
    const ideas = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    await h.call('PATCH', `/api/ideas/${ideas[0].id}`, { status: 'approved' });
    assert.equal((await h.call('DELETE', `/api/analyses/${a.json.analysis.id}`)).status, 200);
    const left = (await h.call('GET', '/api/ideas')).json.ideas as any[];
    assert.equal(left.length, ideas.length);
    assert.equal(left.find((i) => i.id === ideas[0].id).status, 'approved');
    assert.equal(left[0].analysisId, null);
  } finally {
    await h.close();
    await site.close();
  }
});

test('настройки: проверка границ, нельзя отключить robots.txt, чёрный список доменов', async () => {
  const site = await motorSite();
  const h = await harness({ allowPrivateHosts: true });
  try {
    const s = await h.call('GET', '/api/settings');
    assert.equal(s.json.settings.respectRobots, true);
    assert.equal((await h.call('PUT', '/api/settings', { respectRobots: false })).status, 400);
    assert.equal((await h.call('PUT', '/api/settings', { fetchTimeoutMs: 'быстро' })).status, 400);
    assert.equal((await h.call('PUT', '/api/settings', { cacheTtlHours: 9999 })).status, 400);
    assert.equal((await h.call('PUT', '/api/settings', { blockedDomains: 'x' })).status, 400);
    const ok = await h.call('PUT', '/api/settings', { maxPagesPerAnalysis: 2, blockedDomains: ['https://www.Spam.com/page', 'spam.com', 'bad.org'] });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json.settings.blockedDomains, ['spam.com', 'bad.org']);
    assert.equal(ok.json.settings.maxPagesPerAnalysis, 2);
    // настройка действует
    const a = await h.call('POST', '/api/analyses', { url: site.url });
    const done = await waitDone(h, a.json.analysis.id);
    assert.equal(done.analysis.result.stats.pagesFetched, 2);
    await h.call('PUT', '/api/settings', { blockedDomains: ['127.0.0.1'] });
    const blocked = await h.call('POST', '/api/analyses', { url: site.url });
    const b = await waitDone(h, blocked.json.analysis.id);
    assert.equal(b.analysis.errorCode, 'blocked');
    assert.equal((await h.call('POST', '/api/cache/clear', {})).status, 200);
  } finally {
    await h.close();
    await site.close();
  }
});

test('поиск референсов: без ключей — честный отказ, с ключом — реальные результаты из API без выдумок', async () => {
  const none = await harness();
  try {
    const cfg = await none.call('GET', '/api/config');
    assert.equal(cfg.json.search.configured, false);
    assert.equal(cfg.json.search.presets.length, 8);
    const r = await none.call('POST', '/api/search', { query: 'Auto repair website design' });
    assert.equal(r.status, 503);
    assert.equal(r.json.error.code, 'search_not_configured');
    assert.match(r.json.error.message, /вручную/);
  } finally {
    await none.close();
  }

  const target = await motorSite();
  const fakeBrave = await startFakeSite({
    '/search': {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        web: {
          results: [
            { title: 'Мотор <strong>сервис</strong>', url: `${target.url}/services/brakes`, description: 'Ремонт &amp; диагностика' },
            { title: 'Соцсеть', url: 'https://www.facebook.com/motor', description: 'не сайт' },
            { title: 'Дубль', url: `${target.url}/contacts`, description: 'тот же сайт' },
            { title: 'Мусор', url: 'javascript:alert(1)', description: '' },
          ],
        },
      }),
    },
  });
  const h = await harness({ braveKey: 'test-key', braveUrl: `${fakeBrave.url}/search` });
  try {
    const cfg = await h.call('GET', '/api/config');
    assert.equal(cfg.json.search.configured, true);
    const r = await h.call('POST', '/api/search', { query: 'Автосервис запись онлайн' });
    assert.equal(r.status, 200);
    assert.equal(r.json.provider, 'brave');
    assert.equal(r.json.results.length, 1, 'соцсети, дубли и мусор отфильтрованы');
    assert.equal(r.json.results[0].title, 'Мотор сервис');
    assert.equal(r.json.results[0].snippet, 'Ремонт & диагностика');
    assert.equal(r.json.results[0].url, `${target.url}/`, 'анализируется главная страница сайта');
    assert.equal(fakeBrave.hits[0].path.includes('q='), true);

    const again = await h.call('POST', '/api/search', { query: 'Автосервис запись онлайн' });
    assert.equal(again.json.cached, true);
    assert.equal(fakeBrave.hits.length, 1, 'повторный запрос идёт из кэша');

    assert.equal((await h.call('POST', '/api/search', { query: 'ab' })).status, 400);
    const go = await h.call('POST', `/api/search/results/${r.json.results[0].id}/analyze`, {});
    assert.equal(go.status, 202);
    const done = await waitDone(h, go.json.analysis.id);
    assert.equal(done.analysis.status, 'done');
    assert.equal((await h.call('POST', '/api/search/results/999/analyze', {})).status, 404);
  } finally {
    await h.close();
    await fakeBrave.close();
    await target.close();
  }
});

test('ИИ-адаптер: идеи проходят тот же фильтр; без ключа — понятное сообщение; ошибки не ломают анализ', async () => {
  const site = await motorSite();
  const aiBody = {
    content: [{ type: 'text', text: JSON.stringify({ ideas: [
      { title: 'Напоминание о ТО по пробегу', description: 'Форма: введите пробег — получите напоминание', scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 3, complexity: 2 }, realism: { fitsRegularAutoService: true, helpsClientOrOwner: true, noExpensiveInfrastructure: true, noInventedData: true, noFalsePromises: true, notOverloading: true, worksOnMobile: true, matchesBrandStyle: true }, steps: ['один', 'два'] },
      { title: 'Голографическая панель авто', description: 'Неоновая 3D-панель', scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 5, complexity: 1 }, realism: { fitsRegularAutoService: true, helpsClientOrOwner: true, noExpensiveInfrastructure: true, noInventedData: true, noFalsePromises: true, notOverloading: true, worksOnMobile: true, matchesBrandStyle: true } },
    ] }) }],
  };
  const fakeAi = await startFakeSite({ '/v1/messages': { headers: { 'content-type': 'application/json' }, body: JSON.stringify(aiBody) } });
  const failingAi = await startFakeSite({ '/v1/messages': { status: 500, body: 'boom' } });
  const noKey = await harness();
  const good = await harness({ anthropicKey: 'k', anthropicUrl: `${fakeAi.url}/v1/messages` });
  const bad = await harness({ anthropicKey: 'k', anthropicUrl: `${failingAi.url}/v1/messages` });
  try {
    assert.equal((await noKey.call('GET', '/api/config')).json.ai.configured, false);
    const n = await noKey.call('POST', '/api/analyses', { url: site.url, useAi: true });
    const nd = await waitDone(noKey, n.json.analysis.id);
    assert.equal(nd.analysis.status, 'done');
    assert.equal(nd.analysis.result.ai.used, false);
    assert.match(nd.analysis.result.ai.error, /ANTHROPIC_API_KEY/);

    const g = await good.call('POST', '/api/analyses', { url: site.url, useAi: true });
    const gd = await waitDone(good, g.json.analysis.id);
    assert.equal(gd.analysis.result.ai.used, true);
    assert.equal(gd.analysis.result.ai.ideas, 1);
    const aiIdeas = gd.ideas.filter((i: any) => i.origin === 'ai');
    assert.equal(aiIdeas.length, 1);
    assert.equal(aiIdeas[0].status, 'new');
    assert.ok(gd.analysis.result.filtered.some((f: any) => f.title.includes('Голографическая') && f.kind === 'realism'));
    assert.equal(fakeAi.hits.length, 1);
    // в модель уходит сводка, а не весь HTML
    // (проверяем размер запроса косвенно: сервер получил один запрос)

    const b = await bad.call('POST', '/api/analyses', { url: site.url, useAi: true });
    const bd = await waitDone(bad, b.json.analysis.id);
    assert.equal(bd.analysis.status, 'done', 'сбой ИИ не ломает основной анализ');
    assert.equal(bd.analysis.result.ai.used, false);
    assert.match(bd.analysis.result.ai.error, /500/);
  } finally {
    await noKey.close();
    await good.close();
    await bad.close();
    await fakeAi.close();
    await failingAi.close();
    await site.close();
  }
});

test('безопасность API: служебный заголовок, Host, Origin, пароль, формат тела', async () => {
  const h = await harness();
  const locked = await harness({ adminToken: 'secret-123' });
  try {
    // без служебного заголовка изменяющие запросы отклоняются
    const res = await fetch(`${h.base}/api/analyses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'http://x.y' }) });
    assert.equal(res.status, 401);
    // неверный Host (защита от DNS rebinding)
    const status = await new Promise<number>((resolve, reject) => {
      const u = new URL(`${h.base}/api/health`);
      const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, headers: { host: 'evil.example.com' } }, (r) => { r.resume(); resolve(r.statusCode ?? 0); });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
    // чужой Origin
    const o = await fetch(`${h.base}/api/stats`, { headers: { origin: 'https://evil.example.com' } });
    assert.equal(o.status, 403);
    const okOrigin = await fetch(`${h.base}/api/stats`, { headers: { origin: 'http://localhost:5173' } });
    assert.equal(okOrigin.status, 200);
    // не JSON
    const bad = await fetch(`${h.base}/api/analyses`, { method: 'POST', headers: { 'x-analyzer-client': '1', 'content-type': 'text/plain' }, body: 'url=x' });
    assert.equal(bad.status, 400);
    const broken = await fetch(`${h.base}/api/analyses`, { method: 'POST', headers: { 'x-analyzer-client': '1', 'content-type': 'application/json' }, body: '{oops' });
    assert.equal(broken.status, 400);
    assert.equal((await h.call('GET', '/api/нет-такого')).status, 404);
    assert.equal((await h.call('DELETE', '/api/stats')).status, 405);
    assert.equal((await h.call('GET', '/api/analyses/abc')).status, 400);

    // с паролем
    assert.equal((await locked.call('GET', '/api/stats')).status, 401);
    assert.equal((await locked.call('GET', '/api/stats', undefined, { authorization: 'Bearer wrong-token' })).status, 401);
    assert.equal((await locked.call('GET', '/api/stats', undefined, { authorization: 'Bearer secret-123' })).status, 200);
    assert.equal((await locked.call('GET', '/api/health')).status, 200, 'health открыт');
  } finally {
    await h.close();
    await locked.close();
  }
});

test('заявки с сайта: без настройки — честный 501; с Telegram — отправка; проверка полей; ограничение частоты', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const valid = { name: 'Иван', phone: '+380 00 123 45 67', make: 'BMW', model: 'X5', year: '2015', service: 'Диагностика', problem: 'Стук при повороте', date: tomorrow, time: '10:30' };

  const none = await harness();
  const fakeTg = await startFakeSite({ '/botTOKEN/sendMessage': { headers: { 'content-type': 'application/json' }, body: '{"ok":true}' } });
  const h = await harness({ telegramToken: 'TOKEN', telegramChatId: '42', telegramUrl: fakeTg.url });
  try {
    const r = await none.call('POST', '/api/bookings', valid);
    assert.equal(r.status, 501);
    assert.equal(r.json.error.code, 'booking_not_configured');
    assert.equal((await none.call('GET', '/api/config')).json.booking.configured, false);

    // публичный адрес не требует служебного заголовка, но требует JSON
    const plain = await fetch(`${h.base}/api/bookings`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
    assert.equal(plain.status, 400);

    const badFields = await h.call('POST', '/api/bookings', { ...valid, name: '', phone: 'abc', date: '2001-01-01', year: '20x5' }, { 'x-analyzer-client': '' });
    assert.equal(badFields.status, 422);
    assert.deepEqual(Object.keys(badFields.json.error.fields).sort(), ['date', 'name', 'phone', 'year']);
    assert.equal(fakeTg.hits.length, 0, 'невалидная заявка никуда не уходит');

    const ok = await h.call('POST', '/api/bookings', valid, { 'x-analyzer-client': '' });
    assert.equal(ok.status, 200);
    assert.equal(fakeTg.hits.length, 1);
    assert.equal(fakeTg.hits[0].path, '/botTOKEN/sendMessage');

    // ограничение: не больше 5 заявок в минуту с одного адреса (одна уже отправлена, одна невалидная не считается)
    let limited = 0;
    for (let i = 0; i < 8; i++) {
      const x = await h.call('POST', '/api/bookings', valid, { 'x-analyzer-client': '' });
      if (x.status === 429) limited++;
    }
    assert.ok(limited >= 3, `ожидалось ограничение, получили ${limited}`);
  } finally {
    await none.close();
    await h.close();
    await fakeTg.close();
  }
});

test('сервер отдаёт собранный интерфейс и не пускает за пределы папки', async () => {
  const h = await harness({ clientDist: path.join(ROOT, 'server', 'tests', 'no-such-dist') });
  try {
    const res = await fetch(`${h.base}/`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /не собран/);
    const trav = await fetch(`${h.base}/..%2F..%2Fpackage.json`);
    assert.ok([403, 404].includes(trav.status));
  } finally {
    await h.close();
  }
});
