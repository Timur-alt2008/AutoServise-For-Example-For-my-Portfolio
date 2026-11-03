import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_REVIEWS, REVIEWS } from '../../data/site';
import { IconChevronLeft, IconChevronRight, IconStar } from '../Icons';
import { Reveal } from './Reveal';

const isDemo = REVIEWS.length === 0;
const items = isDemo ? DEMO_REVIEWS : REVIEWS;

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase();

export function Reviews() {
  const track = useRef<HTMLUListElement | null>(null);
  const [active, setActive] = useState(0);
  const [perView, setPerView] = useState(1);

  // какая карточка первой видна в ленте — для точек и состояния кнопок
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const card = el.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0');
      setActive(Math.round(el.scrollLeft / step));
      setPerView(Math.max(1, Math.round(el.clientWidth / step)));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const pages = Math.max(1, items.length - perView + 1);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  return (
    <section id="reviews" className="section section--base" aria-labelledby="reviews-title">
      <div className="container">
        <Reveal className="shead shead--split">
          <div>
            <h2 id="reviews-title" className="shead__title">Customer reviews</h2>
            {isDemo && (
              <p className="demo-pill">Sample layout — not real reviews</p>
            )}
          </div>
          <div className="slider-nav">
            <button type="button" className="round-btn" onClick={() => goTo(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous reviews">
              <IconChevronLeft />
            </button>
            <button type="button" className="round-btn" onClick={() => goTo(Math.min(pages - 1, active + 1))} disabled={active >= pages - 1} aria-label="Next reviews">
              <IconChevronRight />
            </button>
          </div>
        </Reveal>

        <ul ref={track} className="reviews" aria-label={isDemo ? 'Sample reviews' : 'Reviews'}>
          {items.map((r) => (
            <li key={r.id} className="review">
              <div className="review__head">
                <span className="review__avatar" aria-hidden="true">{initials(r.author)}</span>
                <span>
                  <strong className="review__author">{r.author}</strong>
                  <span className="review__car">{r.car}</span>
                </span>
              </div>
              <p className="review__stars" aria-label={`Rating ${r.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <IconStar key={n} filled={n <= r.rating} />
                ))}
              </p>
              <blockquote className="review__text">{r.text}</blockquote>
              <p className="review__foot">
                <time dateTime={r.date}>{formatDate(r.date)}</time>
                {isDemo && <span className="review__tag">Sample review</span>}
              </p>
            </li>
          ))}
        </ul>

        <div className="dots" role="group" aria-label="Review pages">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`dot${i === active ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Show reviews starting from ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
