import { requestBooking, scrollToSection } from '../../lib/bookingStore';
import { useParallax } from '../../lib/hooks';
import { IconArrowDown, IconScan, IconShield, IconTeam } from '../Icons';
import { Photo } from '../Photo';

const POINTS = [
  { icon: IconTeam, title: 'Опыт', text: 'Мастера с профильной специализацией' },
  { icon: IconShield, title: 'Гарантия', text: '12 месяцев на выполненные работы' },
  { icon: IconScan, title: 'Оборудование', text: 'Дилерские сканеры и 3D-стенд' },
];

const WORDS = ['Точность.', 'Надёжность.', 'Совершенство.'];

export function Hero() {
  const media = useParallax<HTMLDivElement>(0.22);
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero__media" ref={media}>
        <Photo
          name="hero"
          alt="Автомобили на постах в профессиональном сервисном боксе"
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
            Сервисный центр в Киеве
          </p>
          <h1 id="hero-title" className="hero__title">
            {WORDS.map((w, i) => (
              <span key={w} className="hero__line" style={{ animationDelay: `${120 + i * 110}ms` }}>
                {w}
              </span>
            ))}
          </h1>
          <p className="hero__lead">
            Профессиональное обслуживание автомобилей с вниманием к каждой детали. Современное оборудование, опытные мастера и качество, которому можно доверять.
          </p>
          <div className="hero__actions">
            <button type="button" className="sbtn sbtn--accent sbtn--lg" onClick={() => requestBooking()}>
              Записаться на сервис
            </button>
            <button type="button" className="sbtn sbtn--glass sbtn--lg" onClick={() => scrollToSection('services')}>
              Наши услуги
              <IconArrowDown size={18} />
            </button>
          </div>
        </div>

        <ul className="hero__points" aria-label="Преимущества">
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
