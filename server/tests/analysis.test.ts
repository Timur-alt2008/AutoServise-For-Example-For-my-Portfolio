import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAiIdeas } from '../src/ai.ts';
import { analyzeSite, extractColors, findPriceMentions, pickExtraLinks, pickStylesheets } from '../src/analysis/extract.ts';
import { buildIdeas, complexityLabel, evaluateCandidate, scoreTotal } from '../src/analysis/ideas.ts';
import type { RealismChecks } from '../src/analysis/types.ts';
import { BOOKING_WIDGET_HOME, PLAIN_HOME, RICH_CONTACTS, RICH_CSS, RICH_HOME, RICH_SERVICES } from './fixtures.ts';

const URL_ = 'https://motor.example.com/';

function rich() {
  return analyzeSite(
    [
      { url: URL_, html: RICH_HOME },
      { url: `${URL_}services`, html: RICH_SERVICES },
      { url: `${URL_}contacts`, html: RICH_CONTACTS },
    ],
    [{ url: `${URL_}style.css`, css: RICH_CSS }],
  );
}

test('структура: заголовки, навигация, услуги, формы, контакты', () => {
  const a = rich();
  assert.equal(a.meta.title, 'Автосервис «Мотор» — ремонт и диагностика');
  assert.equal(a.meta.lang, 'ru');
  assert.equal(a.meta.hasViewport, true);
  assert.deepEqual(a.meta.jsonLdTypes.sort(), ['AutoRepair', 'PostalAddress']);
  assert.equal(a.structure.h1[0], 'Автосервис, которому можно доверить автомобиль');
  assert.ok(a.structure.nav.items.some((i) => i.text === 'Услуги'));
  assert.ok(!a.structure.nav.items.some((i) => i.text === 'Позвонить'), 'tel: не считается пунктом меню');
  assert.equal(a.structure.nav.mobileMenuHint, true);
  assert.equal(a.structure.services.detected, true);
  assert.ok(a.structure.services.items.includes('Замена масла'));
  assert.equal(a.structure.forms.count, 1);
  assert.ok(a.structure.forms.fields.some((f) => f.startsWith('tel:')));
  assert.match(a.structure.forms.summaries[0], /запись/);
  assert.ok(a.structure.contacts.phoneLinks >= 2);
  assert.equal(a.structure.contacts.hasEmail, true);
  assert.equal(a.structure.contacts.hasAddress, true);
  assert.equal(a.structure.contacts.hasWorkingHours, true);
  assert.equal(a.analyzedPages.length, 3);
});

test('цены: «от …» распознаются', () => {
  const a = rich();
  assert.equal(a.structure.prices.presentation, 'from');
  assert.ok(a.structure.prices.mentions.length >= 3);
  assert.ok(findPriceMentions('Замена масла — 300 грн, диагностика $25 и €40').length >= 3);
  assert.deepEqual(findPriceMentions('Просто текст без цен 2024 год'), []);
  // название услуги берётся целиком и не захватывает цену соседней услуги
  assert.deepEqual(findPriceMentions('Диагностика подвески от 400 грн Замена тормозных колодок от 600 грн Замена масла от 300 грн'), [
    'Диагностика подвески от 400 грн',
    'Замена тормозных колодок от 600 грн',
    'Замена масла от 300 грн',
  ]);
});

test('дизайн: цвета, шрифты, главный экран, кнопки, анимации', () => {
  const a = rich();
  assert.ok(a.design.colors.some((c) => c.hex === '#e87532'));
  assert.ok(a.design.accents.includes('#e87532'));
  assert.ok(a.design.fonts.includes('Manrope'));
  assert.ok(a.design.fontProviders.includes('Google Fonts'));
  assert.ok(a.design.fontProviders.some((p) => p.includes('@font-face')));
  assert.equal(a.design.hero.found, true);
  assert.equal(a.design.hero.hasH1, true);
  assert.deepEqual(a.design.hero.ctaTexts, ['Записаться на сервис', 'Посмотреть услуги']);
  assert.match(a.design.hero.layoutHint, /визуальной проверки/);
  assert.ok(a.design.buttons.hints.some((h) => h.includes('скругление')));
  assert.ok(a.design.buttons.hints.some((h) => h.includes('заглавными')));
  assert.equal(a.design.layout.usesCssGrid, true);
  assert.equal(a.design.layout.lazyImages, 2);
  assert.equal(a.design.motion.transitions, true);
  assert.equal(a.design.motion.keyframes, 1);
  assert.ok(a.design.motion.libraries.includes('AOS'));
  assert.equal(a.design.motion.verification, 'needs_browser_check');
});

