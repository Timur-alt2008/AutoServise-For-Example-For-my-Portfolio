import { useSyncExternalStore } from 'react';

/**
 * Небольшое общее хранилище: кнопки «Запросить стоимость» и «Запросить диагностику»
 * выбирают услугу и подставляют описание в форму записи, затем прокручивают страницу к форме.
 */
export interface BookingPrefill {
  service?: string;
  problem?: string;
  nonce: number;
}

let state: BookingPrefill = { nonce: 0 };
const listeners = new Set<() => void>();

export function requestBooking(prefill: { service?: string; problem?: string } = {}) {
  state = { ...prefill, nonce: state.nonce + 1 };
  listeners.forEach((l) => l());
  const form = document.getElementById('booking');
  if (form) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

export function useBookingPrefill(): BookingPrefill {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
