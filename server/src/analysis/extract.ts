import type { El } from '../html.ts';
import { attr, attrOr, classList, parseHtml, rawText, select, selectOne, textOf, walk } from '../html.ts';
import type { FeatureFinding, FeatureKey, Presence, RejectedPattern, SiteAnalysis, Verification } from './types.ts';

export interface PageInput {
  url: string;
  html: string;
}
export interface StylesheetInput {
  url: string;
  css: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const uniq = <T>(a: T[]): T[] => [...new Set(a)];

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function finding(present: Presence, verification: Verification, evidence: string[]): FeatureFinding {
  return { present, verification, evidence: uniq(evidence).slice(0, 5) };
}
const NO = (): FeatureFinding => finding('no', 'static', []);

function classOrId(el: El): string {
  return `${attr(el, 'class')} ${attr(el, 'id')}`.toLowerCase();
}

function linkText(a: El): string {
  return (textOf(a, 120) || attr(a, 'aria-label') || attr(a, 'title')).trim();
}

function cssOf(root: El, sheets: StylesheetInput[]): string {
  const chunks: string[] = [];
  walk(root, (el) => {
    if (el.tag === 'style') chunks.push(rawText(el));
    else if (el.attrs.style) chunks.push(`x{${el.attrs.style}}`);
  });
  for (const s of sheets) chunks.push(s.css.slice(0, 400_000));
  return chunks.join('\n');
}

// ---------------------------------------------------------------------------
// Цвета и шрифты
// ---------------------------------------------------------------------------

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function hslOf(hex: string): { s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

export function extractColors(css: string): { colors: Array<{ hex: string; count: number }>; accents: string[] } {
  const counts = new Map<string, number>();
  const add = (hex: string, weight = 1) => counts.set(hex, (counts.get(hex) ?? 0) + weight);

  for (const m of css.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 8) h = h.slice(0, 6);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    add(`#${h}`);
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/gi)) {
    add(toHex(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // Переменные с «брендовыми» названиями считаем важнее
  for (const m of css.matchAll(/--[\w-]*(primary|accent|brand|main|cta)[\w-]*\s*:\s*(#[0-9a-f]{3,6})\b/gi)) {
    let h = m[2].toLowerCase().slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    add(`#${h}`, 5);
  }

  const palette = [...counts.entries()]
    .filter(([hex]) => hex !== '#ffffff' && hex !== '#000000')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, count }));
  const accents = palette
    .filter(({ hex }) => {
      const { s, l } = hslOf(hex);
      return s > 0.4 && l > 0.25 && l < 0.7;
    })
    .slice(0, 4)
    .map((c) => c.hex);
  return { colors: palette, accents };
}

const GENERIC_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial', 'unset',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial',
  'helvetica', 'helvetica neue', 'times new roman', 'tahoma', 'verdana', 'georgia', 'courier new',
]);

