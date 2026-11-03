import { requestBooking, scrollToSection } from '../../lib/bookingStore';
import { useParallax } from '../../lib/hooks';
import { IconArrowDown, IconScan, IconShield, IconTeam } from '../Icons';
import { Photo } from '../Photo';

const POINTS = [
  { icon: IconTeam, title: 'Experience', text: 'Technicians specialized by system' },
  { icon: IconShield, title: 'Warranty', text: '12 months on completed work' },
  { icon: IconScan, title: 'Equipment', text: 'Dealer-level scanners and a 3D alignment rig' },
];

const WORDS = ['Precision.', 'Reliability.', 'Excellence.'];

export function Hero() {
  const media = useParallax<HTMLDivElement>(0.22);
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero__media" ref={media}>
        <Photo
          name="hero"
          alt="Cars on lifts in a professional service bay"
          sizes="100vw"
          eager
          className="hero__photo"
        />
      </div>
      <div className="hero__shade" aria-hidden="true" />

      <div className="container hero__in">
        <div className="hero__copy">
          <p className="hero__kicker">
            <span className="hero__rule" aria-hidden="true" />
            Car service center in Kyiv
          </p>
          <h1 id="hero-title" className="hero__title">
            {WORDS.map((w, i) => (
              <span key={w} className="hero__line" style={{ animationDelay: `${120 + i * 110}ms` }}>
                {w}
              </span>
            ))}
          </h1>
          <p className="hero__lead">
            Professional car care with attention to every detail. Modern equipment, experienced technicians and quality you can trust.
          </p>
          <div className="hero__actions">
            <button type="button" className="sbtn sbtn--accent sbtn--lg" onClick={() => requestBooking()}>
              Book a service
            </button>
            <button type="button" className="sbtn sbtn--glass sbtn--lg" onClick={() => scrollToSection('services')}>
              Our services
              <IconArrowDown size={18} />
            </button>
          </div>
        </div>

        <ul className="hero__points" aria-label="Advantages">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="hero__point">
              <Icon size={22} />
              <span>
                <strong>{title}</strong>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hero__scale" aria-hidden="true" />
    </section>
  );
}
