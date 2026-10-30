import { useState } from 'react';
import { FAQ } from '../../data/site';
import { IconPlus } from '../Icons';
import { Reveal } from './Reveal';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="section section--base" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <Reveal className="shead shead--left">
          <h2 id="faq-title" className="shead__title">Частые вопросы</h2>
          <p className="shead__lead">Не нашли ответ? Позвоните — администратор подскажет.</p>
        </Reveal>
        <Reveal as="ul" className="faq" delay={60}>
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q} className={`faq__item${isOpen ? ' is-open' : ''}`}>
                <h3 className="faq__q">
                  <button
                    type="button"
                    className="faq__btn"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    id={`faq-btn-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {f.q}
                    <span className="faq__plus" aria-hidden="true"><IconPlus size={18} /></span>
                  </button>
                </h3>
                <div className="faq__panel" id={`faq-${i}`} role="region" aria-labelledby={`faq-btn-${i}`}>
                  <div className="faq__panel-in">
                    <p>{f.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
