import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, TouchEvent } from 'react';
import { WORKS, WORK_CATEGORIES } from '../../data/site';
import type { WorkCategory } from '../../data/site';
import { requestBooking } from '../../lib/bookingStore';
import { IconArrow, IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconZoom } from '../Icons';
import { Modal } from '../Modal';
import { Photo } from '../Photo';
import { Reveal } from './Reveal';

type Filter = 'all' | WorkCategory;
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'Все работы' }, ...WORK_CATEGORIES.map((c) => ({ id: c, label: c }))];

/**
 * Какие карточки растянуть на две колонки, чтобы в сетке из трёх колонок
 * не оставалось «висящих» одиночных карточек в последнем ряду.
 */
function wideIndexes(count: number): Set<number> {
  const extra = (3 - (count % 3)) % 3;
  if (extra === 0 || count < 2) return new Set();
  return extra === 1 ? new Set([0]) : new Set([0, Math.min(6, count - 1)]);
}

function Viewer({ index, list, onIndex, onClose }: { index: number; list: typeof WORKS; onIndex: (i: number) => void; onClose: () => void }) {
  const work = list[index]!;
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef<number | null>(null);
  const prev = () => onIndex((index - 1 + list.length) % list.length);
  const next = () => onIndex((index + 1) % list.length);

  useEffect(() => setZoom(null), [index]);

  const toggleZoom = (e: MouseEvent<HTMLButtonElement>) => {
    if (zoom) {
      setZoom(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const onTouchStart = (e: TouchEvent) => {
    touch.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const end = e.changedTouches[0]?.clientX;
    touch.current = null;
    if (start === null || end === undefined || zoom) return;
    if (end - start > 50) prev();
    else if (start - end > 50) next();
  };

  return (
    <div className="viewer">
      <div className="viewer__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          className={`viewer__zoom${zoom ? ' is-zoomed' : ''}`}
          onClick={toggleZoom}
          aria-label={zoom ? 'Уменьшить фото' : 'Увеличить фото'}
          style={zoom ? ({ '--zx': `${zoom.x}%`, '--zy': `${zoom.y}%` } as CSSProperties) : undefined}
        >
          <Photo key={work.id} name={work.photo} alt={work.title} max={2200} sizes="(min-width: 1080px) 66vw, 100vw" className="viewer__photo" />
        </button>
        <button type="button" className="viewer__nav viewer__nav--prev" onClick={prev} aria-label="Предыдущая работа">
          <IconChevronLeft />
        </button>
        <button type="button" className="viewer__nav viewer__nav--next" onClick={next} aria-label="Следующая работа">
          <IconChevronRight />
        </button>
        <p className="viewer__count" aria-live="polite">
          {index + 1} / {list.length}
        </p>
      </div>
      <div className="viewer__info">
        <p className="viewer__cat">{work.category}</p>
        <h2 id="work-title" className="viewer__title">{work.title}</h2>
        <p className="viewer__task">{work.task}</p>
        <h3 className="viewer__h">Что сделали</h3>
        <ul className="viewer__list">
          {work.done.map((d) => (
            <li key={d}><IconCheck size={16} /> {d}</li>
          ))}
        </ul>
        <h3 className="viewer__h">Результат</h3>
        <p className="viewer__result">{work.result}</p>
        <p className="viewer__time"><IconClock size={16} /> {work.duration} в работе</p>
        <button
          type="button"
          className="sbtn sbtn--accent sbtn--block"
          onClick={() => {
            onClose();
            window.setTimeout(() => requestBooking(), 260);
          }}
        >
          Записаться с похожей задачей
        </button>
        <p className="viewer__fine">Пример работы демонстрационный, фото — иллюстрация.</p>
      </div>
    </div>
  );
}

export function Works() {
  const [filter, setFilter] = useState<Filter>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const list = filter === 'all' ? WORKS : WORKS.filter((w) => w.category === filter);
  const wide = wideIndexes(list.length);
  const tabs = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<CSSProperties>({});

  // подложка под активным фильтром плавно переезжает к выбранной кнопке
  useLayoutEffect(() => {
    const update = () => {
      const el = tabs.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (el) setIndicator({ width: el.offsetWidth, transform: `translateX(${el.offsetLeft}px)` });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [filter]);

  return (
    <section id="works" className="section section--base" aria-labelledby="works-title">
      <div className="container">
        <Reveal className="shead shead--split">
          <h2 id="works-title" className="shead__title">Наши работы</h2>
          <p className="shead__lead">Примеры задач, с которыми к нам приезжают. Нажмите на карточку, чтобы открыть фото и подробности.</p>
        </Reveal>

        <div className="filters-scroll">
          <div className="filters" ref={tabs} role="group" aria-label="Фильтр по категориям">
            <span className="filters__ind" style={indicator} aria-hidden="true" />
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="filter"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="works" key={filter} aria-live="polite">
          {list.map((w, i) => (
            <li key={w.id} className={`work${wide.has(i) ? ' work--wide' : ''}${list.length % 2 === 1 && i === 0 ? ' work--wide-tab' : ''}`} style={{ '--i': i } as CSSProperties}>
              <button type="button" className="work__media" onClick={() => setOpenIndex(i)} aria-label={`Открыть фото: ${w.title}`}>
                <Photo
                  name={w.photo}
                  alt=""
                  ratio={wide.has(i) ? 2.6 : 1.33}
                  max={1600}
                  sizes="(min-width: 1080px) 40vw, (min-width: 720px) 50vw, 100vw"
                  className="work__photo"
                />
                <span className="work__zoom" aria-hidden="true"><IconZoom size={20} /></span>
              </button>
              <div className="work__body">
                <p className="work__cat">{w.category}</p>
                <h3 className="work__title">{w.title}</h3>
                <p className="work__text">{w.short}</p>
                <button type="button" className="svc__more" onClick={() => setOpenIndex(i)}>
                  Подробнее
                  <IconArrow size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="section__fine">Примеры работ демонстрационные. Фотографии — иллюстрации с Unsplash, а не снимки реальных заказов.</p>
      </div>

      <Modal
        open={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        labelledBy="work-title"
        className="smodal--viewer"
        onPrev={() => setOpenIndex((i) => (i === null ? i : (i - 1 + list.length) % list.length))}
        onNext={() => setOpenIndex((i) => (i === null ? i : (i + 1) % list.length))}
      >
        {openIndex !== null && list[openIndex] && (
          <Viewer index={openIndex} list={list} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
        )}
      </Modal>
    </section>
  );
}
