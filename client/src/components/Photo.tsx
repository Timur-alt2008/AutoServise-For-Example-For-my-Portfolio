import { useState } from 'react';
import type { PhotoKey } from '../data/site';
import { photoSource } from '../lib/photos';

interface Props {
  name: PhotoKey;
  alt: string;
  /** Подсказка браузеру, какой ширины будет картинка на экране */
  sizes: string;
  /** Соотношение сторон кадра (ширина / высота) — снимок обрезается на стороне CDN */
  ratio?: number;
  max?: number;
  className?: string;
  eager?: boolean;
}

/** Фото с адаптивными размерами, ленивой загрузкой и мягким появлением после загрузки */
export function Photo({ name, alt, sizes, ratio, max, className = '', eager }: Props) {
  const [loaded, setLoaded] = useState(false);
  const { src, srcSet } = photoSource(name, { ratio, max });
  return (
    <span className={`photo${loaded ? ' is-loaded' : ''} ${className}`.trim()}>
      <img
        className="photo__img"
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding={eager ? 'sync' : 'async'}
        onLoad={() => setLoaded(true)}
        ref={(img) => {
          // картинка могла загрузиться из кэша раньше, чем React повесил onLoad
          if (img?.complete && img.naturalWidth > 0 && !loaded) setLoaded(true);
        }}
      />
    </span>
  );
}
