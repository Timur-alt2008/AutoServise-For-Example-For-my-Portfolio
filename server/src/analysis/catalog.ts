import type { FeatureKey, RealismChecks, Scores } from './types.ts';

/**
 * Каталог решений, которые анализатор умеет распознавать на чужих сайтах.
 *
 * Идея появляется ТОЛЬКО если на проанализированной странице найден её признак
 * (см. `trigger`). Перед показом идея проходит фильтр реалистичности и проверку
 * «а нет ли этого уже в проекте».
 */

export interface IdeaTemplate {
  key: string;
  trigger: FeatureKey;
  /** Если задано — идея предлагается, только когда среди найденных признаков есть совпадение. */
  triggerEvidence?: RegExp;
  title: string;
  description: string;
  /** Какую проблему решает. */
  problem: string;
  benefit: string;
  recommendation: string;
  scores: Scores;
  realism: RealismChecks;
  /** Если не null — в EXAMPLE Auto Service это уже реализовано, идея не предлагается. */
  alreadyInProject: string | null;
  /** Причина, по которой идея не проходит фильтр реалистичности (показывается в разделе «Отброшено»). */
  realismNote?: string;
  steps: string[];
}

const ALL_OK: RealismChecks = {
  fitsRegularAutoService: true,
  helpsClientOrOwner: true,
  noExpensiveInfrastructure: true,
  noInventedData: true,
  noFalsePromises: true,
  notOverloading: true,
  worksOnMobile: true,
  matchesBrandStyle: true,
};

/** Проверки, которые выполняются для каждой идеи после внедрения. */
export const STANDARD_CHECKS: string[] = [
  'Нет горизонтальной прокрутки на ширинах 320, 360, 375, 390, 430 px',
  'Вёрстка корректна на 768 и 1024 px',
  'Вёрстка корректна на 1280, 1440 и 1920 px',
  'Кнопки удобно нажимаются пальцем (не меньше 44×44 px)',
  'В консоли браузера нет ошибок JavaScript и неудачных сетевых запросов',
  'Анимации не блокируют прокрутку и отключаются при prefers-reduced-motion',
];

