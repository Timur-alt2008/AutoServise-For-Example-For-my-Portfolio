/**
 * Все тексты и данные демонстрационного сайта Example Auto Service.
 * Компания, адрес, контакты, цены, примеры работ и отзывы ВЫМЫШЛЕНЫ.
 * Чтобы адаптировать сайт под настоящий бизнес, достаточно править этот файл.
 */

/** Address опубликованного сайта — для canonical, Open Graph и sitemap. Замените на свой домен. */
export const SITE_URL = 'https://timur-alt2008.github.io/AutoServise-For-Example-For-my-Portfolio/';

export const BRAND = {
  name: 'Example Auto Service',
  short: 'Example',
  tagline: 'Service center',
  about:
    'Diagnostics, repair and maintenance of passenger cars. We follow an agreed plan and explain every step.',
} as const;

export const CONTACTS = {
  address: '15 Tsentralna St, Kyiv, Ukraine',
  street: '15 Tsentralna St',
  city: 'Kyiv',
  phoneDisplay: '+380 67 000 00 00',
  phoneHref: 'tel:+380670000000',
  email: 'example.autoservice@gmail.com',
  hours: [
    { days: 'Monday — Friday', time: '09:00–19:00', open: 9, close: 19, weekdays: [1, 2, 3, 4, 5] },
    { days: 'Saturday', time: '10:00–16:00', open: 10, close: 16, weekdays: [6] },
    { days: 'Sunday', time: 'closed', open: 0, close: 0, weekdays: [0] },
  ],
} as const;

const encodedAddress = encodeURIComponent(CONTACTS.address);
export const ROUTES = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
  apple: `https://maps.apple.com/?daddr=${encodedAddress}`,
} as const;

export const CURRENCY = 'UAH';

export const NAV = [
  { id: 'top', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'works', label: 'Our work' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'contacts', label: 'Contact' },
] as const;

/* ------------------------------------------------------------------ Фото */

/**
 * Фотографии с Unsplash (бесплатная лицензия Unsplash, разрешено коммерческое использование).
 * Это иллюстрации, а не снимки реального сервиса. Чтобы поставить свои фото,
 * положите файл с тем же ключом в client/src/photos/ (например, hero.jpg) — он заменит снимок.
 */
export const PHOTOS = {
  hero: '1792326103553-4e4e8964279e',
  about: '1694026015216-d474894705a2',
  'service-diagnostics': '1727893380169-4dda123e19f7',
  'service-engine': '1486262715619-67b85e0b08d3',
  'service-suspension': '1760317890359-4e6bb111e501',
  'service-fluids': '1771340742493-52fbd5476ccb',
  'service-brakes': '1760317890314-e964ffd7e6a6',
  'service-transmission': '1567093322102-6bdd32fba67d',
  'service-electrics': '1632733711679-529326f6db12',
  'service-tires': '1764015805414-df7de89d405b',
  'service-alignment': '1762028159811-3c5fd0ce259d',
  'service-maintenance': '1643700973089-baa86a1ab9ee',
  'work-scan': '1771340012378-3c86cb649193',
  'work-noise': '1625047509168-a7026f36de04',
  'work-camshaft': '1786028924575-9948c6a58b22',
  'work-timing': '1786028924283-cd732c036531',
  'work-chassis': '1785827195711-e5ab6fed7ced',
  'work-caliper': '1761040100230-8c8e6fc64638',
  'work-polish': '1780558852670-3f49298ecc1f',
  'work-wash': '1633014041037-f5446fb4ce99',
  'work-oil': '1487754180451-c456f719a1fc',
  'work-service': '1775590766345-c117265f0c1b',
} as const;

export type PhotoKey = keyof typeof PHOTOS;

/* ------------------------------------------------------------------ Services */

export type ServiceIcon =
  | 'scan'
  | 'engine'
  | 'suspension'
  | 'drop'
  | 'brake'
  | 'gear'
  | 'bolt'
  | 'tire'
  | 'align'
  | 'check';

export interface Service {
  id: string;
  title: string;
  short: string;
  /** Ориентировочный срок — реалистичный диапазон, точный называется после осмотра */
  duration: string;
  details: string;
  includes: string[];
  /** Демо-цена в гривнах или null, если стоимость определяется after diagnostics */
  priceFrom: number | null;
  photo: PhotoKey;
  icon: ServiceIcon;
}

