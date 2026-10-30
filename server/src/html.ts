/**
 * Небольшой терпимый HTML-парсер без внешних зависимостей.
 *
 * Для анализа сайтов нам нужны заголовки, ссылки, формы, атрибуты и текст —
 * полный разбор по правилам HTML5 не требуется. Если понадобится больше,
 * этот файл можно заменить на Cheerio: остальной код использует только
 * функции из этого модуля (parseHtml, select, selectOne, textOf, attr, walk).
 */

export interface El {
  type: 'el';
  tag: string;
  attrs: Record<string, string>;
  children: HNode[];
  parent: El | null;
}
export interface Tx {
  type: 'text';
  text: string;
  parent: El | null;
}
export type HNode = El | Tx;

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

/** Какие открытые элементы закрываются при появлении нового тега (упрощённо). */
const AUTO_CLOSE: Record<string, string[]> = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  option: ['option'],
  p: ['p'],
  h1: ['p'], h2: ['p'], h3: ['p'], h4: ['p'], h5: ['p'], h6: ['p'],
  div: ['p'], ul: ['p'], ol: ['p'], table: ['p'], section: ['p'], form: ['p'], header: ['p'], footer: ['p'], nav: ['p'],
};

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', euro: '€', pound: '£', yen: '¥',
  hryvnia: '₴', times: '×', middot: '·', bull: '•', deg: '°', trade: '™',
};

export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const v = ENTITIES[body.toLowerCase()];
    return v ?? whole;
  });
}

const MAX_NODES = 300_000;
const MAX_DEPTH = 256;

export function parseHtml(html: string): El {
  const root: El = { type: 'el', tag: '#root', attrs: {}, children: [], parent: null };
  const stack: El[] = [root];
  let nodes = 0;
  let i = 0;
  const n = html.length;

  const current = () => stack[stack.length - 1];
  const pushText = (text: string) => {
    if (!text) return;
    const parent = current();
    parent.children.push({ type: 'text', text, parent });
  };

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      pushText(decodeEntities(html.slice(i)));
      break;
    }
    if (lt > i) pushText(decodeEntities(html.slice(i, lt)));
    i = lt;

    // Комментарии, doctype, CDATA, processing instructions
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith('<![CDATA[', i)) {
      const end = html.indexOf(']]>', i + 9);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const end = html.indexOf('>', i + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }

    // Закрывающий тег
    if (html[i + 1] === '/') {
      const m = /^<\/([a-zA-Z][^\s/>]*)[^>]*>?/.exec(html.slice(i, i + 200));
      if (!m) {
        pushText('<');
        i += 1;
        continue;
      }
      const name = m[1].toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag === name) {
          stack.length = s;
          break;
        }
      }
      i += m[0].length;
      continue;
    }

    // Открывающий тег
    const nameMatch = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(i, i + 100));
    if (!nameMatch) {
      pushText('<');
      i += 1;
      continue;
    }
    const tag = nameMatch[1].toLowerCase();
    let p = i + nameMatch[0].length;
    const attrs: Record<string, string> = {};
    let selfClosing = false;

    while (p < n) {
      while (p < n && /\s/.test(html[p])) p++;
      if (p >= n) break;
      const c = html[p];
      if (c === '>') {
        p++;
        break;
      }
      if (c === '/') {
        if (html[p + 1] === '>') {
          selfClosing = true;
          p += 2;
          break;
        }
        p++;
        continue;
      }
      let nameEnd = p;
      while (nameEnd < n && !/[\s=/>]/.test(html[nameEnd])) nameEnd++;
      if (nameEnd === p) {
        p++;
        continue;
      }
      const attrName = html.slice(p, nameEnd).toLowerCase();
      p = nameEnd;
      while (p < n && /\s/.test(html[p])) p++;
      let value = '';
      if (html[p] === '=') {
        p++;
        while (p < n && /\s/.test(html[p])) p++;
        const q = html[p];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, p + 1);
          if (end === -1) {
            value = html.slice(p + 1);
            p = n;
          } else {
            value = html.slice(p + 1, end);
            p = end + 1;
          }
        } else {
          let end = p;
          while (end < n && !/[\s>]/.test(html[end])) end++;
          value = html.slice(p, end);
          p = end;
        }
      }
      if (!(attrName in attrs)) attrs[attrName] = decodeEntities(value);
    }
    i = p;

    if (++nodes > MAX_NODES) break;

    // Неявное закрытие (<li> закрывает предыдущий <li> и т.п.)
    const closers = AUTO_CLOSE[tag];
    if (closers) {
      const top = current();
      if (closers.includes(top.tag)) stack.pop();
    }

    const el: El = { type: 'el', tag, attrs, children: [], parent: current() };
    current().children.push(el);

    if (VOID.has(tag) || selfClosing) continue;

    if (RAW_TEXT.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i');
      const rest = html.slice(i);
      const cm = closeRe.exec(rest);
      const rawEnd = cm ? i + cm.index : n;
      const content = html.slice(i, rawEnd);
      if (content) {
        el.children.push({
          type: 'text',
          text: tag === 'script' || tag === 'style' ? content : decodeEntities(content),
          parent: el,
        });
      }
      i = cm ? rawEnd + cm[0].length : n;
      continue;
    }

    if (stack.length < MAX_DEPTH) stack.push(el);
  }
  return root;
}

