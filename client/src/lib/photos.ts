import { PHOTOS } from '../data/site';
import type { PhotoKey } from '../data/site';

/**
 * Свои фотографии. Положите файл в client/src/photos/ с именем <ключ>.jpg
 * (допустимы jpg, jpeg, png, webp) — он заменит снимок с Unsplash.
 * Список ключей — в client/src/photos/README.txt и в PHOTOS (data/site.ts).
 */
const files = import.meta.glob('../photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const local = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const file = path.split('/').pop() ?? '';
  local.set(file.replace(/\.[^.]+$/, ''), url);
}

const WIDTHS = [480, 800, 1200, 1600, 2200] as const;

function unsplash(id: string, w: number, h?: number): string {
  const size = h ? `&h=${h}&fit=crop&crop=entropy` : '';
  return `https://images.unsplash.com/photo-${id}?auto=format&q=72&w=${w}${size}`;
}

export interface PhotoSource {
  src: string;
  srcSet?: string;
}

/**
 * Источник для <img>. ratio — желаемое соотношение сторон (ширина / высота):
 * Unsplash обрежет снимок на своей стороне, и браузер не будет скачивать лишние пиксели.
 */
export function photoSource(key: PhotoKey, opts: { ratio?: number; max?: number } = {}): PhotoSource {
  const own = local.get(key);
  if (own) return { src: own };
  const id = PHOTOS[key];
  const max = opts.max ?? 2200;
  const widths = WIDTHS.filter((w) => w <= max);
  const h = (w: number) => (opts.ratio ? Math.round(w / opts.ratio) : undefined);
  return {
    src: unsplash(id, widths[Math.min(2, widths.length - 1)] ?? max, h(widths[Math.min(2, widths.length - 1)] ?? max)),
    srcSet: widths.map((w) => `${unsplash(id, w, h(w))} ${w}w`).join(', '),
  };
}
