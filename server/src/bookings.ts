import type { Config } from './config.ts';
import { AnalyzerError } from './errors.ts';

/**
 * Заявки с демонстрационного сайта.
 * По умолчанию канал отправки НЕ настроен — сервер честно отвечает 501, а сайт показывает
 * демонстрационное уведомление. Чтобы заявки уходили в Telegram, задайте в .env
 * BOOKING_TELEGRAM_BOT_TOKEN и BOOKING_TELEGRAM_CHAT_ID.
 */

export interface BookingInput {
  name: string;
  phone: string;
  make: string;
  model: string;
  year: string;
  service: string;
  problem: string;
  date: string;
  time: string;
}

export function isBookingConfigured(config: Config): boolean {
  return config.telegramToken.length > 0 && config.telegramChatId.length > 0;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function validateBooking(body: unknown, now = new Date()): { value?: BookingInput; errors: Record<string, string> } {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const v: BookingInput = {
    name: str(b.name, 80),
    phone: str(b.phone, 30),
    make: str(b.make, 40),
    model: str(b.model, 40),
    year: str(b.year, 4),
    service: str(b.service, 80),
    problem: str(b.problem, 1000),
    date: str(b.date, 10),
    time: str(b.time, 5),
  };
  const errors: Record<string, string> = {};

  if (v.name.length < 2) errors.name = 'Укажите имя (не короче двух букв)';
  const digits = v.phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15 || !/^[+\d\s()-]+$/.test(v.phone)) errors.phone = 'Введите телефон в формате +380 00 123 45 67';
  if (!v.make) errors.make = 'Укажите марку автомобиля';
  if (!v.model) errors.model = 'Укажите модель автомобиля';
  if (v.year) {
    const y = Number(v.year);
    if (!/^\d{4}$/.test(v.year) || y < 1950 || y > now.getFullYear() + 1) errors.year = 'Год выпуска — четыре цифры, например 2015';
  }
  if (!v.service) errors.service = 'Выберите услугу';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
    errors.date = 'Выберите дату';
  } else {
    const d = new Date(`${v.date}T00:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const max = new Date(today.getTime() + 180 * 86400000);
    if (Number.isNaN(d.getTime()) || d < today) errors.date = 'Дата не может быть в прошлом';
    else if (d > max) errors.date = 'Выберите дату в ближайшие полгода';
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) errors.time = 'Выберите время';

  return Object.keys(errors).length ? { errors } : { value: v, errors };
}

export async function deliverBooking(config: Config, v: BookingInput): Promise<void> {
  if (!isBookingConfigured(config)) {
    throw new AnalyzerError('booking_not_configured', 'Приём заявок не настроен: сайт работает в демонстрационном режиме');
  }
  const text = [
    'Новая заявка с сайта EXAMPLE Auto Service (демо)',
    `Имя: ${v.name}`,
    `Телефон: ${v.phone}`,
    `Автомобиль: ${v.make} ${v.model}${v.year ? `, ${v.year}` : ''}`,
    `Услуга: ${v.service}`,
    `Желаемое время: ${v.date} ${v.time}`,
    v.problem ? `Описание: ${v.problem}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let res: Response;
  try {
    res = await fetch(`${config.telegramUrl}/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text }),
    });
  } catch (e) {
    throw new AnalyzerError('network_error', `Не удалось отправить заявку: ${(e as Error).message}`);
  }
  if (!res.ok) throw new AnalyzerError('http_error', `Telegram ответил ошибкой HTTP ${res.status}`);
}
