import type { CSSProperties } from 'react';
import { STEPS } from '../../data/site';
import { useReveal } from '../../lib/hooks';
import { Reveal } from './Reveal';

export function Process() {
  const { ref, visible } = useReveal<HTMLOListElement>();
  return (
    <section id="process" className="section section--raised" aria-labelledby="process-title">
      <div className="container">
        <Reveal className="shead shead--split">
          <h2 id="process-title" className="shead__title">How the service works</h2>
          <p className="shead__lead">Six steps from request to handover. At every step you know what’s happening with your car and what it costs.</p>
        </Reveal>

        <ol ref={ref} className={`timeline${visible ? ' is-visible' : ''}`}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="tstep" style={{ '--i': i } as CSSProperties}>
              <span className="tstep__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="tstep__dot" aria-hidden="true" />
              <h3 className="tstep__title">{s.title}</h3>
              <p className="tstep__text">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
