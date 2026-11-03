import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { BRAND, CONTACTS, NAV } from '../../data/site';
import { requestBooking, scrollToSection } from '../../lib/bookingStore';
import { useBodyLock, useScrollSpy } from '../../lib/hooks';
import { IconClose, IconMenu, IconPhone } from '../Icons';

const SECTION_IDS = NAV.map((n) => n.id);

export function Logo({ onClick }: { onClick?: (e: MouseEvent) => void }) {
  return (
    <a className="logo" href="#top" onClick={onClick} aria-label={`${BRAND.name} — home`}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M6 7h17v4.2H10.6v3.1h10.6v4H10.6v2.6H23V25H6V7Z" fill="currentColor" />
        <path d="M24.5 25 28 7" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      </svg>
      <span className="logo__text">
        <span className="logo__name">{BRAND.short}</span>
        <span className="logo__sub">Auto Service</span>
      </span>
    </a>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const active = useScrollSpy(SECTION_IDS);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const firstLink = useRef<HTMLAnchorElement | null>(null);
  useBodyLock(open);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1080) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    // даём меню закрыться и вернуть прокрутку, затем идём к секции
    window.setTimeout(() => scrollToSection(id), 40);
  };

  const book = () => {
    setOpen(false);
    window.setTimeout(() => requestBooking(), 40);
  };

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}${open ? ' is-open' : ''}`}>
      <div className="container header__in">
        <Logo onClick={go('top')} />

        <nav className="nav" aria-label="Main navigation">
          <ul className="nav__list">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  className={`nav__link${active === item.id ? ' is-active' : ''}`}
                  href={`#${item.id}`}
                  aria-current={active === item.id ? 'location' : undefined}
                  onClick={go(item.id)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header__actions">
          <a className="header__phone" href={CONTACTS.phoneHref}>
            <IconPhone size={16} />
            <span>{CONTACTS.phoneDisplay}</span>
          </a>
          <button type="button" className="sbtn sbtn--accent sbtn--sm header__cta" onClick={book}>
            Book now
          </button>
          <button
            ref={toggleRef}
            type="button"
            className="burger"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className="mmenu" aria-hidden={!open} inert={!open}>
        <nav aria-label="Mobile navigation" className="container mmenu__in">
          <ul className="mmenu__list">
            {NAV.map((item, i) => (
              <li key={item.id} style={{ '--i': i } as CSSProperties}>
                <a
                  ref={i === 0 ? firstLink : undefined}
                  className={`mmenu__link${active === item.id ? ' is-active' : ''}`}
                  href={`#${item.id}`}
                  onClick={go(item.id)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mmenu__foot">
            <button type="button" className="sbtn sbtn--accent sbtn--block" onClick={book}>
              Book a service
            </button>
            <a className="sbtn sbtn--line sbtn--block" href={CONTACTS.phoneHref}>
              <IconPhone size={18} />
              {CONTACTS.phoneDisplay}
            </a>
            <p className="mmenu__note">Mon–Fri 09:00–19:00, Sat 10:00–16:00</p>
          </div>
        </nav>
      </div>
    </header>
  );
}
