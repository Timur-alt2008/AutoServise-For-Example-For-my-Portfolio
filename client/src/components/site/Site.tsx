import { useEffect } from 'react';
import { About } from './About';
import { Booking } from './Booking';
import { Contacts } from './Contacts';
import { Faq } from './Faq';
import { Footer } from './Footer';
import { Header } from './Header';
import { Hero } from './Hero';
import { Process } from './Process';
import { Reviews } from './Reviews';
import { Services } from './Services';
import { Works } from './Works';

export const SITE_TITLE = 'Example Auto Service — car service in Kyiv: diagnostics, repair and maintenance';

export function Site() {
  useEffect(() => {
    document.title = SITE_TITLE;
  }, []);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Services />
        <About />
        <Works />
        <Process />
        <Reviews />
        <Booking />
        <Faq />
        <Contacts />
      </main>
      <Footer />
    </>
  );
}