// ---------------------------------------------------------------------------
// Обход и текст
// ---------------------------------------------------------------------------

export function walk(node: El, fn: (el: El) => void): void {
  for (const child of node.children) {
    if (child.type === 'el') {
      fn(child);
      walk(child, fn);
    }
  }
}

/** Текст элемента: скрипты и стили не учитываются, пробелы схлопываются. */
export function textOf(node: HNode, max = 2000): string {
  const parts: string[] = [];
  let size = 0;
  const visit = (n: HNode) => {
    if (size > max) return;
    if (n.type === 'text') {
      parts.push(n.text);
      size += n.text.length;
      return;
    }
    if (n.tag === 'script' || n.tag === 'style' || n.tag === 'noscript' || n.tag === 'template') return;
    if (n.tag === 'br' || n.tag === 'td' || n.tag === 'th') parts.push(' ');
    for (const c of n.children) visit(c);
    if (/^(p|div|li|h[1-6]|tr|td|th|dt|dd|option|summary|caption|section|article|button|label|br)$/.test(n.tag)) parts.push(' ');
  };
  visit(node);
  return parts.join('').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function attr(el: El, name: string): string {
  return el.attrs[name] ?? '';
}

/** Как attr(), но принимает null (элемент не найден). */
export function attrOr(el: El | null | undefined, name: string): string {
  return el ? (el.attrs[name] ?? '') : '';
}

export function classList(el: El): string[] {
  return (el.attrs.class ?? '').split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Мини-движок CSS-селекторов
// ---------------------------------------------------------------------------

interface AttrCond {
  name: string;
  op: '' | '=' | '^=' | '$=' | '*=' | '~=' | '|=';
  value: string;
  ci: boolean;
}
interface Compound {
  tag: string | null;
  id: string | null;
  classes: string[];
  attrs: AttrCond[];
}
interface Step {
  combinator: ' ' | '>';
  compound: Compound;
}

const selectorCache = new Map<string, Step[][]>();

function parseCompound(src: string): Compound {
  const c: Compound = { tag: null, id: null, classes: [], attrs: [] };
  let i = 0;
  const ident = () => {
    const m = /^[a-zA-Z0-9_\- -￿\\]+/.exec(src.slice(i));
    if (!m) throw new Error(`Некорректный селектор: ${src}`);
    i += m[0].length;
    return m[0].replace(/\\/g, '');
  };
  if (src[i] === '*') i++;
  else if (/[a-zA-Z]/.test(src[i] ?? '')) c.tag = ident().toLowerCase();
  while (i < src.length) {
    const ch = src[i];
    if (ch === '.') {
      i++;
      c.classes.push(ident());
    } else if (ch === '#') {
      i++;
      c.id = ident();
    } else if (ch === '[') {
      const end = src.indexOf(']', i);
      if (end === -1) throw new Error(`Некорректный селектор: ${src}`);
      const body = src.slice(i + 1, end);
      i = end + 1;
      const m = /^\s*([^\s~|^$*=\]]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*(i)?)?\s*$/.exec(body);
      if (!m) throw new Error(`Некорректный атрибутный селектор: ${body}`);
      c.attrs.push({
        name: m[1].toLowerCase(),
        op: (m[2] ?? '') as AttrCond['op'],
        value: m[3] ?? m[4] ?? m[5] ?? '',
        ci: m[6] === 'i',
      });
    } else {
      throw new Error(`Неподдерживаемая часть селектора: ${src.slice(i)}`);
    }
  }
  return c;
}

function parseSelector(selector: string): Step[][] {
  const cached = selectorCache.get(selector);
  if (cached) return cached;
  const alternatives: Step[][] = [];
  // Делим по запятым вне скобок []
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of selector) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else buf += ch;
  }
  parts.push(buf);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const steps: Step[] = [];
    let comb: ' ' | '>' = ' ';
    // токены: составные селекторы и комбинаторы
    const tokens: string[] = [];
    let cur = '';
    let br = 0;
    for (const ch of trimmed) {
      if (ch === '[') br++;
      if (ch === ']') br--;
      if (br === 0 && (ch === ' ' || ch === '>')) {
        if (cur) tokens.push(cur);
        cur = '';
        if (ch === '>') tokens.push('>');
      } else cur += ch;
    }
    if (cur) tokens.push(cur);
    for (const t of tokens) {
      if (t === '>') {
        comb = '>';
        continue;
      }
      steps.push({ combinator: comb, compound: parseCompound(t) });
      comb = ' ';
    }
    alternatives.push(steps);
  }
  selectorCache.set(selector, alternatives);
  return alternatives;
}