export const SERVICES: Service[] = [
  {
    id: 'diagnostics',
    title: 'Car diagnostics',
    short: 'Control unit scanning, live sensor data on the road and an inspection on the lift.',
    duration: '1–2 hours',
    details:
      'We start by talking about the symptoms, then read fault codes from every control unit and check live engine and gearbox data. You get a prioritized list of faults: what needs fixing now and what can wait.',
    includes: ['Scan of all electronic control units', 'Sensor data analysis', 'Inspection of components on the lift', 'Written report and estimate'],
    priceFrom: 600,
    photo: 'service-diagnostics',
    icon: 'scan',
  },
  {
    id: 'engine',
    title: 'Engine repair',
    short: 'From tracking down misfires to timing belt replacement and full engine rebuilds.',
    duration: '1–5 business days',
    details:
      'Before repairing, we find the cause of the fault instead of replacing parts at random. Scope, parts and timing are agreed with you in advance; you can see the removed parts.',
    includes: ['Ignition, intake and fuel system diagnostics', 'Timing belt or chain replacement', 'Oil and coolant leak repair', 'Engine rebuild by agreement'],
    priceFrom: null,
    photo: 'service-engine',
    icon: 'engine',
  },
  {
    id: 'suspension',
    title: 'Suspension repair',
    short: 'We find the source of knocks and play and replace only worn parts.',
    duration: '2–6 hours',
    details:
      'We check the suspension on a lift with a play detector, show you the wear we find and agree on replacements. If the geometry is affected, we recommend a wheel alignment afterwards.',
    includes: ['Check for play and mount condition', 'Shock absorber, control arm and bushing replacement', 'Wheel bearing replacement', 'Test drive'],
    priceFrom: 500,
    photo: 'service-suspension',
    icon: 'suspension',
  },
  {
    id: 'fluids',
    title: 'Oil and fluid change',
    short: 'Oil, filters, coolant, brake fluid and gearbox oil according to the service schedule.',
    duration: '30–60 minutes',
    details:
      'We choose oil and fluids that meet your car manufacturer’s specifications. We also check fluid levels, filter condition and look for leaks.',
    includes: ['Engine oil and oil filter', 'Air and cabin filters', 'Coolant and brake fluid', 'Automatic and manual gearbox oil'],
    priceFrom: 400,
    photo: 'service-fluids',
    icon: 'drop',
  },
  {
    id: 'brakes',
    title: 'Brake repair',
    short: 'Pads, discs, calipers and brake fluid — with a final check.',
    duration: '1–3 hours',
    details:
      'We measure pad wear and disc thickness and check the calipers and hoses. After the work we bleed the system and test braking performance.',
    includes: ['Pad and disc replacement', 'Caliper guide pin service', 'Brake fluid replacement', 'Parking brake check'],
    priceFrom: 700,
    photo: 'service-brakes',
    icon: 'brake',
  },
  {
    id: 'transmission',
    title: 'Transmission repair',
    short: 'Manual and automatic gearboxes, clutches, driveshafts and CV joints.',
    duration: '1–4 business days',
    details:
      'We read the transmission control unit codes, check the fluid and test the gearbox on the road. We repair clutches, driveshafts and gearboxes or offer a used replacement unit — by agreement.',
    includes: ['Automatic, DSG and CVT diagnostics', 'Clutch kit replacement', 'Driveshaft and CV joint replacement', 'Gearbox adaptation after repair'],
    priceFrom: null,
    photo: 'service-transmission',
    icon: 'gear',
  },
  {
    id: 'electrics',
    title: 'Electrical and electronics',
    short: 'Parasitic drain diagnosis, wiring, alternator, starter and lighting repair.',
    duration: 'from 1 hour',
    details:
      'We trace electrical faults using manufacturer wiring diagrams, a multimeter and an oscilloscope. The cost of diagnosis is agreed in advance; time depends on complexity.',
    includes: ['Parasitic drain diagnosis', 'Wiring and connector repair', 'Alternator and starter check', 'Battery replacement with charging system check'],
    priceFrom: 500,
    photo: 'service-electrics',
    icon: 'bolt',
  },
  {
    id: 'tires',
    title: 'Tire service',
    short: 'Seasonal changeover, balancing and puncture repair, including low-profile tires.',
    duration: '40–60 minutes',
    details:
      'We work with wheels up to 22 inches and Run Flat tires. Wheel bolts are tightened with a torque wrench to the manufacturer’s specification.',
    includes: ['Seasonal wheel changeover', 'Balancing', 'Puncture repair', 'Tire pressure and tread wear check'],
    priceFrom: 600,
    photo: 'service-tires',
    icon: 'tire',
  },
  {
    id: 'alignment',
    title: 'Wheel alignment',
    short: 'Wheel angle measurement and adjustment on a 3D rig with a printed report.',
    duration: 'about 1 hour',
    details:
      'Before adjusting, we check tire pressure and suspension play — otherwise the result won’t last. You get a before-and-after printout.',
    includes: ['Suspension check before alignment', 'Toe and camber adjustment', 'Steering wheel centering', 'Before-and-after measurement report'],
    priceFrom: 800,
    photo: 'service-alignment',
    icon: 'align',
  },
  {
    id: 'maintenance',
    title: 'Full maintenance service',
    short: 'Scheduled service to the manufacturer’s plan with a 40-point inspection.',
    duration: '2–4 hours',
    details:
      'We carry out the work listed in your service book and inspect the car using a 40-point checklist. Anything that needs attention is photographed and agreed with you — no unnecessary extras.',
    includes: ['Work according to the mileage schedule', '40-point checklist inspection', 'Photo report on component condition', 'Recommendations for the next visit'],
    priceFrom: 1800,
    photo: 'service-maintenance',
    icon: 'check',
  },
];