test('функции: что проверено по HTML, а что «требует браузерной проверки»', () => {
  const f = rich().features;
  const expectStatic = ['call_button', 'messenger_links', 'online_booking', 'faq', 'map', 'feedback_form', 'price_list', 'working_hours', 'video', 'service_pages', 'stepwise_flow'] as const;
  for (const k of expectStatic) {
    assert.equal(f[k].present, 'yes', `${k} должен быть найден`);
    assert.equal(f[k].verification, 'static', `${k} проверяется по HTML`);
  }
  const needBrowser = ['vehicle_selector', 'service_filters', 'gallery', 'before_after', 'sticky_cta', 'calculator'] as const;
  for (const k of needBrowser) {
    assert.notEqual(f[k].present, 'no', `${k} должен быть замечен`);
    assert.equal(f[k].verification, 'needs_browser_check', `${k}: работу по HTML проверить нельзя`);
  }
  assert.equal(f.reviews.present, 'likely');
  assert.equal(f.plan_comparison.present, 'likely');
});

test('функции: на простой странице ничего не выдумывается', () => {
  const a = analyzeSite([{ url: URL_, html: PLAIN_HOME }]);
  for (const [k, v] of Object.entries(a.features)) assert.equal(v.present, 'no', k);
  assert.equal(a.rejectedPatterns.length, 0);
  assert.equal(a.structure.prices.presentation, 'none');
  assert.equal(a.design.hero.found, true, 'родитель h1 считается главным экраном');
  assert.equal(a.design.hero.hasMedia, false);
  const built = buildIdeas(a, { host: 'plain.example', url: URL_ });
  assert.equal(built.ideas.length, 0);
  assert.equal(built.filtered.length, 0);
});

test('фантастические и «пустые» паттерны находятся и отбрасываются', () => {
  const a = rich();
  const names = a.rejectedPatterns.map((p) => p.pattern).join(' | ');
  assert.match(names, /частицы/i);
  assert.match(names, /Футуристический/);
  assert.match(names, /счётчики/i);
  for (const p of a.rejectedPatterns) assert.ok(p.reason.length > 10 && p.evidence.length > 0);
  const built = buildIdeas(a, { host: 'motor.example.com', url: URL_ });
  const text = JSON.stringify(built.ideas.map((i) => i.title));
  assert.ok(!/частиц|голограм|счётчик/i.test(text), 'такие эффекты не становятся идеями');
});

test('идеи: появляются только при наличии признака, оценены по пяти параметрам', () => {
  const built = buildIdeas(rich(), { host: 'motor.example.com', url: URL_ });
  const keys = built.ideas.map((i) => i.key);
  for (const k of ['sticky_mobile_cta', 'before_after_gallery', 'service_filters', 'vehicle_dependent_select', 'messenger_buttons', 'open_now_badge', 'plan_comparison', 'service_pages', 'cost_calculator']) {
    assert.ok(keys.includes(k), `ожидалась идея ${k}`);
  }
  for (const idea of built.ideas) {
    assert.ok(idea.title && idea.description && idea.whyInteresting && idea.expectedBenefit && idea.recommendation);
    assert.ok(idea.whyInteresting.includes('motor.example.com'), 'указан сайт-источник');
    for (const v of Object.values(idea.scores)) assert.ok(v >= 1 && v <= 5);
    assert.ok(idea.steps.length >= 2);
    assert.ok(idea.checks.some((c) => c.includes('горизонтальной прокрутки')));
    assert.ok(evaluateCandidate(idea).ok);
  }
  const sticky = built.ideas.find((i) => i.key === 'sticky_mobile_cta')!;
  assert.equal(sticky.verification, 'needs_browser_check');
  assert.match(sticky.recommendation, /браузере/);
  // отсортированы по итоговой оценке
  const totals = built.ideas.map((i) => scoreTotal(i.scores));
  assert.deepEqual(totals, [...totals].sort((x, y) => y - x));
});

test('фильтр: то, что уже есть в проекте, и нереалистичное — не предлагается, но объясняется', () => {
  const built = buildIdeas(rich(), { host: 'motor.example.com', url: URL_ });
  const byKey = Object.fromEntries(built.filtered.map((f) => [f.key, f]));
  assert.equal(byKey.faq_block.kind, 'already_in_project');
  assert.equal(byKey.steps_flow.kind, 'already_in_project');
  assert.equal(byKey.price_transparency.kind, 'already_in_project');
  assert.equal(byKey.map_with_route.kind, 'realism');
  assert.ok(byKey.map_with_route.failedChecks.some((c) => c.includes('выдуманных данных')));
  assert.equal(byKey.video_tour.kind, 'realism');
  assert.ok(!built.ideas.some((i) => ['faq_block', 'map_with_route', 'video_tour'].includes(i.key)));
});

test('фильтр: виджет записи → идея отбрасывается как требующая инфраструктуры', () => {
  const a = analyzeSite([{ url: URL_, html: BOOKING_WIDGET_HOME }]);
  assert.equal(a.features.online_booking.present, 'yes');
  assert.equal(a.features.online_booking.verification, 'needs_browser_check');
  const built = buildIdeas(a, { host: 'w.example', url: URL_ });
  const slot = built.filtered.find((f) => f.key === 'slot_booking_widget');
  assert.ok(slot, 'идея про слоты должна быть в «отброшенных»');
  assert.ok(slot!.failedChecks.some((c) => c.includes('инфраструктуры')));
  // обычная форма записи без виджета не порождает идею про слоты
  const rich2 = buildIdeas(rich(), { host: 'm', url: URL_ });
  assert.ok(!rich2.filtered.some((f) => f.key === 'slot_booking_widget'));
});

