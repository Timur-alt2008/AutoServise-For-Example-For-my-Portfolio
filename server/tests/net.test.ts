import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnalyzerError } from '../src/errors.ts';
import { HostLimiter, WindowCounter } from '../src/net/limiter.ts';
import { PageFetcher, looksLikeBotWall } from '../src/net/fetcher.ts';
import { crawlDelaySeconds, isAllowed, parseRobots } from '../src/net/robots.ts';
import { assertPublicHost, isPrivateIp, normalizeUrl } from '../src/net/safety.ts';
import { defaultSettings } from '../src/settings.ts';
import { sleep, startFakeSite, testConfig, testDb } from './helpers.ts';

// ---------------------------------------------------------------------------
// Адреса и защита от обращений во внутреннюю сеть
// ---------------------------------------------------------------------------

test('normalizeUrl: добавляет https, убирает #, отбрасывает мусор', () => {
  assert.equal(normalizeUrl('example.com/page#top').toString(), 'https://example.com/page');
  assert.equal(normalizeUrl('  http://example.com ').protocol, 'http:');
  for (const bad of ['', '   ', 'ftp://example.com', 'javascript:alert(1)', 'http://user:pw@example.com', 'https://example.com:8443/', 'http://localhost/', 'http://intranet/']) {
    assert.throws(() => normalizeUrl(bad), (e) => e instanceof AnalyzerError && ['invalid_url', 'private_address'].includes(e.code), bad);
  }
});

test('isPrivateIp распознаёт внутренние адреса', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.16.5.5', '172.31.255.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('assertPublicHost блокирует IP внутренней сети', async () => {
  await assert.rejects(() => assertPublicHost('127.0.0.1', false), (e) => e instanceof AnalyzerError && e.code === 'private_address');
  await assert.rejects(() => assertPublicHost('[::1]', false), (e) => e instanceof AnalyzerError && e.code === 'private_address');
  await assertPublicHost('127.0.0.1', true); // в тестовом режиме разрешено
});

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

const ROBOTS = `
# comment
User-agent: *
Disallow: /admin
Disallow: /private/
Allow: /private/public
Disallow: /*.pdf$
Crawl-delay: 3

User-agent: WebInspirationAnalyzer
Disallow: /secret
Allow: /

Sitemap: https://example.com/sitemap.xml
`;

test('robots: группа нашего бота важнее «*»', () => {
  const r = parseRobots(ROBOTS);
  assert.equal(isAllowed(r, 'WebInspirationAnalyzer', '/secret/page'), false);
  assert.equal(isAllowed(r, 'WebInspirationAnalyzer', '/admin'), true, 'в группе бота /admin не закрыт');
  assert.equal(r.sitemaps.length, 1);
});

test('robots: правила «*», самое длинное совпадение, wildcard и $', () => {
  const r = parseRobots(ROBOTS);
  assert.equal(isAllowed(r, 'SomeOtherBot', '/admin/users'), false);
  assert.equal(isAllowed(r, 'SomeOtherBot', '/private/data'), false);
  assert.equal(isAllowed(r, 'SomeOtherBot', '/private/public/x'), true, 'Allow длиннее Disallow');
  assert.equal(isAllowed(r, 'SomeOtherBot', '/files/a.pdf'), false);
  assert.equal(isAllowed(r, 'SomeOtherBot', '/files/a.pdf?x=1'), true, '$ привязывает к концу');
  assert.equal(isAllowed(r, 'SomeOtherBot', '/services'), true);
  assert.equal(crawlDelaySeconds(r, 'SomeOtherBot'), 3);
});

test('robots: пустой файл и Disallow: / ', () => {
  assert.equal(isAllowed(parseRobots(''), 'X', '/anything'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), 'X', '/anything'), true);
  const closed = parseRobots('User-agent: *\nDisallow: /');
  assert.equal(isAllowed(closed, 'X', '/'), false);
  assert.equal(isAllowed(closed, 'X', '/robots.txt'), true);
});

