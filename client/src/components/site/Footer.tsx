import { useState } from 'react';
import { BRAND, CONTACTS, NAV, SERVICES } from '../../data/site';
import { requestBooking, scrollToSection } from '../../lib/bookingStore';
import { Modal } from '../Modal';
import { Logo } from './Header';
import { ShareLinks } from './Share';

function Privacy() {
  return (
    <div className="legal">
      <h2 id="privacy-title" className="legal__title">Политика конфиденциальности</h2>
      <p className="legal__fine">Демонстрационный текст для портфолио. Перед запуском настоящего сайта его нужно заменить документом, подготовленным юристом.</p>
      <h3>Какие данные мы получаем</h3>
      <p>Имя, телефон, данные автомобиля и комментарий, которые вы указываете в форме записи.</p>
      <h3>Зачем они нужны</h3>
      <p>Только чтобы связаться с вами, подтвердить запись и подготовить пост к приезду автомобиля.</p>
      <h3>Кому мы их передаём</h3>
      <p>Никому. Данные не продаются и не используются для рекламных рассылок.</p>
      <h3>Как удалить данные</h3>
      <p>Напишите на {CONTACTS.email} — мы удалим информацию о вас в течение 10 рабочих дней.</p>
      <p className="legal__fine">Сейчас форма работает в демонстрационном режиме и никуда не отправляет данные.</p>
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

        <nav className="footer__col" aria-label="Разделы сайта">
          <h2 className="footer__h">Разделы</h2>
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
          <h2 className="footer__h">Услуги</h2>
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
          <h2 className="footer__h">Контакты</h2>
          <ul className="footer__contacts">
            <li>{CONTACTS.address}</li>
            <li><a href={CONTACTS.phoneHref}>{CONTACTS.phoneDisplay}</a></li>
            <li><a href={`mailto:${CONTACTS.email}`}>{CONTACTS.email}</a></li>
            <li>Пн–Пт 09:00–19:00<br />Сб 10:00–16:00, Вс — выходной</li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>© {year} {BRAND.name}. Демонстрационный проект для портфолио: компания, контакты, цены и отзывы вымышлены. Фото — Unsplash.</p>
        <div className="footer__legal">
          <button type="button" className="footer__linkbtn" onClick={() => setPrivacy(true)}>
            Политика конфиденциальности
          </button>
          {/* панель анализатора работает только вместе с локальным сервером */}
          {isLocal && <a href="#/analyzer">Панель разработчика</a>}
        </div>
      </div>

      <Modal open={privacy} onClose={() => setPrivacy(false)} labelledBy="privacy-title" className="smodal--text">
        <Privacy />
      </Modal>
    </footer>
  );
}
