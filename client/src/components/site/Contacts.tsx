import { useEffect, useState } from 'react';
import { BRAND, CONTACTS, ROUTES, openNow } from '../../data/site';
import { IconClock, IconExternal, IconMail, IconPhone, IconPin, IconRoute } from '../Icons';
import { Reveal } from './Reveal';
import { ShareLinks } from './Share';

/** Схема проезда: условная карта района без привязки к реальным координатам */
function MapPlaceholder() {
  return (
    <div className="map">
      <svg className="map__svg" viewBox="0 0 600 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <rect width="600" height="440" fill="var(--bg-2)" />
        <g stroke="var(--map-block)" strokeWidth="1">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={`v${i}`} d={`M${i * 40} 0V440`} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <path key={`h${i}`} d={`M0 ${i * 40}H600`} />
          ))}
        </g>
        <path d="M-20 300C120 270 210 300 330 250S520 150 640 170" stroke="var(--map-river)" strokeWidth="26" fill="none" />
        <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
          <path d="M0 120H600" strokeWidth="14" />
          <path d="M210 0V440" strokeWidth="14" />
          <path d="M0 360L600 210" strokeWidth="9" />
          <path d="M430 0V440" strokeWidth="9" />
          <path d="M0 200H210M210 60H430" strokeWidth="5" />
        </g>
        <path d="M60 120H210V200" stroke="var(--accent)" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" fill="none" />
        <text x="226" y="112" className="map__street">Tsentralna St</text>
      </svg>
      <div className="map__pin">
        <span className="map__pulse" aria-hidden="true" />
        <IconPin size={26} />
      </div>
      <div className="map__card">
        <strong>{BRAND.name}</strong>
        <span>{CONTACTS.street}</span>
      </div>
      <p className="map__note">Schematic map: the address is fictional</p>
    </div>
  );
}

export function Contacts() {
  const [status, setStatus] = useState(() => openNow());
  useEffect(() => {
    const t = window.setInterval(() => setStatus(openNow()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section id="contacts" className="section section--raised" aria-labelledby="contacts-title">
      <div className="container">
        <Reveal className="shead">
          <h2 id="contacts-title" className="shead__title">Contact</h2>
          <p className="shead__lead">Visit, call or write — we’ll help you figure out where to start.</p>
        </Reveal>

        <div className="contacts">
          <Reveal className="contacts__info">
            <address className="clist">
              <div className="clist__row">
                <IconPin />
                <div>
                  <span className="clist__label">Address</span>
                  <span className="clist__value">{CONTACTS.address}</span>
                </div>
              </div>
              <div className="clist__row">
                <IconPhone />
                <div>
                  <span className="clist__label">Phone</span>
                  <a className="clist__value clist__link" href={CONTACTS.phoneHref}>{CONTACTS.phoneDisplay}</a>
                </div>
              </div>
              <div className="clist__row">
                <IconMail />
                <div>
                  <span className="clist__label">Email</span>
                  <a className="clist__value clist__link" href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a>
                </div>
              </div>
              <div className="clist__row">
                <IconClock />
                <div>
                  <span className="clist__label">Opening hours</span>
                  <dl className="hours">
                    {CONTACTS.hours.map((h) => (
                      <div key={h.days}>
                        <dt>{h.days}</dt>
                        <dd>{h.time}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={`status${status.open ? ' is-open' : ''}`}>
                    <span className="status__dot" aria-hidden="true" />
                    {status.text}
                  </p>
                </div>
              </div>
            </address>

            <div className="contacts__routes">
              <a className="sbtn sbtn--accent" href={ROUTES.google} target="_blank" rel="noopener noreferrer">
                <IconRoute size={18} />
                Directions in Google Maps
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a className="sbtn sbtn--line" href={ROUTES.apple} target="_blank" rel="noopener noreferrer">
                Apple Maps
                <IconExternal size={16} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>

            <div className="contacts__share">
              <p className="clist__label">Share our contacts</p>
              <ShareLinks />
            </div>
            <p className="section__fine">All contact details are for demo purposes.</p>
          </Reveal>

          <Reveal className="contacts__map" delay={80}>
            <MapPlaceholder />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