// ---------------------------------------------------------------------------
// Ограничение частоты
// ---------------------------------------------------------------------------

test('HostLimiter: запросы к одному сайту идут с паузой, к разным — параллельно', async () => {
  const limiter = new HostLimiter();
  const starts: Record<string, number[]> = { a: [], b: [] };
  const t0 = Date.now();
  const job = (host: 'a' | 'b') => limiter.run(host, 300, async () => { starts[host].push(Date.now() - t0); });
  await Promise.all([job('a'), job('a'), job('a'), job('b')]);
  assert.ok(starts.a[1] - starts.a[0] >= 280, `a: ${starts.a}`);
  assert.ok(starts.a[2] - starts.a[1] >= 280, `a: ${starts.a}`);
  assert.ok(starts.b[0] < 100, `b не должен ждать: ${starts.b}`);
  assert.ok(limiter.throttled >= 2);
});

test('HostLimiter: ошибка одного запроса не ломает очередь', async () => {
  const limiter = new HostLimiter();
  const failing = limiter.run('x', 10, async () => { throw new Error('boom'); });
  const ok = limiter.run('x', 10, async () => 'fine');
  await assert.rejects(failing);
  assert.equal(await ok, 'fine');
});

test('WindowCounter ограничивает число событий в окне', () => {
  const c = new WindowCounter(2, 1000);
  assert.equal(c.allow('ip', 0), true);
  assert.equal(c.allow('ip', 10), true);
  assert.equal(c.allow('ip', 20), false);
  assert.equal(c.allow('other', 20), true);
  assert.equal(c.allow('ip', 1500), true);
});

// ---------------------------------------------------------------------------
// Загрузка страниц
// ---------------------------------------------------------------------------

function makeFetcher(overrides = {}, settingsOverrides = {}) {
  const config = testConfig(overrides);
  const db = testDb();
  const settings = { ...defaultSettings(config), ...settingsOverrides };
  return { fetcher: new PageFetcher(db, config, () => settings), db, config };
}

const PAGE = '<!doctype html><html><head><title>Тест</title></head><body><h1>Привет</h1></body></html>';

test('fetchPage: загружает страницу, представляется как бот, читает robots.txt, кэширует', async () => {
  const site = await startFakeSite({ '/': { body: PAGE }, '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /private' } });
  try {
    const { fetcher } = makeFetcher();
    const first = await fetcher.fetchPage(`${site.url}/`);
    assert.equal(first.status, 200);
    assert.equal(first.fromCache, false);
    assert.match(first.body, /Привет/);
    assert.ok(site.hits.some((h) => h.path === '/robots.txt'), 'robots.txt запрошен');
    assert.ok(site.hits.every((h) => h.userAgent.includes('WebInspirationAnalyzer')), 'бот представляется честно');

    const before = site.hits.length;
    const second = await fetcher.fetchPage(`${site.url}/`);
    assert.equal(second.fromCache, true);
    assert.equal(site.hits.length, before, 'повторный запрос идёт из кэша, сайт не трогаем');
  } finally {
    await site.close();
  }
});

test('fetchPage: страница, закрытая в robots.txt, не запрашивается', async () => {
  const site = await startFakeSite({
    '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /private' },
    '/private/page': { body: PAGE },
  });
  try {
    const { fetcher } = makeFetcher();
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/private/page`), (e) => e instanceof AnalyzerError && e.code === 'robots_disallowed');
    assert.ok(!site.hits.some((h) => h.path === '/private/page'), 'закрытая страница не должна запрашиваться');
  } finally {
    await site.close();
  }
});

test('fetchPage: если robots.txt недоступен (500) — страницы не открываются', async () => {
  const site = await startFakeSite({ '/robots.txt': { status: 500, body: 'oops' }, '/': { body: PAGE } });
  try {
    const { fetcher } = makeFetcher();
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/`), (e) => e instanceof AnalyzerError && e.code === 'robots_unreachable');
    assert.ok(!site.hits.some((h) => h.path === '/'));
  } finally {
    await site.close();
  }
});