function matchCompound(el: El, c: Compound): boolean {
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && el.attrs.id !== c.id) return false;
  if (c.classes.length) {
    const have = classList(el);
    for (const cls of c.classes) if (!have.includes(cls)) return false;
  }
  for (const a of c.attrs) {
    const raw = el.attrs[a.name];
    if (raw === undefined) return false;
    if (a.op === '') continue;
    const v = a.ci ? raw.toLowerCase() : raw;
    const w = a.ci ? a.value.toLowerCase() : a.value;
    switch (a.op) {
      case '=': if (v !== w) return false; break;
      case '^=': if (!v.startsWith(w)) return false; break;
      case '$=': if (!v.endsWith(w)) return false; break;
      case '*=': if (!v.includes(w)) return false; break;
      case '~=': if (!v.split(/\s+/).includes(w)) return false; break;
      case '|=': if (!(v === w || v.startsWith(`${w}-`))) return false; break;
    }
  }
  return true;
}

function matchSteps(el: El, steps: Step[], idx: number): boolean {
  const step = steps[idx];
  if (!matchCompound(el, step.compound)) return false;
  if (idx === 0) return true;
  if (step.combinator === '>') {
    const p = el.parent;
    return !!p && p.tag !== '#root' && matchSteps(p, steps, idx - 1);
  }
  let p = el.parent;
  while (p && p.tag !== '#root') {
    if (matchSteps(p, steps, idx - 1)) return true;
    p = p.parent;
  }
  return false;
}

/** Возвращает все элементы внутри `root`, подходящие под CSS-селектор. */
export function select(root: El, selector: string): El[] {
  const alts = parseSelector(selector);
  const out: El[] = [];
  walk(root, (el) => {
    for (const steps of alts) {
      if (steps.length && matchSteps(el, steps, steps.length - 1)) {
        out.push(el);
        break;
      }
    }
  });
  return out;
}

export function selectOne(root: El, selector: string): El | null {
  return select(root, selector)[0] ?? null;
}

/** Склеивает текст всех <style> и атрибутов style — для поиска цветов и шрифтов. */
export function collectInlineCss(root: El): string {
  const chunks: string[] = [];
  walk(root, (el) => {
    if (el.tag === 'style') chunks.push(textOf(el, 400_000).length ? rawText(el) : '');
    else if (el.attrs.style) chunks.push(`x{${el.attrs.style}}`);
  });
  return chunks.join('\n');
}

export function rawText(el: El): string {
  return el.children.map((c) => (c.type === 'text' ? c.text : '')).join('');
}
