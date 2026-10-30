import { hoursForDate, timeSlotsForDate, todayLocalISO } from '../data/site';

/**
 * Отправка заявки. Транспорт подключается одной переменной VITE_BOOKING_ENDPOINT:
 *  - пусто      → демонстрационный режим: заявка НЕ отправляется, пользователь видит честное уведомление;
 *  - /api/bookings → заявка уходит на сервер проекта (см. server/src/bookings.ts → Telegram);
 *  - любой URL  → POST JSON на ваш backend / сервис форм.
 */
export const BOOKING_ENDPOINT: string = (import.meta.env.VITE_BOOKING_ENDPOINT ?? '').trim();
export const IS_DEMO_MODE = BOOKING_ENDPOINT === '';

export interface BookingValues {
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

export type BookingErrors = Partial<Record<keyof BookingValues, string>>;

export const EMPTY_BOOKING: BookingValues = {
  name: '',
  phone: '',
  make: '',
  model: '',
  year: '',
  service: '',
  problem: '',
  date: '',
  time: '',
};

export const MAX_PROBLEM = 1000;

export function maxDateISO(now = new Date()): string {
  return todayLocalISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 180));
}

export function validateField(field: keyof BookingValues, v: BookingValues, now = new Date()): string | undefined {
  switch (field) {
    case 'name':
      return v.name.trim().length < 2 ? 'Укажите имя — не короче двух букв' : undefined;
    case 'phone': {
      const raw = v.phone.trim();
      const digits = raw.replace(/\D/g, '');
      if (!raw) return 'Укажите телефон для связи';
      if (!/^[+\d\s()-]+$/.test(raw) || digits.length < 9 || digits.length > 15) return 'Введите телефон в формате +380 67 000 00 00';
      return undefined;
    }
    case 'make':
      return v.make.trim() ? undefined : 'Укажите марку автомобиля';
    case 'model':
      return v.model.trim() ? undefined : 'Укажите модель автомобиля';
    case 'year': {
      if (!v.year.trim()) return undefined; // необязательное поле
      const y = Number(v.year);
      if (!/^\d{4}$/.test(v.year.trim()) || y < 1950 || y > now.getFullYear() + 1) return 'Год выпуска — четыре цифры, например 2015';
      return undefined;
    }
    case 'service':
      return v.service ? undefined : 'Выберите услугу или «Не знаю, какая услуга нужна»';
    case 'problem':
      return v.problem.length > MAX_PROBLEM ? `Не больше ${MAX_PROBLEM} символов` : undefined;
    case 'date': {
      if (!v.date) return 'Выберите желаемую дату';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date);
      if (!m) return 'Выберите дату из календаря';
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (Number.isNaN(d.getTime()) || d < today) return 'Дата не может быть в прошлом';
      if (v.date > maxDateISO(now)) return 'Выберите дату в ближайшие полгода';
      if (!hoursForDate(v.date)) return 'В воскресенье сервис не работает — выберите другой день';
      return undefined;
    }
    case 'time': {
      if (!v.time) return 'Выберите желаемое время';
      const slots = timeSlotsForDate(v.date);
      if (v.date && slots.length > 0 && !slots.includes(v.time)) return 'В этот день сервис в это время не работает';
      return undefined;
    }
    default:
      return undefined;
  }
}

const FIELD_ORDER: (keyof BookingValues)[] = ['name', 'phone', 'make', 'model', 'year', 'service', 'problem', 'date', 'time'];

export function validateAll(v: BookingValues, now = new Date()): BookingErrors {
  const errors: BookingErrors = {};
  for (const f of FIELD_ORDER) {
    const e = validateField(f, v, now);
    if (e) errors[f] = e;
  }
  return errors;
}

export function firstInvalid(errors: BookingErrors): keyof BookingValues | undefined {
  return FIELD_ORDER.find((f) => errors[f]);
}

export type SubmitResult =
  | { ok: true; mode: 'sent' }
  | { ok: false; message: string; fields?: BookingErrors };

export async function submitBooking(values: BookingValues): Promise<SubmitResult> {
  if (IS_DEMO_MODE) {
    // Демо-режим: ничего не отправляем. Вызывающий код показывает уведомление.
    return { ok: false, message: 'demo' };
  }
  try {
    const res = await fetch(BOOKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) return { ok: true, mode: 'sent' };
    let message = 'Не удалось отправить заявку. Попробуйте позже или позвоните нам.';
    let fields: BookingErrors | undefined;
    try {
      const data = (await res.json()) as { error?: { message?: string; fields?: BookingErrors } };
      if (data.error?.message) message = data.error.message;
      fields = data.error?.fields;
    } catch {
      /* тело ответа не JSON — оставляем общее сообщение */
    }
    if (res.status === 501) message = 'Приём заявок на сервере не настроен. Пока вы можете позвонить нам.';
    return { ok: false, message, fields };
  } catch {
    return { ok: false, message: 'Нет связи с сервером. Проверьте интернет или позвоните нам.' };
  }
}