test('fetchPage: нет robots.txt (404) — доступ разрешён', async () => {
  const site = await startFakeSite({ '/': { body: PAGE } });
  try {
    const { fetcher } = makeFetcher();
    const res = await fetcher.fetchPage(`${site.url}/`);
    assert.equal(res.status, 200);
  } finally {
    await site.close();
  }
});

test('fetchPage: тайм-аут', async () => {
  const site = await startFakeSite({ '/': { body: PAGE, delayMs: 1500 } });
  try {
    const { fetcher } = makeFetcher({}, { fetchTimeoutMs: 300 });
    const t0 = Date.now();
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/`), (e) => e instanceof AnalyzerError && e.code === 'timeout');
    assert.ok(Date.now() - t0 < 1200, 'не должен ждать полный ответ');
  } finally {
    await site.close();
  }
});

test('fetchPage: недоступный сайт и ошибки HTTP', async () => {
  const site = await startFakeSite({ '/gone': { status: 404, body: 'x' }, '/boom': { status: 500, body: 'x' } });
  const { fetcher } = makeFetcher();
  try {
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/gone`), (e) => e instanceof AnalyzerError && e.code === 'http_error' && e.details?.status === 404);
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/boom`), (e) => e instanceof AnalyzerError && e.code === 'http_error' && e.details?.status === 500);
  } finally {
    await site.close();
  }
  // порт закрыт — соединение отклонено (robots.txt недоступен → robots_unreachable)
  await assert.rejects(() => fetcher.fetchPage(`${site.url}/`), (e) => e instanceof AnalyzerError && ['robots_unreachable', 'connection_refused', 'network_error'].includes(e.code));
  await assert.rejects(() => fetcher.fetchPage('not a url'), (e) => e instanceof AnalyzerError && e.code === 'invalid_url');
});

test('fetchPage: 403 и CAPTCHA считаются блокировкой и не обходятся', async () => {
  const site = await startFakeSite({
    '/forbidden': { status: 403, body: 'Forbidden' },
    '/cf': { status: 200, body: '<html><title>Just a moment...</title><body>Checking your browser before accessing</body></html>' },
    '/captcha': { status: 200, body: '<html><body><div class="g-recaptcha"></div></body></html>' },
    // защита от ботов часто отвечает именно 5xx со страницей-заглушкой
    '/cf503': { status: 503, body: '<html><title>Just a moment...</title><body>cf-chl-bypass</body></html>' },
    '/boom': { status: 503, body: 'Service Unavailable' },
  });
  try {
    const { fetcher } = makeFetcher();
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/boom`), (e) => e instanceof AnalyzerError && e.code === 'http_error', 'обычная 503 — это ошибка сайта, а не блокировка');
    for (const p of ['/forbidden', '/cf', '/captcha', '/cf503']) {
      await assert.rejects(() => fetcher.fetchPage(`${site.url}${p}`), (e) => e instanceof AnalyzerError && e.code === 'blocked', p);
    }
    const attempts = site.hits.filter((h) => h.path === '/forbidden').length;
    assert.equal(attempts, 1, 'после отказа повторных попыток нет');
  } finally {
    await site.close();
  }
});

test('fetchPage: не HTML — отклоняется; перенаправления работают; петля ограничена', async () => {
  const site = await startFakeSite({
    '/file.json': { headers: { 'content-type': 'application/json' }, body: '{}' },
    '/old': { status: 301, headers: { location: '/new' }, body: '' },
    '/new': { body: PAGE },
    '/loop': { status: 302, headers: { location: '/loop' }, body: '' },
  });
  try {
    const { fetcher } = makeFetcher();
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/file.json`), (e) => e instanceof AnalyzerError && e.code === 'unsupported_content');
    const moved = await fetcher.fetchPage(`${site.url}/old`);
    assert.equal(moved.finalUrl, `${site.url}/new`);
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/loop`), (e) => e instanceof AnalyzerError && e.code === 'too_many_redirects');
  } finally {
    await site.close();
  }
});

