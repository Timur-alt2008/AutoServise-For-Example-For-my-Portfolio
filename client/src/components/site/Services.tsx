import { useState } from 'react';
import type { ComponentType } from 'react';
import { CURRENCY, SERVICES } from '../../data/site';
import type { Service, ServiceIcon } from '../../data/site';
import { requestBooking } from '../../lib/bookingStore';
import {
  IconAlign,
  IconArrow,
  IconBolt,
  IconBrake,
  IconCheck,
  IconChecklist,
  IconClock,
  IconDrop,
  IconEngine,
  IconGear,
  IconScan,
  IconSuspension,
  IconTire,
} from '../Icons';
import { Modal } from '../Modal';
import { Photo } from '../Photo';
import { Reveal } from './Reveal';

export const SERVICE_ICONS: Record<ServiceIcon, ComponentType<{ size?: number }>> = {
  scan: IconScan,
  engine: IconEngine,
  suspension: IconSuspension,
  drop: IconDrop,
  brake: IconBrake,
  gear: IconGear,
  bolt: IconBolt,
  tire: IconTire,
  align: IconAlign,
  check: IconChecklist,
};

/** Ритм сетки: крупные карточки чередуются с компактными, чтобы раздел не был «плиткой» */
const LAYOUT: ('feature' | 'wide' | 'tile')[] = ['feature', 'wide', 'tile', 'tile', 'tile', 'wide', 'feature', 'tile', 'tile', 'tile'];

const price = (s: Service) => (s.priceFrom ? `from ${s.priceFrom.toLocaleString('en-US')} ${CURRENCY}` : 'after diagnostics');

function ServiceCard({ s, variant, index, onOpen }: { s: Service; variant: (typeof LAYOUT)[number]; index: number; onOpen: () => void }) {
  const Icon = SERVICE_ICONS[s.icon];
  const big = variant === 'feature';
  return (
    <Reveal as="li" className={`svc svc--${variant}`} delay={(index % 3) * 70}>
      <article className="svc__in" onClick={onOpen}>
        <Photo
          name={s.photo}
          alt=""
          ratio={big ? 1.25 : 1.6}
          max={1600}
          sizes={big ? '(min-width: 1080px) 56vw, 100vw' : '(min-width: 1080px) 34vw, (min-width: 720px) 50vw, 100vw'}
          className="svc__photo"
        />
        <div className="svc__body">
          <span className="svc__icon"><Icon size={22} /></span>
          <h3 className="svc__title">{s.title}</h3>
          <p className="svc__text">{s.short}</p>
          <div className="svc__foot">
            <span className="svc__time"><IconClock size={16} /> {s.duration}</span>
            <button
              type="button"
              className="svc__more"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label={`Details: ${s.title}`}
            >
              Details
              <IconArrow size={16} />
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

export function Services() {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = SERVICES.find((s) => s.id === openId);

  return (
    <section id="services" className="section section--base" aria-labelledby="services-title">
      <div className="container">
        <Reveal className="shead">
          <h2 id="services-title" className="shead__title">Our services</h2>
          <p className="shead__lead">
            Ten service areas, from diagnostics to full maintenance. Times are estimates; we confirm the exact time after inspecting your car.
          </p>
        </Reveal>

        <ul className="svc-grid">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.id} s={s} variant={LAYOUT[i] ?? 'tile'} index={i} onOpen={() => setOpenId(s.id)} />
          ))}
        </ul>
      </div>

      <Modal open={Boolean(current)} onClose={() => setOpenId(null)} labelledBy="svc-modal-title" className="smodal--service">
        {current && (
          <div className="svcm">
            <Photo name={current.photo} alt={current.title} ratio={0.9} max={1200} sizes="(min-width: 860px) 420px, 100vw" className="svcm__photo" />
            <div className="svcm__body">
              <h2 id="svc-modal-title" className="svcm__title">{current.title}</h2>
              <p className="svcm__lead">{current.details}</p>
              <dl className="svcm__facts">
                <div>
                  <dt>Time</dt>
                  <dd>{current.duration}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{price(current)}</dd>
                </div>
              </dl>
              <h3 className="svcm__h">What’s included</h3>
              <ul className="svcm__list">
                {current.includes.map((x) => (
                  <li key={x}><IconCheck size={18} /> {x}</li>
                ))}
              </ul>
              <p className="svcm__fine">Prices and times are for demo purposes. The final estimate is given after inspecting the car.</p>
              <div className="svcm__actions">
                <button
                  type="button"
                  className="sbtn sbtn--accent"
                  onClick={() => {
                    const id = current.id;
                    setOpenId(null);
                    window.setTimeout(() => requestBooking({ service: id }), 260);
                  }}
                >
                  Book this service
                </button>
                <button type="button" className="sbtn sbtn--line" onClick={() => setOpenId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