export function extractFonts(root: El, css: string): { fonts: string[]; providers: string[] } {
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^["']|["']$/g, '').replace(/!important/i, '').trim();
      if (!name || name.startsWith('var(') || GENERIC_FONTS.has(name.toLowerCase())) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const providers: string[] = [];
  for (const link of select(root, 'link[href]')) {
    const href = attr(link, 'href');
    if (/fonts\.googleapis\.com/i.test(href)) {
      providers.push('Google Fonts');
      for (const m of href.matchAll(/family=([^&:|]+)/g)) {
        const name = decodeURIComponent(m[1].replace(/\+/g, ' '));
        counts.set(name, (counts.get(name) ?? 0) + 3);
      }
    }
    if (/use\.typekit\.net|fonts\.adobe\.com/i.test(href)) providers.push('Adobe Fonts');
  }
  if (/@font-face/i.test(css)) providers.push('Свои шрифты (@font-face)');
  const fonts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  return { fonts, providers: uniq(providers) };
}

// ---------------------------------------------------------------------------
// Цены, формы, контакты
// ---------------------------------------------------------------------------

const CURRENCY = '(?:грн\\.?|₴|uah|руб\\.?|₽|\\$|€|usd|eur|zł|pln|£|тенге|₸)';
const PRICE_SRC = `(?:\\d[\\d\\s.,]{1,8}\\s?${CURRENCY})|(?:[$€£₴]\\s?\\d[\\d\\s.,]*)`;
const PRICE_RE = new RegExp(PRICE_SRC, 'gi');
const PRICE_TEST = new RegExp(PRICE_SRC, 'i');

export function findPriceMentions(text: string): string[] {
  const out: string[] = [];
  let prevEnd = 0;
  for (const m of text.matchAll(PRICE_RE)) {
    const idx = m.index ?? 0;
    // Контекст — название услуги перед ценой; чужую цену из предыдущего упоминания в него не берём
    const start = Math.max(prevEnd, idx - 44);
    prevEnd = idx + m[0].length;
    let context = text.slice(start, prevEnd).replace(/\s+/g, ' ').trim();
    // Не начинаем с обрывка слова
    if (start > 0 && !/\s/.test(text[start - 1] ?? ' ') && !/\s/.test(text[start] ?? '')) context = context.replace(/^\S+\s?/, '');
    if (!context || out.includes(context)) continue;
    out.push(clip(context, 60));
    if (out.length >= 8) break;
  }
  return out;
}

const BOOKING_RE = /запис|записат|бронир|book|appointment|schedule a|reserve|резерв/i;
const ESTIMATE_RE = /расч[её]т|смет[ауые]|оценк|узнать стоимость|получить цену|рассчитать|quote|estimate|get a price|price request/i;

function describeForm(form: El): { fields: string[]; summary: string } {
  const fields: string[] = [];
  for (const f of select(form, 'input, select, textarea')) {
    const type = f.tag === 'input' ? attr(f, 'type').toLowerCase() || 'text' : f.tag;
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    const name = attr(f, 'name') || attr(f, 'id') || attr(f, 'placeholder') || attr(f, 'aria-label');
    fields.push(`${type}:${clip(name, 24)}`);
  }
  const hint = classOrId(form) + ' ' + attr(form, 'action');
  const title = BOOKING_RE.test(hint + ' ' + textOf(form, 300)) ? 'запись/заявка' : ESTIMATE_RE.test(textOf(form, 300)) ? 'запрос стоимости' : 'форма';
  return { fields, summary: `${title}: ${fields.length} полей` };
}

// ---------------------------------------------------------------------------
// Признаки функций
// ---------------------------------------------------------------------------

function detectFeatures(root: El, css: string, text: string, jsonLdTypes: string[]): Record<FeatureKey, FeatureFinding> {
  const f = {} as Record<FeatureKey, FeatureFinding>;
  const links = select(root, 'a[href]');
  const forms = select(root, 'form');

  // Звонок
  const tel = select(root, 'a[href^="tel:" i]');
  f.call_button = tel.length ? finding('yes', 'static', [`Ссылок tel: — ${tel.length}`]) : NO();

  // Мессенджеры
  const messengers = links.filter((a) => /(^|\/\/)(t\.me|wa\.me|api\.whatsapp\.com|m\.me|vk\.me)|^viber:|^tg:|^whatsapp:/i.test(attr(a, 'href')));
  f.messenger_links = messengers.length
    ? finding('yes', 'static', uniq(messengers.map((a) => (/t\.me|^tg:/i.test(attr(a, 'href')) ? 'Telegram' : /wa\.me|whatsapp/i.test(attr(a, 'href')) ? 'WhatsApp' : /viber/i.test(attr(a, 'href')) ? 'Viber' : 'Мессенджер'))))
    : NO();

  // Онлайн-запись
  const widgets = select(root, 'iframe[src], script[src]').filter((e) => /calendly|setmore|simplybook|yclients|dikidi|bookingjet|appointlet|acuityscheduling|reservio|tilda.*form/i.test(attr(e, 'src')));
  const bookingForms = forms.filter((fm) => BOOKING_RE.test(`${classOrId(fm)} ${attr(fm, 'action')} ${textOf(fm, 300)}`));
  const bookingLinks = [...links, ...select(root, 'button')].filter((a) => BOOKING_RE.test(linkText(a)) && linkText(a).length <= 40);
  if (widgets.length) f.online_booking = finding('yes', 'needs_browser_check', ['Подключён сервис записи (виджет)', 'Работу выбора времени по HTML проверить нельзя']);
  else if (bookingForms.length) f.online_booking = finding('yes', 'static', [`Форм записи — ${bookingForms.length}`]);
  else if (bookingLinks.length) f.online_booking = finding('likely', 'needs_browser_check', [`Кнопок/ссылок «записаться» — ${bookingLinks.length}`, 'Что происходит после нажатия, по HTML не видно']);
  else f.online_booking = NO();

  // Запрос стоимости
  const estimateEls = [...links, ...select(root, 'button, h2, h3, label')].filter((e) => ESTIMATE_RE.test(textOf(e, 120)));
  f.estimate_request = estimateEls.length
    ? finding('likely', 'needs_browser_check', [`Упоминаний запроса/расчёта стоимости — ${estimateEls.length}`])
    : NO();

  // Выбор автомобиля
  const names = select(root, 'select, input').map((e) => `${attr(e, 'name')} ${attr(e, 'id')} ${attr(e, 'placeholder')} ${attr(e, 'aria-label')}`.toLowerCase());
  const has = (re: RegExp) => names.some((n) => re.test(n));
  const vehicleParts = [has(/make|brand|марк|marque/) && 'марка', has(/model|модел/) && 'модель', has(/year|год|\byr\b/) && 'год', has(/vin/) && 'VIN'].filter(Boolean) as string[];
  f.vehicle_selector = vehicleParts.length >= 2
    ? finding('yes', 'needs_browser_check', [`Поля: ${vehicleParts.join(', ')}`, 'Зависимость «модель по марке» по HTML проверить нельзя'])
    : NO();

  // Фильтры
  const filterEls = select(root, '[data-filter], [data-category], [class*="filter" i], [class*="tabs" i], [role="tablist"]');
  f.service_filters = filterEls.length
    ? finding('likely', 'needs_browser_check', [`Элементов, похожих на фильтры/вкладки — ${filterEls.length}`, 'Работа фильтрации требует браузерной проверки'])
    : NO();

  // Галерея
  const gallery = select(root, '[class*="gallery" i], [class*="lightbox" i], [data-fancybox], [class*="portfolio" i], [class*="swiper" i], [class*="carousel" i], [id*="gallery" i]');
  f.gallery = gallery.length
    ? finding('likely', 'needs_browser_check', [`Блоков галереи/слайдера — ${gallery.length}`, 'Увеличение фото по клику требует браузерной проверки'])
    : NO();

  // До/после
  const ba = select(root, '[class*="before-after" i], [class*="beforeafter" i], [class*="before_after" i], [class*="compare-slider" i], [class*="img-comparison" i], [class*="twentytwenty" i]');
  const baText = /(до\s*(и|\/|-)\s*после|before\s*(and|\/|&)\s*after)/i.test(text);
  f.before_after = ba.length
    ? finding('likely', 'needs_browser_check', ['Найден блок сравнения «до/после»', 'Ползунок сравнения требует браузерной проверки'])
    : baText ? finding('likely', 'needs_browser_check', ['В тексте есть «до и после»']) : NO();

  // FAQ
  const details = select(root, 'details > summary');
  const faqEls = select(root, '[class*="faq" i], [id*="faq" i], [class*="accordion" i]');
  const faqHeading = select(root, 'h1, h2, h3').some((h) => /faq|частые вопросы|вопросы и ответы|часті запитання|frequently asked/i.test(textOf(h, 100)));
  if (details.length >= 2) f.faq = finding('yes', 'static', [`Раскрывающихся блоков <details> — ${details.length}`]);
  else if (jsonLdTypes.includes('FAQPage')) f.faq = finding('yes', 'static', ['Разметка FAQPage (schema.org)']);
  else if (faqEls.length || faqHeading) f.faq = finding('likely', 'needs_browser_check', ['Есть блок/заголовок FAQ', 'Раскрытие ответов требует браузерной проверки']);
  else f.faq = NO();

  // Карта
  const mapFrames = select(root, 'iframe[src]').filter((e) => /google\.[a-z.]+\/maps|maps\.google|openstreetmap|yandex\.[a-z]+\/(maps|map-widget)|maps\.app\.goo\.gl|2gis|mapbox/i.test(attr(e, 'src')));
  const mapScripts = select(root, 'script[src]').filter((e) => /leaflet|mapbox|maps\.googleapis|api-maps\.yandex|maplibre/i.test(attr(e, 'src')));
  if (mapFrames.length) f.map = finding('yes', 'static', ['Встроена карта (iframe)']);
  else if (mapScripts.length || select(root, '[id*="map" i], [class*="map-canvas" i]').length) f.map = finding('likely', 'needs_browser_check', ['Подключена библиотека карт или контейнер карты']);
  else f.map = NO();

  // Формы обратной связи
  const feedback = forms.filter((fm) => select(fm, 'input, textarea').length >= 2);
  f.feedback_form = feedback.length ? finding('yes', 'static', [`Форм с несколькими полями — ${feedback.length}`]) : NO();

  // Пошаговый сценарий
  const stepEls = select(root, '[class*="step" i], [class*="process" i], [class*="timeline" i]').filter((e) => select(e, 'li, [class*="step" i], [class*="item" i]').length >= 3 || e.children.length >= 3);
  const stepHeading = select(root, 'h2, h3').some((h) => /как (мы )?работаем|этапы|как проходит|процесс|how it works|our process|steps/i.test(textOf(h, 100)));
  const olSteps = select(root, 'ol').filter((ol) => select(ol, 'li').length >= 3);
  if (stepHeading && (olSteps.length || stepEls.length)) f.stepwise_flow = finding('yes', 'static', ['Заголовок «как мы работаем» и нумерованные этапы']);
  else if (stepEls.length || stepHeading) f.stepwise_flow = finding('likely', 'static', ['Блок этапов по названиям классов/заголовков']);
  else f.stepwise_flow = NO();

  // Закреплённая кнопка
  const stickyRule = /([^{}]*(call|cta|book|phone|float|sticky|callback|zapis|order|btn)[^{}]*)\{[^{}]*position\s*:\s*(fixed|sticky)/i.exec(css);
  const stickyEls = select(root, '[class*="sticky" i], [class*="floating" i], [class*="fixed-" i], [class*="float-" i]').filter((e) => select(e, 'a[href^="tel:" i], a, button').length > 0 && !/header|nav|menu/i.test(classOrId(e)));
  if (stickyRule || stickyEls.length) {
    f.sticky_cta = finding('likely', 'needs_browser_check', [stickyRule ? `В CSS: position fixed/sticky у «${clip(stickyRule[1].trim().replace(/\s+/g, ' '), 40)}»` : `Элементов с «sticky/floating» — ${stickyEls.length}`, 'Поведение на телефоне требует браузерной проверки']);
  } else f.sticky_cta = NO();

  // Калькулятор
  const calc = select(root, '[class*="calc" i], [id*="calc" i], [class*="calculator" i]');
  const calcText = /калькулятор|рассчитать стоимость|calculator|price calculator/i.test(text);
  const hasControls = select(root, 'input[type=range], input[type=number], select').length > 0;
  f.calculator = (calc.length || calcText) && hasControls
    ? finding('likely', 'needs_browser_check', ['Упоминание калькулятора и поля ввода', 'Сам расчёт по HTML проверить нельзя'])
    : NO();

  // Отзывы
  const reviewEls = select(root, '[class*="review" i], [class*="testimonial" i], [class*="otzyv" i], [class*="feedback-item" i], [id*="review" i]');
  const reviewHeading = select(root, 'h1, h2, h3').some((h) => /отзыв|reviews|testimonial/i.test(textOf(h, 100)));
  if (jsonLdTypes.some((t) => /Review|AggregateRating/i.test(t))) f.reviews = finding('yes', 'static', ['Разметка отзывов/рейтинга (schema.org)']);
  else if (reviewEls.length || reviewHeading) f.reviews = finding('likely', 'static', ['Блок или заголовок «Отзывы»']);
  else f.reviews = NO();

  // Прайс
  const priceMentions = findPriceMentions(text);
  const priceTables = select(root, 'table').filter((t) => PRICE_TEST.test(textOf(t, 800)));
  f.price_list = priceMentions.length >= 3 || priceTables.length
    ? finding('yes', 'static', [`Упоминаний цен — ${priceMentions.length}`, priceTables.length ? `Таблиц с ценами — ${priceTables.length}` : ''].filter(Boolean))
    : priceMentions.length
      ? finding('likely', 'static', [`Упоминаний цен — ${priceMentions.length}`])
      : NO();

  // График работы
  const hoursRe = /(пн|пон|mon)[а-я.]*\s*[-–—]\s*(пт|пят|fri)|\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}|круглосуточно|24\/7|working hours|opening hours|график работы|режим работы/i;
  f.working_hours = hoursRe.test(text) || select(root, '[itemprop="openingHours"], [class*="schedule" i], [class*="working-hours" i]').length
    ? finding('yes', 'static', ['На странице указан график работы'])
    : NO();

  // Видео
  const videos = select(root, 'video, iframe[src]').filter((e) => e.tag === 'video' || /youtube|youtu\.be|vimeo|rutube/i.test(attr(e, 'src')));
  f.video = videos.length ? finding('yes', 'static', [`Видео-элементов — ${videos.length}`]) : NO();

  // Сравнение вариантов
  const planEls = select(root, '[class*="pricing" i], [class*="plan" i], [class*="tariff" i], [class*="package" i]');
  const compareTables = select(root, 'table').filter((t) => /базов|стандарт|премиум|комплекс|basic|standard|premium|comprehensive/i.test(textOf(t, 400)));
  f.plan_comparison = planEls.length >= 2 || compareTables.length
    ? finding('likely', 'static', ['Несколько карточек/колонок тарифов или таблица сравнения'])
    : NO();

  // Отдельные страницы услуг
  const serviceLinks = uniq(links.map((a) => attr(a, 'href')).filter((h) => /\/(services?|uslugi|usluga|remont|repair|diagnostika|diagnostics)[/-][\w-]+/i.test(h)));
  f.service_pages = serviceLinks.length >= 3 ? finding('yes', 'static', [`Ссылок на страницы отдельных услуг — ${serviceLinks.length}`]) : NO();

  return f;
}

// ---------------------------------------------------------------------------
// Паттерны, которые фильтр реалистичности отбрасывает
// ---------------------------------------------------------------------------

export function detectRejectedPatterns(root: El, css: string): RejectedPattern[] {
  const out: RejectedPattern[] = [];
  const scripts = select(root, 'script').map((s) => `${attr(s, 'src')} ${rawText(s).slice(0, 3000)}`).join('\n');
  const all = `${scripts}\n${css.slice(0, 200_000)}`;
  const classes: string[] = [];
  walk(root, (el) => classes.push(...classList(el), attr(el, 'id')));
  const classBlob = classes.join(' ').toLowerCase();

  const check = (re: RegExp, source: string, pattern: string, reason: string) => {
    const m = re.exec(source);
    if (m) out.push({ pattern, reason, evidence: clip(m[0], 60) });
  };

  check(/three(\.min)?\.js|\bTHREE\.|babylon(\.min)?\.js|playcanvas|<canvas[^>]*webgl|getContext\(['"]webgl/i, `${scripts}\n${select(root, 'canvas').length ? '<canvas webgl' : ''}`, 'Псевдо-3D / WebGL-эффекты', 'Фантастические голограммы и псевдо-3D-интерфейсы не соответствуют принципу реализма');
  check(/particles(\.min)?\.js|tsparticles|particlesjs/i, all, 'Анимированные частицы', 'Эффекты ради эффектов не решают задачу клиента');
  check(/hologram|holo-|cyberpunk|neon-?glow|glitch/i, `${classBlob} ${css.slice(0, 200_000)}`, 'Футуристический стиль (голограммы, неон, глитч)', 'Фантастический стиль не подходит автосервису');
  check(/rellax|parallax(\.min)?\.js|locomotive-scroll|scrollmagic|skrollr/i, all, 'Тяжёлый параллакс-скролл', 'Ненужные анимации мешают прокрутке, особенно на телефонах');
  check(/speedometer|tachometer|\bgauge\b|rpm-meter|dashboard-ui|\bhud\b/i, classBlob, 'Декоративная приборная панель', 'Искусственные приборные панели не связаны с услугами');
  check(/countup|count-up|odometer|counter-up|purecounter|stat-number|animated-number|\bcounters?\b/i, `${classBlob} ${scripts}`, 'Анимированные счётчики «достижений»', 'Статистика без подтверждённых данных — выдуманные цифры и ложные обещания');
  check(/custom-cursor|cursor-follow|cursor-dot|cursor-outline/i, classBlob, 'Кастомный курсор', 'Эффект ради эффекта, не работает на телефонах');
  return out;
}

// ---------------------------------------------------------------------------
// Основная функция
// ---------------------------------------------------------------------------

function textOfFirst(root: El, selector: string): string {
  const el = selectOne(root, selector);
  return el ? textOf(el, 300) : '';
}

function parseJsonLdTypes(root: El): string[] {
  const types: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const t = o['@type'];
      if (typeof t === 'string') types.push(t);
      else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
      for (const val of Object.values(o)) if (val && typeof val === 'object') visit(val);
    }
  };
  for (const s of select(root, 'script[type="application/ld+json" i]')) {
    try {
      visit(JSON.parse(rawText(s)));
    } catch {
      // Некорректный JSON-LD просто пропускаем.
    }
  }
  return uniq(types).slice(0, 15);
}

const PRESENCE_RANK: Record<Presence, number> = { no: 0, likely: 1, yes: 2 };

/** Объединяет признаки с нескольких страниц сайта: берётся самое уверенное наблюдение. */
function mergeFeatures(list: Array<Record<FeatureKey, FeatureFinding>>): Record<FeatureKey, FeatureFinding> {
  const keys = Object.keys(list[0]) as FeatureKey[];
  const out = {} as Record<FeatureKey, FeatureFinding>;
  for (const k of keys) {
    let best = list[0][k];
    const evidence: string[] = [];
    for (const item of list) {
      evidence.push(...item[k].evidence);
      if (PRESENCE_RANK[item[k].present] > PRESENCE_RANK[best.present]) best = item[k];
    }
    out[k] = finding(best.present, best.verification, evidence);
  }
  return out;
}

export function analyzeSite(pages: PageInput[], sheets: StylesheetInput[] = []): SiteAnalysis {
  if (!pages.length) throw new Error('Нет страниц для анализа');

  const parsed = pages.map((p) => ({ ...p, root: parseHtml(p.html) }));
  const main = parsed[0].root;
  const css = parsed.map((p) => cssOf(p.root, [])).join('\n') + '\n' + sheets.map((s) => s.css.slice(0, 400_000)).join('\n');

  // Мета
  const title = textOfFirst(main, 'title');
  const description = attrOr(selectOne(main, 'meta[name="description" i]'), 'content');
  const jsonLdTypes = uniq(parsed.flatMap((p) => parseJsonLdTypes(p.root)));

  // Тексты и признаки по всем страницам
  const featureLists = parsed.map((p) => {
    const body = selectOne(p.root, 'body') ?? p.root;
    const text = textOf(body, 60_000);
    return detectFeatures(p.root, css, text, jsonLdTypes);
  });
  const features = mergeFeatures(featureLists);

  const allText = parsed.map((p) => textOf(selectOne(p.root, 'body') ?? p.root, 40_000)).join(' ');

  // Навигация
  const navEl = selectOne(main, 'nav') ?? selectOne(main, 'header') ?? main;
  const seen = new Set<string>();
  const navItems = select(navEl, 'a[href]')
    .map((a) => ({ text: clip(linkText(a), 40), href: clip(attr(a, 'href'), 120) }))
    .filter((i) => i.text && !/^(tel|mailto|javascript):/i.test(i.href) && !seen.has(i.text.toLowerCase()) && seen.add(i.text.toLowerCase()))
    .slice(0, 20);
  const mobileMenuHint =
    select(main, '[class*="burger" i], [class*="hamburger" i], [class*="menu-toggle" i], [class*="nav-toggle" i], [class*="mobile-menu" i], [class*="menu-btn" i], [class*="navbar-toggler" i]').length > 0 ||
    select(main, 'button[aria-label]').some((b) => /menu|меню/i.test(attr(b, 'aria-label')));

  // Услуги
  const serviceSections = select(main, '[id*="service" i], [class*="service" i], [id*="uslug" i], [class*="uslug" i], [id*="услуг" i], [class*="услуг" i]');
  const serviceItems = uniq(serviceSections.flatMap((s) => select(s, 'h3, h4').map((h) => clip(textOf(h, 80), 60)).filter(Boolean))).slice(0, 12);
  const serviceNav = navItems.some((i) => /услуг|service|ремонт/i.test(i.text));

  // Цены
  const priceMentions = findPriceMentions(allText);
  const onRequest = /по запросу|стоимость после|уточняйте|price on request|call for (a )?price|after diagnostics/i.test(allText);
  const presentation: SiteAnalysis['structure']['prices']['presentation'] = priceMentions.length >= 2 ? (/(^|\s)(от|from)\s*\d/i.test(allText) ? 'from' : 'listed') : priceMentions.length === 1 ? 'from' : onRequest ? 'on_request' : 'none';

  // Формы
  const allForms = parsed.flatMap((p) => select(p.root, 'form'));
  const formInfo = allForms.map(describeForm);

  // Контакты
  const phoneLinks = parsed.reduce((n, p) => n + select(p.root, 'a[href^="tel:" i]').length, 0);
  const hasEmail = parsed.some((p) => select(p.root, 'a[href^="mailto:" i]').length > 0) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(allText);
  const hasAddress = parsed.some((p) => select(p.root, 'address, [itemprop="address"], [class*="address" i]').length > 0) || jsonLdTypes.some((t) => /PostalAddress/i.test(t));

  // Дизайн
  const themeColor = attrOr(selectOne(main, 'meta[name="theme-color" i]'), 'content');
  const { colors, accents } = extractColors(css + '\n' + (themeColor ? `x{color:${themeColor}}` : ''));
  const { fonts, providers } = extractFonts(main, css);

  const heroEl =
    selectOne(main, '[class*="hero" i], [id*="hero" i], [class*="jumbotron" i], [class*="main-screen" i], [class*="first-screen" i], [class*="banner" i], [class*="intro" i]') ??
    selectOne(main, 'h1')?.parent ??
    null;
  const heroHasMedia = heroEl
    ? select(heroEl, 'img, video, picture, svg').length > 0 || /background(-image)?\s*:[^;]*url\(/i.test(attr(heroEl, 'style')) || /bg|background|cover/i.test(classOrId(heroEl))
    : false;
  const heroCtas = heroEl
    ? select(heroEl, 'a[class*="btn" i], a[class*="button" i], button, a[class*="cta" i]').map((e) => clip(linkText(e), 40)).filter(Boolean).slice(0, 3)
    : [];
  const heroHasH1 = heroEl ? select(heroEl, 'h1').length > 0 || heroEl.tag === 'h1' : false;
  const layoutHint = !heroEl
    ? 'главный экран не определён'
    : heroHasMedia && heroHasH1
      ? 'заголовок поверх изображения/видео (по HTML; требует визуальной проверки)'
      : heroHasH1
        ? 'текстовый главный экран (по HTML; требует визуальной проверки)'
        : 'главный экран без заголовка h1';

  const buttonEls = select(main, 'a[class*="btn" i], a[class*="button" i], button, input[type="submit" i], [role="button"]');
  const btnHints: string[] = [];
  const radii: number[] = [];
  let upper = false;
  let shadow = false;
  let hoverTransition = false;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/btn|button/i.test(m[1])) continue;
    const r = /border-radius\s*:\s*(\d+)px/i.exec(m[2]);
    if (r) radii.push(Number(r[1]));
    if (/text-transform\s*:\s*uppercase/i.test(m[2])) upper = true;
    if (/box-shadow\s*:/i.test(m[2])) shadow = true;
    if (/transition\s*:/i.test(m[2])) hoverTransition = true;
  }
  if (radii.length) {
    const r = radii.sort((a, b) => a - b)[Math.floor(radii.length / 2)];
    btnHints.push(r >= 999 ? 'полностью скруглённые («таблетки»)' : r >= 8 ? `скругление ~${r}px` : r === 0 ? 'прямые углы' : `небольшое скругление ~${r}px`);
  }
  if (upper) btnHints.push('текст заглавными буквами');
  if (shadow) btnHints.push('тень у кнопок');
  if (hoverTransition) btnHints.push('плавное изменение при наведении');

  const imgs = select(main, 'img');
  const motionLibs: string[] = [];
  const scriptBlob = parsed.flatMap((p) => select(p.root, 'script[src], link[href]').map((e) => attr(e, 'src') || attr(e, 'href'))).join(' ');
  const htmlBlob = `${scriptBlob} ${classBlob(main)}`;
  for (const [re, name] of [
    [/aos(\.min)?\.(js|css)|data-aos/i, 'AOS'],
    [/gsap|scrolltrigger/i, 'GSAP'],
    [/animate\.css|animate__/i, 'animate.css'],
    [/lottie/i, 'Lottie'],
    [/framer-motion/i, 'Framer Motion'],
    [/scrollreveal/i, 'ScrollReveal'],
    [/wow(\.min)?\.js|\bwow\b/i, 'WOW.js'],
    [/swiper/i, 'Swiper'],
  ] as Array<[RegExp, string]>) {
    if (re.test(htmlBlob)) motionLibs.push(name);
  }

  // Технические сведения
  const frameworks: string[] = [];
  const fwBlob = `${htmlBlob} ${parsed.map((p) => p.html.slice(0, 6000)).join(' ')}`;
  for (const [re, name] of [
    [/wp-content|wp-includes/i, 'WordPress'],
    [/tilda|t-records/i, 'Tilda'],
    [/wixstatic|wix\.com/i, 'Wix'],
    [/bitrix/i, 'Bitrix'],
    [/_next\//i, 'Next.js'],
    [/_nuxt\//i, 'Nuxt'],
    [/jquery/i, 'jQuery'],
    [/bootstrap|col-(sm|md|lg)-\d/i, 'Bootstrap'],
    [/tailwind/i, 'Tailwind CSS'],
  ] as Array<[RegExp, string]>) {
    if (re.test(fwBlob)) frameworks.push(name);
  }
  const origin = (() => {
    try {
      return new URL(pages[0].url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const hrefs = select(main, 'a[href]').map((a) => attr(a, 'href')).filter((h) => h && !/^(tel|mailto|javascript|#)/i.test(h));
  const external = uniq(
    hrefs
      .map((h) => {
        try {
          const u = new URL(h, pages[0].url);
          return u.hostname.replace(/^www\./, '') !== origin ? u.hostname : '';
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );

  return {
    analyzedPages: parsed.map((p) => ({ url: p.url, title: clip(textOfFirst(p.root, 'title'), 100) })),
    meta: {
      title: clip(title, 140),
      description: clip(description, 240),
      lang: attrOr(selectOne(main, 'html'), 'lang'),
      themeColor,
      canonical: attrOr(selectOne(main, 'link[rel="canonical" i]'), 'href'),
      hasViewport: !!selectOne(main, 'meta[name="viewport" i]'),
      hasOgImage: !!selectOne(main, 'meta[property="og:image" i]'),
      jsonLdTypes,
    },
    structure: {
      h1: select(main, 'h1').map((h) => clip(textOf(h, 160), 120)).filter(Boolean).slice(0, 3),
      h2: select(main, 'h2').map((h) => clip(textOf(h, 160), 100)).filter(Boolean).slice(0, 12),
      nav: { items: navItems, mobileMenuHint },
      sectionsCount: select(main, 'section').length,
      services: { detected: serviceItems.length > 0 || serviceNav || serviceSections.length > 0, items: serviceItems },
      prices: { presentation, mentions: priceMentions },
      forms: { count: allForms.length, fields: uniq(formInfo.flatMap((f) => f.fields)).slice(0, 20), summaries: formInfo.map((f) => f.summary).slice(0, 6) },
      contacts: { phoneLinks, hasEmail, hasAddress, hasWorkingHours: features.working_hours.present !== 'no' },
    },
    design: {
      colors,
      accents,
      fonts,
      fontProviders: providers,
      hero: { found: !!heroEl, hasMedia: heroHasMedia, hasH1: heroHasH1, ctaTexts: heroCtas, layoutHint },
      layout: {
        gridMentions: select(main, '[class*="grid" i], [class*="col-" i], [class*="row" i]').length,
        cardMentions: select(main, '[class*="card" i], [class*="tile" i]').length,
        usesCssGrid: /display\s*:\s*grid/i.test(css),
        usesFlex: /display\s*:\s*flex/i.test(css),
        images: imgs.length,
        lazyImages: imgs.filter((i) => attr(i, 'loading').toLowerCase() === 'lazy').length,
        responsiveImages: select(main, 'picture, img[srcset]').length > 0,
      },
      buttons: { count: buttonEls.length, hints: btnHints },
      motion: {
        transitions: /transition\s*:/i.test(css),
        keyframes: (css.match(/@keyframes\s+[\w-]+/gi) ?? []).length,
        libraries: motionLibs,
        verification: 'needs_browser_check',
      },
    },
    features,
    technical: {
      scripts: select(main, 'script').length,
      frameworks,
      internalLinks: hrefs.length - hrefs.filter((h) => { try { return new URL(h, pages[0].url).hostname.replace(/^www\./, '') !== origin; } catch { return false; } }).length,
      externalLinks: hrefs.filter((h) => { try { return new URL(h, pages[0].url).hostname.replace(/^www\./, '') !== origin; } catch { return false; } }).length,
      externalHosts: external.slice(0, 10),
      hasSitemapHint: select(main, 'link[rel="sitemap" i], a[href*="sitemap" i]').length > 0,
    },
    rejectedPatterns: detectRejectedPatterns(main, css),
  };
}

function classBlob(root: El): string {
  const parts: string[] = [];
  walk(root, (el) => {
    const c = attr(el, 'class');
    if (c) parts.push(c);
    for (const k of Object.keys(el.attrs)) if (k.startsWith('data-')) parts.push(k);
  });
  return parts.join(' ').slice(0, 200_000);
}

// ---------------------------------------------------------------------------
// Выбор дополнительных страниц и таблиц стилей
// ---------------------------------------------------------------------------

const INTERESTING_PAGE =
  /услуг|цен|прайс|запис|контакт|работ|портфолио|галере|о нас|о сервис|service|price|pricing|book|appointment|contact|gallery|portfolio|about|repair|ремонт|diagnos|диагност/i;
const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|avi|mov|ico|css|js|xml|json)(\?|$)/i;

function sameSite(a: string, b: string): boolean {
  return a.replace(/^www\./, '') === b.replace(/^www\./, '');
}

export function pickExtraLinks(pageUrl: string, html: string, max: number): string[] {
  if (max <= 0) return [];
  const root = parseHtml(html);
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const scored: Array<{ url: string; score: number; section: string }> = [];
  const seen = new Set<string>([base.toString().replace(/#.*$/, '')]);
  for (const a of select(root, 'a[href]')) {
    const href = attr(a, 'href').trim();
    if (!href || /^(#|tel:|mailto:|javascript:|viber:|tg:)/i.test(href) || FILE_EXT.test(href)) continue;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, base.hostname)) continue;
    u.hash = '';
    const key = u.toString();
    if (seen.has(key)) continue;
    const label = `${linkText(a)} ${u.pathname}`;
    if (!INTERESTING_PAGE.test(label)) continue;
    seen.add(key);
    let score = 1;
    if (/услуг|service|ремонт|repair|diagnos|диагност/i.test(label)) score += 3;
    if (/цен|прайс|price|pricing/i.test(label)) score += 3;
    if (/запис|book|appointment/i.test(label)) score += 2;
    if (/контакт|contact/i.test(label)) score += 1;
    const depth = u.pathname.split('/').filter(Boolean).length;
    score -= Math.max(0, depth - 1) * 0.5; // глубокие ссылки менее интересны, чем разделы
    scored.push({ url: key, score, section: u.pathname.split('/').filter(Boolean)[0] ?? '' });
  }
  scored.sort((a, b) => b.score - a.score);
  // Сначала по одной странице из каждого раздела сайта, потом — остальные.
  const picked: string[] = [];
  const sections = new Set<string>();
  for (const s of scored) {
    if (picked.length >= max) break;
    if (!sections.has(s.section)) {
      sections.add(s.section);
      picked.push(s.url);
    }
  }
  for (const s of scored) {
    if (picked.length >= max) break;
    if (!picked.includes(s.url)) picked.push(s.url);
  }
  return picked;
}

export function pickStylesheets(pageUrl: string, html: string, max: number): string[] {
  const root = parseHtml(html);
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const l of select(root, 'link[rel~="stylesheet" i][href]')) {
    if (/print/i.test(attr(l, 'media'))) continue;
    try {
      const u = new URL(attr(l, 'href'), base);
      if (/^https?:$/.test(u.protocol) && sameSite(u.hostname, base.hostname)) out.push(u.toString());
    } catch {
      // пропускаем некорректные адреса
    }
    if (out.length >= max) break;
  }
  return uniq(out);
}
