/** Учебные страницы для тестов анализатора. Это не реальные сайты. */

export const RICH_CSS = `
:root { --primary: #E87532; --dark: #17191C; }
body { font-family: "Manrope", Arial, sans-serif; background: #F4F4F1; color: #23272B; }
h1, h2 { font-family: 'Oswald', sans-serif; }
.btn { background: #E87532; border-radius: 8px; text-transform: uppercase; box-shadow: 0 2px 6px rgba(0,0,0,.2); transition: background .2s; }
.hero { background-image: url(hero.jpg); }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.row { display: flex; }
.sticky-call { position: fixed; bottom: 0; left: 0; right: 0; }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
a { color: #E87532; } .x { color: #E87532; } .y { color: rgb(35, 39, 43); }
@font-face { font-family: "Manrope"; src: url(m.woff2); }
`;

export const RICH_HOME = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Автосервис «Мотор» — ремонт и диагностика</title>
<meta name="description" content="Диагностика, ТО и ремонт автомобилей. Запись онлайн.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#17191C">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&family=Inter:wght@400">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"AutoRepair","name":"Мотор","address":{"@type":"PostalAddress","streetAddress":"ул. Тестовая, 1"}}</script>
<script src="/js/particles.min.js"></script>
<script src="https://cdn.example/aos.js"></script>
</head>
<body class="home">
<header>
  <nav>
    <a href="/">Главная</a>
    <a href="/services">Услуги</a>
    <a href="/prices">Цены</a>
    <a href="/contacts">Контакты</a>
    <a href="/admin/login">Вход</a>
    <a href="tel:+380001112233">Позвонить</a>
    <button class="burger" aria-label="Открыть меню"></button>
  </nav>
</header>
<section class="hero" id="hero">
  <h1>Автосервис, которому можно доверить автомобиль</h1>
  <p>Диагностика, обслуживание и ремонт</p>
  <a class="btn btn-primary" href="#book">Записаться на сервис</a>
  <a class="btn btn-outline" href="/services">Посмотреть услуги</a>
</section>
<section id="services" class="services">
  <h2>Услуги</h2>
  <div class="filters"><button data-filter="all">Все</button><button data-filter="repair">Ремонт</button></div>
  <div class="grid">
    <div class="card" data-category="repair"><h3>Диагностика подвески</h3><p>от 400 грн</p></div>
    <div class="card" data-category="repair"><h3>Замена тормозных колодок</h3><p>от 600 грн</p></div>
    <div class="card"><h3>Замена масла</h3><p>от 300 грн</p></div>
  </div>
  <a href="/services/brakes">Тормоза</a><a href="/services/suspension">Подвеска</a><a href="/services/oil">Масло</a>
</section>
<section class="how"><h2>Как мы работаем</h2><ol><li>Заявка</li><li>Приём</li><li>Диагностика</li><li>Ремонт</li></ol></section>
<section class="gallery"><h2>Наши работы</h2><img src="a.jpg" loading="lazy" alt=""><img src="b.jpg" loading="lazy" alt=""><div class="before-after">до и после</div></section>
<section class="pricing"><div class="plan">Базовое ТО</div><div class="plan">Расширенное ТО</div><table><tr><th>Базовое</th><th>Стандарт</th><th>Премиум</th></tr><tr><td>500 грн</td><td>900 грн</td><td>1500 грн</td></tr></table></section>
<section class="calc"><h2>Калькулятор стоимости</h2><select><option>ТО</option></select><input type="number"></section>
<section class="reviews"><h2>Отзывы</h2></section>
<section class="faq"><h2>Частые вопросы</h2><details><summary>Нужна ли запись?</summary><p>Да.</p></details><details><summary>Свои запчасти?</summary><p>Можно.</p></details></section>
<section id="book"><h2>Запись на сервис</h2>
<form id="booking-form" action="/book" method="post">
  <input name="name" placeholder="Имя"><input name="phone" type="tel" placeholder="Телефон">
  <select name="make"><option>BMW</option></select><select name="model"><option>X5</option></select><input name="year">
  <textarea name="comment"></textarea><button>Записаться</button>
</form></section>
<section class="contacts">
  <p>Пн-Пт 09:00-19:00, Сб 10:00-16:00</p>
  <address>ул. Тестовая, 1</address>
  <a href="mailto:info@example.invalid">info@example.invalid</a>
  <a href="https://t.me/example_service">Telegram</a>
  <iframe src="https://www.google.com/maps/embed?pb=x"></iframe>
  <iframe src="https://www.youtube.com/embed/abc"></iframe>
</section>
<div class="holo-panel hologram"></div>
<div class="counter stat-number">1500</div>
<div class="sticky-call"><a href="tel:+380001112233">Позвонить</a></div>
<script>AOS.init();</script>
</body></html>`;

export const RICH_SERVICES = `<!doctype html><html lang="ru"><head><title>Услуги</title></head><body>
<h1>Наши услуги</h1>
<div class="service-list"><h3>Развал-схождение</h3><p>от 700 грн</p><h3>Обслуживание кондиционера</h3><p>от 800 грн</p></div>
<p>Стоимость после диагностики</p>
</body></html>`;

export const RICH_CONTACTS = `<!doctype html><html lang="ru"><head><title>Контакты</title></head><body>
<h1>Контакты</h1><p>Режим работы: ежедневно 09:00-19:00</p><a href="tel:+380001112233">+380 00 111 22 33</a>
</body></html>`;

export const PLAIN_HOME = `<!doctype html><html lang="ru"><head><title>Простая страница</title></head><body><h1>Привет</h1><p>Просто текст без функций.</p></body></html>`;

export const BOOKING_WIDGET_HOME = `<!doctype html><html><head><title>Сервис</title></head><body>
<h1>Сервис</h1><iframe src="https://widget.simplybook.me/v2/"></iframe><a href="tel:+380000000000">Звонок</a></body></html>`;
