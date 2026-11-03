import { useState } from 'react';
import { BRAND, CONTACTS, NAV, SERVICES } from '../../data/site';
import { requestBooking, scrollToSection } from '../../lib/bookingStore';
import { Modal } from '../Modal';
import { Logo } from './Header';
import { ShareLinks } from './Share';

function Privacy() {
  return (
    <div className="legal">
      <h2 id="privacy-title" className="legal__title">Privacy policy</h2>
      <p className="legal__fine">Demo text for a portfolio. Before launching a real website, replace it with a document prepared by a lawyer.</p>
      <h3>What data we collect</h3>
      <p>Your name, phone number, car details and the comment you enter in the booking form.</p>
      <h3>Why we need it</h3>
      <p>Only to contact you, confirm your booking and prepare a service bay for your car.</p>
      <h3>Who we share it with</h3>
      <p>Nobody. Your data is never sold or used for marketing emails.</p>
      <h3>How to delete your data</h3>
      <p>Write to {CONTACTS.email} and we will delete your information within 10 business days.</p>
      <p className="legal__fine">The form currently works in demo mode and does not send data anywhere.</p>
    </div>
  );
}

const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export function Footer() {
  const [privacy, setPrivacy] = useState(false);
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('top');
            }}
          />
          <p className="footer__about">{BRAND.about}</p>
          <ShareLinks />
        </div>

        <nav className="footer__col" aria-label="Site sections">
          <h2 className="footer__h">Sections</h2>
          <ul>
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(n.id);
                  }}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <h2 className="footer__h">Services</h2>
          <ul>
            {SERVICES.map((s) => (
              <li key={s.id}>
                <button type="button" className="footer__linkbtn" onClick={() => requestBooking({ service: s.id })}>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col">
          <h2 className="footer__h">Contact</h2>
          <ul className="footer__contacts">
            <li>{CONTACTS.address}</li>
            <li><a href={CONTACTS.phoneHref}>{CONTACTS.phoneDisplay}</a></li>
            <li><a href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a></li>
            <li>Mon–Fri 09:00–19:00<br />Sat 10:00–16:00, Sun closed</li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>© {year} {BRAND.name}. A demo portfolio project: the company, contacts, prices and reviews are fictional. Photos: Unsplash.</p>
        <div className="footer__legal">
          <button type="button" className="footer__linkbtn" onClick={() => setPrivacy(true)}>
            Privacy policy
          </button>
          {/* панель анализатора работает только вместе с локальным сервером */}
          {isLocal && <a href="#/analyzer">Developer panel</a>}
        </div>
      </div>

      <Modal open={privacy} onClose={() => setPrivacy(false)} labelledBy="privacy-title" className="smodal--text">
        <Privacy />
      </Modal>
    </footer>
  );
}
