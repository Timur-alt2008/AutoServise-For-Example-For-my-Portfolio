export type FeatureKey =
  | 'call_button'
  | 'online_booking'
  | 'estimate_request'
  | 'vehicle_selector'
  | 'service_filters'
  | 'gallery'
  | 'before_after'
  | 'faq'
  | 'map'
  | 'feedback_form'
  | 'stepwise_flow'
  | 'sticky_cta'
  | 'messenger_links'
  | 'calculator'
  | 'reviews'
  | 'price_list'
  | 'working_hours'
  | 'video'
  | 'plan_comparison'
  | 'service_pages';

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  call_button: 'Кнопка звонка',
  online_booking: 'Онлайн-запись',
  estimate_request: 'Запрос предварительной стоимости',
  vehicle_selector: 'Выбор автомобиля (марка/модель/год)',
  service_filters: 'Фильтры услуг',
  gallery: 'Галерея работ',
  before_after: 'Фото «до и после»',
  faq: 'Блок вопросов и ответов (FAQ)',
  map: 'Карта и маршрут',
  feedback_form: 'Форма обратной связи',
  stepwise_flow: 'Пошаговый сценарий («как мы работаем»)',
  sticky_cta: 'Закреплённая кнопка действия',
  messenger_links: 'Мессенджеры (Telegram, WhatsApp, Viber)',
  calculator: 'Калькулятор стоимости',
  reviews: 'Отзывы',
  price_list: 'Прайс-лист',
  working_hours: 'График работы',
  video: 'Видео',
  plan_comparison: 'Сравнение вариантов обслуживания',
  service_pages: 'Отдельные страницы услуг',
};

/**
 * yes    — признак найден в разметке;
 * likely — есть косвенные признаки (классы, скрипты, тексты);
 * no     — признаков нет.
 */
export type Presence = 'yes' | 'likely' | 'no';

/**
 * static              — наличие элемента можно подтвердить по HTML (ссылка tel:, форма, <details> …);
 * needs_browser_check — работу функции по HTML проверить нельзя: «требует браузерной проверки».
 */
export type Verification = 'static' | 'needs_browser_check';

export interface FeatureFinding {
  present: Presence;
  verification: Verification;
  evidence: string[];
}

export interface RejectedPattern {
  pattern: string;
  reason: string;
  evidence: string;
}

export interface SiteAnalysis {
  analyzedPages: Array<{ url: string; title: string }>;
  meta: {
    title: string;
    description: string;
    lang: string;
    themeColor: string;
    canonical: string;
    hasViewport: boolean;
    hasOgImage: boolean;
    jsonLdTypes: string[];
  };
  structure: {
    h1: string[];
    h2: string[];
    nav: { items: Array<{ text: string; href: string }>; mobileMenuHint: boolean };
    sectionsCount: number;
    services: { detected: boolean; items: string[] };
    prices: { presentation: 'listed' | 'from' | 'on_request' | 'none'; mentions: string[] };
    forms: { count: number; fields: string[]; summaries: string[] };
    contacts: { phoneLinks: number; hasEmail: boolean; hasAddress: boolean; hasWorkingHours: boolean };
  };
  design: {
    colors: Array<{ hex: string; count: number }>;
    accents: string[];
    fonts: string[];
    fontProviders: string[];
    hero: { found: boolean; hasMedia: boolean; hasH1: boolean; ctaTexts: string[]; layoutHint: string };
    layout: {
      gridMentions: number;
      cardMentions: number;
      usesCssGrid: boolean;
      usesFlex: boolean;
      images: number;
      lazyImages: number;
      responsiveImages: boolean;
    };
    buttons: { count: number; hints: string[] };
    motion: {
      transitions: boolean;
      keyframes: number;
      libraries: string[];
      verification: 'needs_browser_check';
    };
  };
  features: Record<FeatureKey, FeatureFinding>;
  technical: {
    scripts: number;
    frameworks: string[];
    internalLinks: number;
    externalLinks: number;
    externalHosts: string[];
    hasSitemapHint: boolean;
  };
  rejectedPatterns: RejectedPattern[];
}

export type IdeaStatus = 'new' | 'approved' | 'rejected' | 'implemented';
export const IDEA_STATUSES: IdeaStatus[] = ['new', 'approved', 'rejected', 'implemented'];

export interface Scores {
  usefulness: number;
  relevance: number;
  feasibility: number;
  visual: number;
  /** 1 — очень просто, 5 — очень сложно. */
  complexity: number;
}

/** Восемь вопросов «фильтра реалистичности» из ТЗ. */
export interface RealismChecks {
  fitsRegularAutoService: boolean;
  helpsClientOrOwner: boolean;
  noExpensiveInfrastructure: boolean;
  noInventedData: boolean;
  noFalsePromises: boolean;
  notOverloading: boolean;
  worksOnMobile: boolean;
  matchesBrandStyle: boolean;
}

export const REALISM_QUESTIONS: Record<keyof RealismChecks, string> = {
  fitsRegularAutoService: 'Можно ли применить в обычном автосервисе?',
  helpsClientOrOwner: 'Поможет ли клиенту или владельцу бизнеса?',
  noExpensiveInfrastructure: 'Можно ли сделать без дорогой и сложной инфраструктуры?',
  noInventedData: 'Не требует ли выдуманных данных?',
  noFalsePromises: 'Не создаёт ли ложных обещаний?',
  notOverloading: 'Не перегружает ли интерфейс?',
  worksOnMobile: 'Работает ли на мобильных устройствах?',
  matchesBrandStyle: 'Соответствует ли стилю EXAMPLE Auto Service?',
};

export interface IdeaCandidate {
  key: string;
  title: string;
  description: string;
  whyInteresting: string;
  expectedBenefit: string;
  recommendation: string;
  scores: Scores;
  evidence: string[];
  verification: Verification;
  origin: 'rules' | 'ai';
  steps: string[];
  checks: string[];
  realism: RealismChecks;
}

export interface FilteredIdea {
  key: string;
  title: string;
  /** already_in_project — в EXAMPLE Auto Service это уже есть; realism — не прошло фильтр реалистичности. */
  kind: 'already_in_project' | 'realism';
  reason: string;
  failedChecks: string[];
  evidence: string[];
}
