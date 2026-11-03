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
      return v.name.trim().length < 2 ? 'Enter your name (at least two letters)' : undefined;
    case 'phone': {
      const raw = v.phone.trim();
      const digits = raw.replace(/\D/g, '');
      if (!raw) return 'Enter a phone number we can call';
      if (!/^[+\d\s()-]+$/.test(raw) || digits.length < 9 || digits.length > 15) return 'Enter the phone number in the format +380 67 000 00 00';
      return undefined;
    }
    case 'make':
      return v.make.trim() ? undefined : 'Enter the car make';
    case 'model':
      return v.model.trim() ? undefined : 'Enter the car model';
    case 'year': {
      if (!v.year.trim()) return undefined; // необязательное поле
      const y = Number(v.year);
      if (!/^\d{4}$/.test(v.year.trim()) || y < 1950 || y > now.getFullYear() + 1) return 'Year must be four digits, e.g. 2015';
      return undefined;
    }
    case 'service':
      return v.service ? undefined : 'Choose a service or "Not sure which service I need"';
    case 'problem':
      return v.problem.length > MAX_PROBLEM ? `No more than ${MAX_PROBLEM} characters` : undefined;
    case 'date': {
      if (!v.date) return 'Choose a preferred date';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date);
      if (!m) return 'Choose a date from the calendar';
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (Number.isNaN(d.getTime()) || d < today) return 'The date can’t be in the past';
      if (v.date > maxDateISO(now)) return 'Choose a date within the next six months';
      if (!hoursForDate(v.date)) return 'We’re closed on Sundays — please choose another day';
      return undefined;
    }
    case 'time': {
      if (!v.time) return 'Choose a preferred time';
      const slots = timeSlotsForDate(v.date);
      if (v.date && slots.length > 0 && !slots.includes(v.time)) return 'We’re not open at this time on that day';
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
    let message = 'Couldn’t send the request. Please try again later or call us.';
    let fields: BookingErrors | undefined;
    try {
      const data = (await res.json()) as { error?: { message?: string; fields?: BookingErrors } };
      if (data.error?.message) message = data.error.message;
      fields = data.error?.fields;
    } catch {
      /* тело ответа не JSON — оставляем общее сообщение */
    }
    if (res.status === 501) message = 'Online booking isn’t set up on the server yet. For now, please call us.';
    return { ok: false, message, fields };
  } catch {
    return { ok: false, message: 'No connection to the server. Check your internet connection or call us.' };
  }
}