export const TEMPLATES: IdeaTemplate[] = [
  {
    key: 'sticky_mobile_cta',
    trigger: 'sticky_cta',
    title: 'Закреплённая кнопка «Записаться / Позвонить» на телефоне',
    description:
      'Узкая панель у нижнего края экрана на мобильных устройствах: две кнопки — позвонить и записаться. Панель остаётся на месте при прокрутке.',
    problem:
      'На телефоне кнопка записи остаётся наверху страницы, и человеку приходится возвращаться к началу, чтобы связаться с сервисом.',
    benefit: 'Действие «записаться» всегда под рукой — больше обращений без лишнего поиска и без изменения дизайна страницы.',
    recommendation:
      'Показывать панель только на экранах до 768 px, скрывать её, когда на экране уже видна форма записи или у пользователя открыта клавиатура. Кнопка «Записаться» ведёт к форме, «Позвонить» — ссылка tel:.',
    scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 4, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Добавить компонент StickyCta с двумя кнопками (tel: и якорь на форму записи)',
      'Показывать только на ширине до 768 px; учесть safe-area на iPhone (env(safe-area-inset-bottom))',
      'Скрывать компонент, когда форма записи видна на экране (IntersectionObserver)',
      'Добавить нижний отступ странице, чтобы панель не закрывала подвал',
    ],
  },
  {
    key: 'before_after_gallery',
    trigger: 'before_after',
    title: 'Галерея работ с фото «до и после»',
    description: 'Каждый пример работы показывается двумя снимками: состояние автомобиля до ремонта и после — ползунком или парой фото.',
    problem: 'Текстовое описание «заменили колодки» мало что доказывает; наглядный результат вызывает больше доверия.',
    benefit: 'Клиент видит, что именно сделано, и лучше понимает, за что платит.',
    recommendation:
      'Добавить в карточки кейсов пару фото «до/после». Пока реальных снимков нет, показывать только явно помеченные демонстрационные изображения и не выдавать их за настоящие работы.',
    scores: { usefulness: 4, relevance: 4, feasibility: 3, visual: 5, complexity: 3 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Расширить данные кейса полями «фото до» и «фото после»',
      'Сделать компонент сравнения (ползунок с клавиатурным управлением и подписями «До» / «После»)',
      'Для демонстрации использовать иллюстрации с пометкой «демонстрационный пример»',
    ],
  },
  {
    key: 'service_filters',
    trigger: 'service_filters',
    title: 'Фильтр услуг по типу работ',
    description: 'Над каталогом услуг — переключатели «Диагностика», «Обслуживание», «Ремонт», «Кузов и салон»; карточки показываются по выбранному типу.',
    problem: 'Когда в каталоге десять и больше услуг, человеку трудно найти нужную без прокрутки всего списка.',
    benefit: 'Быстрее находится нужная услуга; каталог можно расширять без перегрузки страницы.',
    recommendation:
      'Добавить группы услуг и кнопки-фильтры над сеткой карточек. Состояние фильтра хранить в адресе страницы (#услуги?тип=ремонт), чтобы им можно было поделиться.',
    scores: { usefulness: 4, relevance: 5, feasibility: 5, visual: 3, complexity: 2 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Присвоить каждой услуге категорию в данных сайта',
      'Добавить панель фильтров (кнопки с aria-pressed) над каталогом',
      'Плавно скрывать/показывать карточки без скачков вёрстки',
      'Показывать сообщение, если в категории пока нет услуг',
    ],
  },
  {
    key: 'vehicle_dependent_select',
    trigger: 'vehicle_selector',
    title: 'Выбор марки и модели автомобиля из списков',
    description: 'В форме заявки вместо двух текстовых полей — список марок и зависимый список моделей; для редких автомобилей остаётся ручной ввод.',
    problem: 'Опечатки и неполные названия в поле «Марка/модель» замедляют обработку заявки.',
    benefit: 'Заявки приходят с точными данными об автомобиле; форму проще заполнить на телефоне.',
    recommendation:
      'Использовать короткий список популярных марок и моделей и пункт «Другая марка» с ручным вводом. Не пытаться перечислять весь рынок.',
    scores: { usefulness: 4, relevance: 5, feasibility: 4, visual: 3, complexity: 3 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Подготовить небольшой справочник марок и моделей (JSON в коде)',
      'Заменить текстовые поля на два связанных списка',
      'Добавить вариант «Другая марка» с текстовым полем',
      'Проверить валидацию и подписи полей для скринридеров',
    ],
  },
  {
    key: 'messenger_buttons',
    trigger: 'messenger_links',
    title: 'Кнопки быстрой связи в Telegram, WhatsApp и Viber',
    description: 'Рядом с телефоном — значки мессенджеров, открывающие чат с сервисом одним нажатием.',
    problem: 'Не все готовы звонить: описать проблему и отправить фото в мессенджере проще.',
    benefit: 'Ещё один удобный канал обращения почти без затрат на разработку.',
    recommendation:
      'Добавить кнопки в блок контактов и шапку. В демонстрационном проекте ссылки должны вести на заглушки с пометкой «демо», а не на несуществующие аккаунты.',
    scores: { usefulness: 4, relevance: 4, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Добавить в блок контактов кнопки Telegram и WhatsApp со ссылками-заглушками',
      'Подписать их «Демо» до подключения реальных аккаунтов',
      'Проверить, что кнопки удобно нажимаются на телефоне',
    ],
  },
  {
    key: 'open_now_badge',
    trigger: 'working_hours',
    title: 'Индикатор «Сейчас открыто / закрыто»',
    description: 'Небольшая отметка рядом с графиком работы показывает, работает ли сервис в данный момент, и когда откроется.',
    problem: 'Человек вечером или в выходной звонит и не знает, ответят ли ему.',
    benefit: 'Меньше пропущенных звонков и разочарований; предложение оставить заявку, если сервис закрыт.',
    recommendation: 'Считать статус на стороне браузера по графику из данных сайта; учитывать часовой пояс сервиса и показывать текст, а не только цвет.',
    scores: { usefulness: 3, relevance: 4, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Вынести график работы в структурированные данные',
      'Написать функцию «открыто сейчас» с учётом часового пояса сервиса',
      'Показать статус в верхней строке и в блоке контактов',
    ],
  },
  {
    key: 'plan_comparison',
    trigger: 'plan_comparison',
    title: 'Сравнение вариантов обслуживания',
    description: 'Таблица или карточки «Базовое ТО», «Расширенное ТО», «Комплексное ТО» с перечнем работ в каждом варианте.',
    problem: 'Непонятно, чем отличаются варианты обслуживания и что входит в каждый.',
    benefit: 'Клиенту проще выбрать подходящий вариант; сервис заранее объясняет состав работ.',
    recommendation:
      'Сделать таблицу с галочками «входит / не входит». Цены показывать только демонстрационные и с пометкой «от», а итог — после диагностики.',
    scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 4, complexity: 2 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Составить перечень работ для трёх вариантов ТО',
      'Сделать адаптивную таблицу (на телефоне — карточки друг под другом)',
      'Добавить пометку, что состав работ зависит от автомобиля',
    ],
  },
  {
    key: 'service_pages',
    trigger: 'service_pages',
    title: 'Отдельная страница для каждой услуги',
    description: 'Каждая услуга получает собственный адрес, описание, перечень работ и форму запроса.',
    problem: 'Одна длинная страница плохо находится в поиске по запросам вроде «ремонт тормозов» и неудобна для ссылок.',
    benefit: 'Лучше поисковая видимость, можно давать прямые ссылки на услугу в рекламе и мессенджерах.',
    recommendation:
      'Добавить маршрутизацию и шаблон страницы услуги, использовать уже существующие данные услуг. Начать с трёх самых востребованных.',
    scores: { usefulness: 4, relevance: 4, feasibility: 3, visual: 3, complexity: 3 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Добавить маршрутизацию (адрес вида /services/brakes)',
      'Сделать шаблон страницы услуги на основе данных каталога',
      'Добавить хлебные крошки и ссылку «Запросить стоимость» с предвыбранной услугой',
      'Проверить заголовки и описания страниц',
    ],
  },
  {
    key: 'cost_calculator',
    trigger: 'calculator',
    title: 'Калькулятор ориентировочной стоимости типового обслуживания',
    description: 'Клиент выбирает тип обслуживания и класс автомобиля и видит диапазон стоимости.',
    problem: 'Люди не звонят, потому что боятся неожиданной цены.',
    benefit: 'Снижает порог обращения и отсеивает нецелевые звонки.',
    recommendation:
      'Считать только типовые работы, показывать диапазон «ориентировочно» и подпись, что итог определяется после диагностики. В демонстрационном проекте использовать только цены из раздела «Цены».',
    scores: { usefulness: 4, relevance: 4, feasibility: 3, visual: 4, complexity: 3 },
    realism: ALL_OK,
    alreadyInProject: null,
    steps: [
      'Определить 3–4 типовых вида обслуживания и демонстрационные диапазоны цен',
      'Сделать форму из двух полей и вывод диапазона',
      'Добавить заметную подпись об ориентировочном характере расчёта и кнопку «Запросить точную стоимость»',
    ],
  },

  // ---- Уже реализовано в проекте ------------------------------------------
  {
    key: 'faq_block',
    trigger: 'faq',
    title: 'Блок часто задаваемых вопросов',
    description: 'Раскрывающиеся ответы на типичные вопросы.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 4, relevance: 5, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть раздел FAQ',
    steps: [],
  },
  {
    key: 'steps_flow',
    trigger: 'stepwise_flow',
    title: 'Понятное объяснение этапов обслуживания',
    description: 'Нумерованные шаги «заявка → приём → диагностика → ремонт».',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 4, relevance: 5, feasibility: 5, visual: 4, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть секция «Как проходит обслуживание»',
    steps: [],
  },
  {
    key: 'price_transparency',
    trigger: 'price_list',
    title: 'Прозрачное представление цен',
    description: 'Раздел с ценами по категориям работ.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть раздел «Цены» с пометкой «демонстрационные»',
    steps: [],
  },
  {
    key: 'works_gallery',
    trigger: 'gallery',
    title: 'Галерея выполненных работ',
    description: 'Примеры работ с фото и просмотром в увеличенном размере.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 4, complexity: 2 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть галерея кейсов с фильтром и увеличением фото',
    steps: [],
  },
  {
    key: 'request_form',
    trigger: 'feedback_form',
    title: 'Форма обратной связи / заявки',
    description: 'Форма с проверкой полей.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть форма записи с проверкой полей',
    steps: [],
  },
  {
    key: 'call_button',
    trigger: 'call_button',
    title: 'Кнопка звонка',
    description: 'Ссылка tel: для звонка в один тап.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 5, relevance: 5, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service кнопка звонка уже есть в шапке и в контактах',
    steps: [],
  },
  {
    key: 'estimate_cta',
    trigger: 'estimate_request',
    title: 'Запрос стоимости из карточки услуги',
    description: 'Кнопка «Запросить стоимость» ведёт в форму с выбранной услугой.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 4, relevance: 5, feasibility: 5, visual: 3, complexity: 1 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service кнопки «Запросить стоимость» уже выбирают услугу в форме',
    steps: [],
  },
  {
    key: 'reviews_block',
    trigger: 'reviews',
    title: 'Блок отзывов',
    description: 'Отзывы клиентов на странице.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 3, complexity: 2 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть блок отзывов (пустое состояние под реальные отзывы)',
    steps: [],
  },
  {
    key: 'online_booking_form',
    trigger: 'online_booking',
    title: 'Форма онлайн-записи',
    description: 'Запись на сервис с выбором даты и времени.',
    problem: '',
    benefit: '',
    recommendation: '',
    scores: { usefulness: 5, relevance: 5, feasibility: 4, visual: 3, complexity: 2 },
    realism: ALL_OK,
    alreadyInProject: 'В EXAMPLE Auto Service уже есть форма записи с желаемой датой и временем',
    steps: [],
  },

  // ---- Не проходят фильтр реалистичности ---------------------------------
  {
    key: 'map_with_route',
    trigger: 'map',
    title: 'Карта с точкой сервиса и маршрутом',
    description: 'Встроенная карта с отметкой сервиса и ссылкой «Построить маршрут».',
    problem: 'Клиенту нужно понять, как доехать.',
    benefit: 'Удобство для реальных клиентов.',
    recommendation: 'Подключать только при наличии реального адреса.',
    scores: { usefulness: 4, relevance: 4, feasibility: 4, visual: 4, complexity: 2 },
    realism: { ...ALL_OK, noInventedData: false, noFalsePromises: false },
    alreadyInProject: null,
    realismNote:
      'Адрес EXAMPLE Auto Service вымышленный. Точка на карте создала бы впечатление, что сервис существует, а проект такого не допускает. Идею стоит вернуть, когда появится реальный адрес.',
    steps: [],
  },
  {
    key: 'video_tour',
    trigger: 'video',
    title: 'Видеообзор сервиса',
    description: 'Короткий ролик о мастерской и команде.',
    problem: 'Хочется показать сервис «изнутри».',
    benefit: 'Повышает доверие к реальному бизнесу.',
    recommendation: 'Нужны реальные съёмки.',
    scores: { usefulness: 3, relevance: 3, feasibility: 2, visual: 5, complexity: 4 },
    realism: { ...ALL_OK, noInventedData: false, noExpensiveInfrastructure: false, worksOnMobile: false },
    alreadyInProject: null,
    realismNote:
      'Для вымышленного сервиса нет реальных съёмок, а стоковое видео выдавалось бы за настоящее. Видео также утяжеляет страницу на мобильных.',
    steps: [],
  },
  {
    key: 'slot_booking_widget',
    trigger: 'online_booking',
    triggerEvidence: /виджет/i,
    title: 'Запись на конкретное время через внешний сервис',
    description: 'Подключённая система записи со свободными слотами и подтверждением.',
    problem: 'Хочется видеть реальную занятость мастеров.',
    benefit: 'Автоматизирует запись у реального сервиса.',
    recommendation: 'Нужна учётная система сервиса.',
    scores: { usefulness: 5, relevance: 4, feasibility: 2, visual: 3, complexity: 5 },
    realism: { ...ALL_OK, noExpensiveInfrastructure: false, noInventedData: false },
    alreadyInProject: null,
    realismNote:
      'Нужны реальные расписание мастеров, сервер и подключение к системе записи. В демонстрационном проекте слоты пришлось бы выдумывать.',
    steps: [],
  },
];
