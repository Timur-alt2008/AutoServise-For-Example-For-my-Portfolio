import { BRAND, CONTACTS, SITE_URL } from '../../data/site';
import { IconFacebook, IconTelegram, IconViber, IconWhatsApp } from '../Icons';

/**
 * Иконки соцсетей. Своих аккаунтов у демо-компании нет, поэтому иконки не ведут
 * на выдуманные профили, а делятся контактами сервиса в выбранном мессенджере.
 * Когда появятся настоящие аккаунты, замените href на ссылки профилей.
 */
export function ShareLinks() {
  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0]! : SITE_URL;
  const text = `${BRAND.name}: ${CONTACTS.address}, ${CONTACTS.phoneDisplay}`;
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const links = [
    { label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: IconTelegram },
    { label: 'Viber', href: `viber://forward?text=${encodeURIComponent(`${text} ${url}`)}`, Icon: IconViber },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, Icon: IconWhatsApp },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: IconFacebook },
  ];
  return (
    <ul className="social">
      {links.map(({ label, href, Icon }) => (
        <li key={label}>
          <a className="social__link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} title={`Share on ${label}`}>
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