export const serviceById = (id: string): Service | undefined => SERVICES.find((s) => s.id === id);

/* ---------------------------------------------------------- Advantages */

export type AdvantageIcon = 'team' | 'scan' | 'receipt' | 'shield' | 'person' | 'calendar';

export const ADVANTAGES: { title: string; text: string; icon: AdvantageIcon }[] = [
  { title: 'Experienced technicians', text: 'Each technician is responsible for their own area: engine, suspension, electrics.', icon: 'team' },
  { title: 'Modern equipment', text: 'Dealer-level scanners, a 3D alignment rig and a lift in every bay.', icon: 'scan' },
  { title: 'Transparent pricing', text: 'An estimate before work starts. Extra work only with your approval.', icon: 'receipt' },
  { title: 'Warranty on work', text: 'Warranty terms are recorded in the work order together with the list of work done.', icon: 'shield' },
  { title: 'Individual approach', text: 'We consider your budget and plans for the car and offer options, not a single answer.', icon: 'person' },
  { title: 'Deadlines kept', text: 'We give a time estimate after diagnostics and let you know in advance if it changes.', icon: 'calendar' },
];

/** Характеристики вымышленного сервиса (демо-данные, а не достижения реальной компании) */
export const FACTS: { value: number; suffix?: string; label: string }[] = [
  { value: 6, label: 'service bays with lifts' },
  { value: 12, label: 'months of warranty on completed work' },
  { value: 10, label: 'service areas' },
  { value: 6, label: 'days a week we accept cars' },
];

/* --------------------------------------------------------------- Our work */

export const WORK_CATEGORIES = ['Diagnostics', 'Engine repair', 'Suspension', 'Detailing', 'Maintenance'] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

export interface Work {
  id: string;
  title: string;
  category: WorkCategory;
  short: string;
  task: string;
  done: string[];
  result: string;
  duration: string;
  photo: PhotoKey;
}