test('fetchPage: пауза между запросами к одному сайту соблюдается', async () => {
  const site = await startFakeSite({ '/a': { body: PAGE }, '/b': { body: PAGE }, '/c': { body: PAGE } });
  try {
    const { fetcher } = makeFetcher({}, { fetchMinIntervalMs: 350 });
    await Promise.all([fetcher.fetchPage(`${site.url}/a`), fetcher.fetchPage(`${site.url}/b`), fetcher.fetchPage(`${site.url}/c`)]);
    const times = site.hits.map((h) => h.at).sort((x, y) => x - y);
    assert.ok(times.length >= 4, 'robots.txt + 3 страницы');
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] - times[i - 1] >= 320, `между запросами ${i - 1} и ${i} прошло ${times[i] - times[i - 1]} мс`);
    }
  } finally {
    await site.close();
  }
});

test('fetchPage: Crawl-delay из robots.txt увеличивает паузу', async () => {
  const site = await startFakeSite({
    '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nCrawl-delay: 1' },
    '/a': { body: PAGE },
    '/b': { body: PAGE },
  });
  try {
    const { fetcher } = makeFetcher({}, { fetchMinIntervalMs: 0 });
    await fetcher.fetchPage(`${site.url}/a`);
    await fetcher.fetchPage(`${site.url}/b`);
    const a = site.hits.find((h) => h.path === '/a')!;
    const b = site.hits.find((h) => h.path === '/b')!;
    assert.ok(b.at - a.at >= 950, `Crawl-delay: 1 → пауза ${b.at - a.at} мс`);
  } finally {
    await site.close();
  }
});

test('fetchPage: домен из чёрного списка не открывается', async () => {
  const site = await startFakeSite({ '/': { body: PAGE } });
  try {
    const { fetcher } = makeFetcher({}, { blockedDomains: ['127.0.0.1'] });
    await assert.rejects(() => fetcher.fetchPage(`${site.url}/`), (e) => e instanceof AnalyzerError && e.code === 'blocked');
    assert.equal(site.hits.length, 0);
  } finally {
    await site.close();
  }
});

test('fetchPage: без разрешения на частные адреса localhost закрыт', async () => {
  const { fetcher } = makeFetcher({ allowPrivateHosts: false });
  await assert.rejects(() => fetcher.fetchPage('http://127.0.0.1:9/'), (e) => e instanceof AnalyzerError && ['private_address', 'invalid_url'].includes(e.code));
});

test('fetchPage: windows-1251', async () => {
  // «Автосервис» в windows-1251
  const bytes = Buffer.from([0xc0, 0xe2, 0xf2, 0xee, 0xf1, 0xe5, 0xf0, 0xe2, 0xe8, 0xf1]);
  const body = Buffer.concat([Buffer.from('<html><head><meta charset="windows-1251"><title>'), bytes, Buffer.from('</title></head><body>ok</body></html>')]);
  const site = await startFakeSite({ '/': { headers: { 'content-type': 'text/html' }, body } });
  try {
    const { fetcher } = makeFetcher();
    const res = await fetcher.fetchPage(`${site.url}/`);
    assert.match(res.body, /Автосервис/);
  } finally {
    await site.close();
  }
});

test('looksLikeBotWall не срабатывает на обычных страницах', () => {
  assert.equal(looksLikeBotWall(PAGE, 200), false);
  assert.equal(looksLikeBotWall('<html><body>' + 'текст '.repeat(500) + '<div class="g-recaptcha"></div></body></html>', 200), false, 'капча в форме на большой странице — это не заглушка');
});

test('пауза: небольшой sleep-хелпер работает', async () => {
  const t0 = Date.now();
  await sleep(20);
  assert.ok(Date.now() - t0 >= 15);
});
