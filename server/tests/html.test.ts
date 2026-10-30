import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attr, decodeEntities, parseHtml, select, selectOne, textOf } from '../src/html.ts';

const SAMPLE = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><title>Автосервис &laquo;Тест&raquo; | СТО</title>
<meta name="description" content="Ремонт &amp; диагностика">
<style>.btn{color:#E87532}</style>
<script>var a = "<div>не тег</div>";</script>
</head>
<body class="home page">
<!-- комментарий <div id="no"> -->
<header id="top"><nav><a href="/services" class="nav-link active">Услуги</a><a href="tel:+380001234567">Позвонить</a></nav></header>
<main>
  <section class="hero big" data-x="1"><h1>Заголовок <b>страницы</b></h1><p>Первый абзац<p>Второй абзац</section>
  <ul><li>Раз<li>Два<li>Три</ul>
  <form action="/book" method=post><input name=phone type="tel" required><select name="make"><option>BMW<option>Audi</select><button>Отправить</button></form>
  <img src="a.jpg" loading=lazy alt='Фото "в кавычках"'>
  <div class="card"><div class="card-body"><span data-filter="brakes">Тормоза</span></div></div>
</main>
</body></html>`;

test('entities decode', () => {
  assert.equal(decodeEntities('&laquo;A&raquo; &amp; &#8364; &#x20AC; &unknown;'), '«A» & € € &unknown;');
});

test('parses title, meta and raw-text elements', () => {
  const root = parseHtml(SAMPLE);
  assert.equal(textOf(selectOne(root, 'title')!), 'Автосервис «Тест» | СТО');
  assert.equal(attr(selectOne(root, 'meta[name=description]')!, 'content'), 'Ремонт & диагностика');
  // содержимое <script> не превращается в элементы
  assert.equal(select(root, 'script div').length, 0);
  assert.equal(select(root, '#no').length, 0, 'комментарии пропускаются');
});

test('implicit closing of li and p', () => {
  const root = parseHtml(SAMPLE);
  assert.equal(select(root, 'ul > li').length, 3);
  const ps = select(root, 'section p');
  assert.equal(ps.length, 2);
  assert.equal(textOf(ps[0]), 'Первый абзац');
});

test('attribute parsing: unquoted, single quotes, boolean', () => {
  const root = parseHtml(SAMPLE);
  const form = selectOne(root, 'form')!;
  assert.equal(attr(form, 'method'), 'post');
  const input = selectOne(root, 'input')!;
  assert.equal(attr(input, 'required'), '');
  assert.ok('required' in input.attrs);
  assert.equal(attr(selectOne(root, 'img')!, 'alt'), 'Фото "в кавычках"');
});

test('selectors: classes, attributes, combinators, lists', () => {
  const root = parseHtml(SAMPLE);
  assert.equal(select(root, '.hero.big').length, 1);
  assert.equal(select(root, 'a[href^="tel:"]').length, 1);
  assert.equal(select(root, 'a[href*=serv]').length, 1);
  assert.equal(select(root, '[data-filter]').length, 1);
  assert.equal(select(root, 'nav a').length, 2);
  assert.equal(select(root, 'header > a').length, 0);
  assert.equal(select(root, 'nav > a').length, 2);
  assert.equal(select(root, 'h1, form, img').length, 3);
  assert.equal(select(root, 'div.card div.card-body span[data-filter="brakes"]').length, 1);
  assert.equal(select(root, '[class*="NAV" i]').length, 1);
});

test('textOf collapses whitespace and skips scripts', () => {
  const root = parseHtml('<div> A  <b>B</b>\n<script>x()</script> C </div>');
  assert.equal(textOf(selectOne(root, 'div')!), 'A B C');
});

test('survives broken markup', () => {
  const root = parseHtml('<div><span>текст<div class=a>без закрытия <a href=x>ссылка');
  assert.equal(select(root, 'a').length, 1);
  assert.equal(textOf(selectOne(root, 'a')!), 'ссылка');
  const root2 = parseHtml('a < b <<< <3 </ > <div');
  assert.ok(root2.children.length > 0);
});

test('handles a large document without blowing up', () => {
  const big = '<div>' + '<p>строка <b>x</b></p>'.repeat(20000) + '</div>';
  const t0 = Date.now();
  const root = parseHtml(big);
  assert.equal(select(root, 'b').length, 20000);
  assert.ok(Date.now() - t0 < 5000);
});