test('оценка: формула и ярлыки сложности', () => {
  assert.equal(scoreTotal({ usefulness: 5, relevance: 5, feasibility: 5, visual: 5, complexity: 1 }), 100);
  assert.equal(scoreTotal({ usefulness: 1, relevance: 1, feasibility: 1, visual: 1, complexity: 5 }), 20);
  assert.ok(scoreTotal({ usefulness: 5, relevance: 5, feasibility: 5, visual: 4, complexity: 1 }) > scoreTotal({ usefulness: 5, relevance: 5, feasibility: 5, visual: 4, complexity: 4 }));
  assert.equal(complexityLabel(1), 'простая');
  assert.equal(complexityLabel(3), 'средняя');
  assert.equal(complexityLabel(5), 'сложная');
});

test('evaluateCandidate: «фантастика» и непройденные пункты отклоняют идею', () => {
  const ok: RealismChecks = { fitsRegularAutoService: true, helpsClientOrOwner: true, noExpensiveInfrastructure: true, noInventedData: true, noFalsePromises: true, notOverloading: true, worksOnMobile: true, matchesBrandStyle: true };
  assert.equal(evaluateCandidate({ title: 'Форма', description: 'Простая форма', realism: ok }).ok, true);
  const holo = evaluateCandidate({ title: 'Голограмма автомобиля', description: 'Неоновая 3D-панель', realism: ok });
  assert.equal(holo.ok, false);
  assert.ok(holo.failed.some((f) => f.includes('стилю')));
  const fake = evaluateCandidate({ title: 'Счётчик клиентов', description: 'Анимированная цифра', realism: { ...ok, noInventedData: false, noFalsePromises: false } });
  assert.equal(fake.ok, false);
  assert.equal(fake.failed.length, 2);
});

test('цвета: переменные бренда весомее, белый и чёрный не считаются', () => {
  const r = extractColors('a{color:#fff;background:#000} :root{--brand-main:#ff6600} b{color:#336699} c{color:#336699} d{color:rgba(51,102,153,.5)}');
  assert.equal(r.colors[0].hex, '#ff6600');
  assert.ok(!r.colors.some((c) => c.hex === '#ffffff' || c.hex === '#000000'));
  assert.ok(r.colors.find((c) => c.hex === '#336699')!.count >= 3);
});

test('дополнительные страницы и таблицы стилей: только свой сайт, без файлов и служебных ссылок', () => {
  const extra = pickExtraLinks(URL_, RICH_HOME, 3);
  assert.ok(extra.length <= 3);
  assert.ok(extra.every((u) => u.startsWith('https://motor.example.com/')));
  assert.ok(extra.some((u) => u.endsWith('/services')));
  assert.ok(!extra.some((u) => u.includes('tel:') || u.includes('admin')), 'ссылка «Вход» не интересна');
  assert.deepEqual(pickExtraLinks(URL_, RICH_HOME, 0), []);
  const html = '<a href="/prices.pdf">Прайс</a><a href="https://other.com/services">Чужой</a><a href="/services#top">Услуги</a><a href="/services">Услуги</a>';
  assert.deepEqual(pickExtraLinks(URL_, html, 5), ['https://motor.example.com/services']);

  const sheets = pickStylesheets(URL_, RICH_HOME, 3);
  assert.deepEqual(sheets, ['https://motor.example.com/style.css'], 'Google Fonts не скачиваем');
});

test('ответ ИИ: проверяется, неполные проверки реалистичности считаются проваленными', () => {
  const good = {
    ideas: [
      { title: 'Подсказка по пробегу', description: 'Напоминание о ТО по пробегу', scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 3, complexity: 2 }, realism: { fitsRegularAutoService: true, helpsClientOrOwner: true, noExpensiveInfrastructure: true, noInventedData: true, noFalsePromises: true, notOverloading: true, worksOnMobile: true, matchesBrandStyle: true }, steps: ['а', 'б'] },
      { title: 'Без проверок', description: 'ИИ не заполнил realism', scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 5, complexity: 1 } },
      { title: '', description: 'нет названия' },
    ],
  };
  const ideas = parseAiIdeas(`Вот ответ:\n${JSON.stringify(good)}\nГотово`);
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].origin, 'ai');
  assert.ok(ideas[0].key.startsWith('ai:'));
  assert.equal(evaluateCandidate(ideas[0]).ok, true);
  assert.equal(evaluateCandidate(ideas[1]).ok, false, 'не отвеченные пункты = не пройдено');
  assert.throws(() => parseAiIdeas('не JSON'), /ИИ/);
  assert.throws(() => parseAiIdeas('{"ideas": 5}'), /списка идей/);
});
