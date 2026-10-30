import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { CONTACTS, SERVICES, serviceById, timeSlotsForDate, todayLocalISO } from '../../data/site';
import { useBookingPrefill } from '../../lib/bookingStore';
import {
  EMPTY_BOOKING,
  IS_DEMO_MODE,
  MAX_PROBLEM,
  firstInvalid,
  maxDateISO,
  submitBooking,
  validateAll,
  validateField,
} from '../../lib/booking';
import type { BookingErrors, BookingValues } from '../../lib/booking';
import { IconAlert, IconCheck, IconInfo, IconPhone } from '../Icons';
import { Reveal } from './Reveal';

const MAKES = [
  'Audi', 'BMW', 'Chevrolet', 'Citroën', 'Daewoo', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Lada (ВАЗ)', 'Mazda',
  'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Renault', 'Skoda', 'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo', 'ЗАЗ',
];

const OTHER_SERVICE = 'other';

type Status = 'idle' | 'sending' | 'demo' | 'sent' | 'error';

function Field({
  id,
  label,
  error,
  optional,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__opt"> — необязательно</span>}
      </label>
      {children}
      {hint && !error && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          <IconAlert size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export function Booking() {
  const prefill = useBookingPrefill();
  const [values, setValues] = useState<BookingValues>(EMPTY_BOOKING);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [flash, setFlash] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastNonce = useRef(0);

  // Кнопки «Запросить стоимость/диагностику» подставляют услугу и описание
  useEffect(() => {
    if (prefill.nonce === 0 || prefill.nonce === lastNonce.current) return;
    lastNonce.current = prefill.nonce;
    setValues((v) => ({
      ...v,
      service: prefill.service ?? v.service,
      problem: prefill.problem !== undefined && prefill.problem !== '' ? prefill.problem : v.problem,
    }));
    setErrors((e) => ({ ...e, service: undefined, problem: undefined }));
    setStatus((s) => (s === 'demo' || s === 'sent' || s === 'error' ? 'idle' : s));
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1600);
    return () => window.clearTimeout(t);
  }, [prefill]);

  const today = todayLocalISO();
  const slots = useMemo(() => timeSlotsForDate(values.date), [values.date]);

  const set = (field: keyof BookingValues) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'date') {
        // время зависит от дня недели — сбрасываем, если оно больше не подходит
        const nextSlots = timeSlotsForDate(value);
        if (!nextSlots.includes(next.time)) next.time = '';
      }
      return next;
    });
    setStatus((s) => (s === 'demo' || s === 'error' ? 'idle' : s));
    if (errors[field] || (field === 'date' && errors.time)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (field === 'date') delete next.time;
        return next;
      });
    }
  };

  const blur = (field: keyof BookingValues) => () => {
    const msg = validateField(field, values);
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;
    const honeypot = (new FormData(e.currentTarget).get('website') as string | null) ?? '';
    if (honeypot) return; // бот заполнил скрытое поле — тихо игнорируем

    const found = validateAll(values);
    setErrors(found);
    const bad = firstInvalid(found);
    if (bad) {
      setStatus('idle');
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${bad}"]`);
      el?.focus();
      return;
    }

    setStatus('sending');
    const res = await submitBooking(values);
    if (res.ok) {
      setStatus('sent');
      setValues(EMPTY_BOOKING);
      return;
    }
    if (IS_DEMO_MODE) {
      // Демо-режим: данные проверены, но НЕ отправлены — говорим об этом прямо
      setStatus('demo');
      return;
    }
    if (res.fields) setErrors(res.fields);
    setServerMessage(res.message);
    setStatus('error');
  };

  const pickedService = values.service && values.service !== OTHER_SERVICE ? serviceById(values.service) : undefined;

  return (
    <section id="booking" className="section section--raised section--booking" aria-labelledby="booking-title">
      <div className="container booking">
        <Reveal className="booking__intro">
          <h2 id="booking-title" className="shead__title">Запись на сервис</h2>
          <p className="shead__lead">
            Расскажите об автомобиле и задаче, выберите удобное время. Администратор перезвонит, уточнит детали и подтвердит запись.
          </p>
          <ul className="booking__points">
            <li><IconCheck size={18} /> Время только в часы работы сервиса</li>
            <li><IconCheck size={18} /> Работы и стоимость согласуются до ремонта</li>
            <li><IconCheck size={18} /> Не знаете, какая услуга нужна — опишите симптомы в комментарии</li>
          </ul>
          <p className="booking__call">
            Предпочитаете звонок? <a href={CONTACTS.phoneHref}><IconPhone size={16} /> {CONTACTS.phoneDisplay}</a>
          </p>
        </Reveal>

        <Reveal className="booking__card" delay={80}>
          {IS_DEMO_MODE && status !== 'sent' && (
            <div className="notice notice--demo" role="note">
              <IconInfo size={22} />
              <p>
                <strong>Демонстрационный режим.</strong> Форма проверяет поля, но заявки пока никуда не отправляются: серверная часть не подключена.
              </p>
            </div>
          )}

          {status === 'sent' ? (
            <div className="success" role="status">
              <span className="success__icon"><IconCheck size={28} /></span>
              <h3 className="success__title">Заявка отправлена</h3>
              <p>Спасибо! Администратор свяжется с вами по указанному телефону, чтобы подтвердить запись.</p>
              <button type="button" className="sbtn sbtn--line sbtn--sm" onClick={() => setStatus('idle')}>Оформить ещё одну</button>
            </div>
          ) : (
            <form ref={formRef} className={`form${flash ? ' is-flash' : ''}`} onSubmit={onSubmit} noValidate aria-describedby="form-status">
              <div className="form__grid">
                <Field id="f-name" label="Имя" error={errors.name}>
                  <input id="f-name" name="name" type="text" autoComplete="name" value={values.name} onChange={set('name')} onBlur={blur('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'f-name-error' : undefined} maxLength={80} />
                </Field>
                <Field id="f-phone" label="Телефон" error={errors.phone} hint="Например, +380 67 000 00 00">
                  <input id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} onBlur={blur('phone')} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'f-phone-error' : 'f-phone-hint'} maxLength={30} />
                </Field>
                <Field id="f-make" label="Марка автомобиля" error={errors.make}>
                  <input id="f-make" name="make" type="text" list="makes" autoComplete="off" value={values.make} onChange={set('make')} onBlur={blur('make')} aria-invalid={Boolean(errors.make)} aria-describedby={errors.make ? 'f-make-error' : undefined} maxLength={40} />
                  <datalist id="makes">
                    {MAKES.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </Field>
                <Field id="f-model" label="Модель автомобиля" error={errors.model}>
                  <input id="f-model" name="model" type="text" autoComplete="off" value={values.model} onChange={set('model')} onBlur={blur('model')} aria-invalid={Boolean(errors.model)} aria-describedby={errors.model ? 'f-model-error' : undefined} maxLength={40} />
                </Field>
                <Field id="f-year" label="Год выпуска" optional error={errors.year}>
                  <input id="f-year" name="year" type="text" inputMode="numeric" autoComplete="off" placeholder="2015" value={values.year} onChange={set('year')} onBlur={blur('year')} aria-invalid={Boolean(errors.year)} aria-describedby={errors.year ? 'f-year-error' : undefined} maxLength={4} />
                </Field>
                <Field id="f-service" label="Услуга" error={errors.service}>
                  <select id="f-service" name="service" value={values.service} onChange={set('service')} onBlur={blur('service')} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? 'f-service-error' : undefined}>
                    <option value="">Выберите услугу</option>
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                    <option value={OTHER_SERVICE}>Не знаю, какая услуга нужна</option>
                  </select>
                </Field>
                <div className="form__wide">
                  <Field id="f-problem" label="Комментарий" optional error={errors.problem} hint={pickedService ? `Выбрано: ${pickedService.title}. Опишите, что вас беспокоит.` : 'Что происходит с автомобилем и когда это появилось'}>
                    <textarea id="f-problem" name="problem" rows={4} value={values.problem} onChange={set('problem')} onBlur={blur('problem')} aria-invalid={Boolean(errors.problem)} aria-describedby={errors.problem ? 'f-problem-error' : 'f-problem-hint'} />
                    <p className={`field__count${values.problem.length > MAX_PROBLEM ? ' is-over' : ''}`}>{values.problem.length} / {MAX_PROBLEM}</p>
                  </Field>
                </div>
                <Field id="f-date" label="Желаемая дата" error={errors.date}>
                  <input id="f-date" name="date" type="date" min={today} max={maxDateISO()} value={values.date} onChange={set('date')} onBlur={blur('date')} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'f-date-error' : undefined} />
                </Field>
                <Field id="f-time" label="Желаемое время" error={errors.time}>
                  <select id="f-time" name="time" value={values.time} onChange={set('time')} onBlur={blur('time')} disabled={!values.date || slots.length === 0} aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? 'f-time-error' : undefined}>
                    <option value="">{!values.date ? 'Сначала выберите дату' : slots.length === 0 ? 'В этот день выходной' : 'Выберите время'}</option>
                    {slots.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Скрытое поле-ловушка для ботов: люди его не видят и не заполняют */}
              <div className="hp" aria-hidden="true">
                <label>
                  Не заполняйте это поле
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div id="form-status" aria-live="polite" className="form__status">
                {status === 'demo' && (
                  <div className="notice notice--result" role="status">
                    <IconInfo size={22} />
                    <div>
                      <p><strong>Поля заполнены верно, но это демонстрационный режим.</strong></p>
                      <p>Заявка никуда не отправлена и данные не сохранялись. Чтобы форма начала отправлять заявки, подключите серверную часть (см. README).</p>
                    </div>
                  </div>
                )}
                {status === 'error' && (
                  <div className="notice notice--error" role="alert">
                    <IconAlert size={22} />
                    <p>{serverMessage}</p>
                  </div>
                )}
                {Object.keys(errors).length > 0 && status === 'idle' && (
                  <p className="form__summary">Проверьте отмеченные поля — они подсвечены красным.</p>
                )}
              </div>

              <button
                type="submit"
                className="sbtn sbtn--accent sbtn--lg form__submit"
                disabled={status === 'sending'}
                aria-busy={status === 'sending'}
                // Не даём полю потерять фокус при нажатии: иначе проверка на blur покажет ошибку,
                // макет сдвинется, кнопка уедет из-под курсора и клик потеряется.
                onMouseDown={(e) => e.preventDefault()}
              >
                {status === 'sending' ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Отправляем…
                  </>
                ) : IS_DEMO_MODE ? (
                  'Проверить заявку (демо)'
                ) : (
                  'Отправить заявку'
                )}
              </button>
              <p className="form__fine">Нажимая кнопку, вы соглашаетесь на обработку данных для связи по записи.</p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
