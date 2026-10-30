/**
 * Разбор robots.txt (RFC 9309, упрощённо):
 *  - выбирается группа с самым длинным совпадением по User-agent, иначе группа «*»;
 *  - побеждает самое длинное правило; при равной длине Allow сильнее Disallow;
 *  - поддерживаются * и $ в путях и Crawl-delay.
 */

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}
interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay?: number;
}

export interface ParsedRobots {
  groups: Group[];
  sitemaps: string[];
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

export function parseRobots(text: string): ParsedRobots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      if (value === '' && field === 'disallow') continue; // пустой Disallow = всё разрешено
      if (value === '') continue;
      current.rules.push({ allow: field === 'allow', pattern: value, regex: patternToRegex(value) });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function pickGroup(parsed: ParsedRobots, agentToken: string): Group | null {
  const token = agentToken.toLowerCase();
  let best: Group | null = null;
  let bestLen = -1;
  for (const g of parsed.groups) {
    for (const a of g.agents) {
      if (a === '*') continue;
      if (token.includes(a) && a.length > bestLen) {
        best = g;
        bestLen = a.length;
      }
    }
  }
  if (best) return best;
  // Все группы «*» объединяются
  const stars = parsed.groups.filter((g) => g.agents.includes('*'));
  if (!stars.length) return null;
  return {
    agents: ['*'],
    rules: stars.flatMap((g) => g.rules),
    crawlDelay: stars.find((g) => g.crawlDelay !== undefined)?.crawlDelay,
  };
}

export function isAllowed(parsed: ParsedRobots, agentToken: string, pathAndQuery: string): boolean {
  const group = pickGroup(parsed, agentToken);
  if (!group) return true;
  if (pathAndQuery === '/robots.txt') return true;
  let winner: Rule | null = null;
  for (const rule of group.rules) {
    if (!rule.regex.test(pathAndQuery)) continue;
    if (
      !winner ||
      rule.pattern.length > winner.pattern.length ||
      (rule.pattern.length === winner.pattern.length && rule.allow && !winner.allow)
    ) {
      winner = rule;
    }
  }
  return winner ? winner.allow : true;
}

/** Пауза между запросами в секундах, если сайт её просит. */
export function crawlDelaySeconds(parsed: ParsedRobots, agentToken: string): number | undefined {
  return pickGroup(parsed, agentToken)?.crawlDelay;
}
