import dns from 'node:dns/promises';
import net from 'node:net';
import { AnalyzerError } from '../errors.ts';

/**
 * Приводит введённый пользователем адрес к безопасному виду.
 * Разрешены только http/https, без логина и пароля в адресе.
 */
export function normalizeUrl(input: string, opts: { allowPrivate?: boolean } = {}): URL {
  let raw = (input ?? '').trim();
  if (!raw) throw new AnalyzerError('invalid_url', 'Адрес не указан');
  if (raw.length > 2000) throw new AnalyzerError('invalid_url', 'Адрес слишком длинный');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AnalyzerError('invalid_url', `Не удалось разобрать адрес: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalyzerError('invalid_url', 'Поддерживаются только адреса http и https');
  }
  if (url.username || url.password) {
    throw new AnalyzerError('invalid_url', 'Адреса с логином и паролем не поддерживаются');
  }
  if (!url.hostname) throw new AnalyzerError('invalid_url', 'В адресе нет имени сайта');
  url.hash = '';

  if (!opts.allowPrivate) {
    const port = url.port;
    const defaultPort = url.protocol === 'https:' ? '443' : '80';
    if (port && port !== defaultPort) {
      throw new AnalyzerError('invalid_url', 'Нестандартные порты не поддерживаются');
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!net.isIP(host) && !host.includes('.')) {
      throw new AnalyzerError('private_address', 'Адреса без домена (например, localhost) не поддерживаются');
    }
  }
  return url;
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_PRIVATE: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3], // multicast + reserved + broadcast
];

export function isPrivateIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const value = ipv4ToInt(ip);
    return V4_PRIVATE.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
    });
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateIp(mapped[1]);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 — уникальные локальные
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 — link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    return false;
  }
  return true; // не IP — считаем небезопасным
}

/** Убеждается, что адрес указывает на публичный интернет, а не на внутреннюю сеть. */
export async function assertPublicHost(hostname: string, allowPrivate: boolean): Promise<void> {
  if (allowPrivate) return;
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new AnalyzerError('private_address', 'Адреса внутренних сетей и localhost запрещены');
    }
    return;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new AnalyzerError('dns_error', `Сайт ${host} не найден (${code ?? 'DNS'})`);
  }
  if (!addresses.length) throw new AnalyzerError('dns_error', `Сайт ${host} не найден`);
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new AnalyzerError('private_address', `Сайт ${host} указывает на внутренний адрес`);
  }
}