export const WORKS: Work[] = [
  {
    id: 'scan',
    title: 'Tracking down an intermittent engine fault',
    category: 'Diagnostics',
    short: 'The Check Engine light came on once a week — we found a crack in the intake hose.',
    task: 'A fuel mixture code kept appearing and disappearing, and the engine occasionally misfired at idle.',
    done: ['Logging sensor data on a test drive', 'Smoke test to find the air leak', 'Intake hose replacement'],
    result: 'The fault hasn’t returned and the idle is smooth.',
    duration: '1 day',
    photo: 'work-scan',
  },
  {
    id: 'noise',
    title: 'Pre-purchase inspection',
    category: 'Diagnostics',
    short: 'A full check of an SUV before purchase: electronics, suspension, signs of past repairs.',
    task: 'The client was choosing a used car and wanted to know its real condition before buying.',
    done: ['Scan of all control units', 'Inspection on the lift', 'Paint thickness measurement'],
    result: 'The client received a report with photos and a list of upcoming expenses.',
    duration: '2 hours',
    photo: 'work-noise',
  },
  {
    id: 'camshaft',
    title: 'Cylinder head repair',
    category: 'Engine repair',
    short: 'Ticking on a cold start — we replaced worn hydraulic lifters and rocker arms.',
    task: 'A metallic ticking from the top of the engine after start-up.',
    done: ['Valve cover removal', 'Hydraulic lifter and rocker arm replacement', 'Gasket and oil replacement'],
    result: 'The engine runs quietly both cold and warm.',
    duration: '2 days',
    photo: 'work-camshaft',
  },
  {
    id: 'timing',
    title: 'Timing chain replacement',
    category: 'Engine repair',
    short: 'A stretched chain caused a timing fault — we replaced the kit with the tensioner.',
    task: 'A camshaft timing correlation fault and chain noise on start-up.',
    done: ['Timing check with a scanner', 'Chain, guide and tensioner replacement', 'Timing adaptation after assembly'],
    result: 'The fault is gone and the start-up noise has stopped.',
    duration: '2 days',
    photo: 'work-timing',
  },
  {
    id: 'chassis',
    title: 'Front suspension restoration',
    category: 'Suspension',
    short: 'Knocking over bumps — control arms and stabilizer links replaced, then aligned.',
    task: 'Knocking from the front over bumps and the car pulling to the right.',
    done: ['Inspection with a play detector', 'Control arm and stabilizer link replacement', 'Wheel alignment on a 3D rig'],
    result: 'The knocking is gone and the car drives straight.',
    duration: '6 hours',
    photo: 'work-chassis',
  },
  {
    id: 'caliper',
    title: 'Brake service',
    category: 'Suspension',
    short: 'Uneven pad wear — we restored free movement of the caliper guide pins.',
    task: 'Squealing when braking and uneven wear between inner and outer pads.',
    done: ['Disc thickness measurement', 'Guide pin cleaning and lubrication', 'Pad and brake fluid replacement'],
    result: 'The squeal is gone and the pads sit evenly.',
    duration: '2 hours',
    photo: 'work-caliper',
  },
  {
    id: 'polish',
    title: 'Paint correction polishing',
    category: 'Detailing',
    short: 'We removed holograms and fine scratches left by an automatic car wash.',
    task: 'The paint had lost its depth, with a web of fine scratches visible in the sun.',
    done: ['Two-bucket wash and clay bar treatment', 'Two-stage machine polishing', 'Protective coating application'],
    result: 'Color depth restored; scratches are invisible in daylight.',
    duration: '2 days',
    photo: 'work-polish',
  },
  {
    id: 'wash',
    title: 'Detailing wash before sale',
    category: 'Detailing',
    short: 'Body, wheel and engine bay cleaning before photos for a sale listing.',
    task: 'Get the car ready for sale: a clean body, interior and engine bay.',
    done: ['Touchless wash with snow foam', 'Wheel and wheel arch cleaning', 'Interior deep cleaning'],
    result: 'The car is ready for photos and viewings.',
    duration: '1 day',
    photo: 'work-wash',
  },
  {
    id: 'oil',
    title: '60,000 km scheduled service',
    category: 'Maintenance',
    short: 'Oil, all filters, spark plugs and a 40-point checklist inspection.',
    task: 'Scheduled maintenance according to the service book.',
    done: ['Oil and filter change', 'Spark plug replacement', 'Checklist inspection with a photo report'],
    result: 'The work was added to the service history and recommendations were passed to the client.',
    duration: '3 hours',
    photo: 'work-oil',
  },
  {
    id: 'service',
    title: 'Winter preparation',
    category: 'Maintenance',
    short: 'Battery, coolant and accessory belt check.',
    task: 'Prepare the car for cold weather before a long trip.',
    done: ['Battery load test', 'Coolant freeze point measurement', 'Drive belt replacement'],
    result: 'The car is ready for winter with no weak spots left.',
    duration: '2 hours',
    photo: 'work-service',
  },
];

/* -------------------------------------------------------------- Процесс */

export const STEPS: { title: string; text: string }[] = [
  { title: 'You send a request', text: 'Online or by phone, with a description of the job.' },
  { title: 'We clarify the details', text: 'We call you back, ask questions and find a time.' },
  { title: 'We run diagnostics', text: 'We find the cause and record the condition of components.' },
  { title: 'We agree on the estimate', text: 'We give you the price and timing before work starts.' },
  { title: 'We do the repair', text: 'Only the agreed work, with a photo report.' },
  { title: 'We hand over the car', text: 'We show you the result and give you the work order.' },
];

/* ------------------------------------------------------------------- Reviews */

export interface Review {
  id: string;
  author: string;
  car: string;
  rating: number;
  date: string;
  text: string;
}

/**
 * Настоящие отзывы: подключите источник (Google Business, CRM) и верните массив сюда.
 * Пока он пуст, сайт показывает примеры ниже — с явной пометкой «Sample review».
 */
export const REVIEWS: Review[] = [];

/** Примеры оформления. НЕ настоящие отзывы клиентов. */
export const DEMO_REVIEWS: Review[] = [
  { id: 'd1', author: 'Andriy K.', car: 'Volkswagen Passat', rating: 5, date: '2026-09-14', text: 'Sample review: before the repair they showed me the worn parts on the lift and gave me the price right away. The final bill matched the estimate.' },
  { id: 'd2', author: 'Olha M.', car: 'Toyota RAV4', rating: 5, date: '2026-08-30', text: 'Sample review: I booked a service on the website and got a call back within 15 minutes. The car was ready at the agreed time, with a photo report.' },
  { id: 'd3', author: 'Ihor S.', car: 'BMW 320d', rating: 4, date: '2026-08-02', text: 'Sample review: finding the cause of the fault took a while, but they warned me about the timing in advance. The fault hasn’t come back.' },
  { id: 'd4', author: 'Maryna L.', car: 'Skoda Octavia', rating: 5, date: '2026-07-19', text: 'Sample review: I liked that they offered two repair options — original and a quality aftermarket part — and explained the difference.' },
  { id: 'd5', author: 'Serhiy V.', car: 'Mercedes-Benz E-Class', rating: 5, date: '2026-06-27', text: 'Sample review: they did a wheel alignment and gave me a before-and-after printout. The steering wheel is finally straight.' },
  { id: 'd6', author: 'Denys P.', car: 'Hyundai Tucson', rating: 5, date: '2026-06-05', text: 'Sample review: they replaced the clutch in two days, as promised. I could work quietly in the waiting area.' },
];

/* ---------------------------------------------------------------------- FAQ */

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I book a service?',
    a: 'Submit a request through the form on the website or give us a call. Our service advisor will call back, clarify the details and confirm the time.',
  },
  {
    q: 'Can I bring my own parts?',
    a: 'Yes, if the parts are agreed in advance. In that case the warranty covers the work but not the part itself.',
  },
  {
    q: 'How is the final price determined?',
    a: 'After diagnostics, the technician prepares an estimate: work, parts and timing. Repairs start only after your approval.',
  },
  {
    q: 'What if another fault is found during the repair?',
    a: 'The technician will stop work on that component, tell you about the finding with photos and give you the price. Extra work is done only after your approval.',
  },
];

/* --------------------------------------------------------------- Время записи */

export const todayLocalISO = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Возвращает часы работы на дату (YYYY-MM-DD) или null, если сервис не работает */
export function hoursForDate(iso: string): { open: number; close: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  const wd = date.getDay();
  const row = CONTACTS.hours.find((h) => (h.weekdays as readonly number[]).includes(wd));
  if (!row || row.open === 0) return null;
  return { open: row.open, close: row.close };
}

/** Слоты записи — каждый час, последний начинается за час до закрытия */
export function timeSlotsForDate(iso: string): string[] {
  const h = hoursForDate(iso);
  if (!h) return [];
  const slots: string[] = [];
  for (let hour = h.open; hour < h.close; hour += 1) slots.push(`${String(hour).padStart(2, '0')}:00`);
  return slots;
}

/** Открыт ли сервис сейчас (по киевскому времени) — для подсказки в контактах */
export function openNow(now = new Date()): { open: boolean; text: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wdName = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wdName);
  const row = CONTACTS.hours.find((h) => (h.weekdays as readonly number[]).includes(wd));
  const t = hour + minute / 60;
  if (row && row.open > 0 && t >= row.open && t < row.close) {
    return { open: true, text: `Open now — until ${String(row.close).padStart(2, '0')}:00` };
  }
  return { open: false, text: 'Closed now — leave a request and we’ll call you back' };
}
