import type { ComponentType } from 'react';
import { ADVANTAGES, FACTS } from '../../data/site';
import type { AdvantageIcon } from '../../data/site';
import { useCountUp, useReveal } from '../../lib/hooks';
import { IconCalendar, IconPerson, IconReceipt, IconScan, IconShield, IconTeam } from '../Icons';
import { Photo } from '../Photo';
import { Reveal } from './Reveal';

const ICONS: Record<AdvantageIcon, ComponentType<{ size?: number }>> = {
  team: IconTeam,
  scan: IconScan,
  receipt: IconReceipt,
  shield: IconShield,
  person: IconPerson,
  calendar: IconCalendar,
};

function Fact({ value, suffix, label, run }: { value: number; suffix?: string; label: string; run: boolean }) {
  const n = useCountUp(value, run);
  return (
    <li className="fact">
      <span className="fact__value">
        {/* скринридеру — сразу итоговое число, без «бегущих» промежуточных значений */}
        <span aria-hidden="true">{n}{suffix}</span>
        <span className="sr-only">{value}{suffix}</span>
      </span>
      <span className="fact__label">{label}</span>
    </li>
  );
}

export function About() {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <section id="about" className="section section--raised" aria-labelledby="about-title">
      <div className="container about">
        <Reveal className="about__media">
          <Photo
            name="about"
            alt="Чёрный спортивный автомобиль в сервисном боксе"
            ratio={0.78}
            max={1600}
            sizes="(min-width: 1080px) 40vw, 100vw"
            className="about__photo"
          />
          <p className="about__caption">Каждый автомобиль проходит приёмку с фотофиксацией состояния.</p>
        </Reveal>

        <div className="about__copy">
          <Reveal className="shead shead--left">
            <h2 id="about-title" className="shead__title">Почему выбирают нас</h2>
            <p className="shead__lead">
              Мы не меняем детали «на всякий случай». Сначала находим причину, затем объясняем, что нужно сделать, и только потом берёмся за ключи.
            </p>
          </Reveal>

          <ul className="adv">
            {ADVANTAGES.map((a, i) => {
              const Icon = ICONS[a.icon];
              return (
                <Reveal as="li" key={a.title} className="adv__item" delay={(i % 2) * 80}>
                  <span className="adv__icon"><Icon size={26} /></span>
                  <h3 className="adv__title">{a.title}</h3>
                  <p className="adv__text">{a.text}</p>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="container">
        <div ref={ref} className="facts-wrap">
          <ul className="facts">
            {FACTS.map((f) => (
              <Fact key={f.label} {...f} run={visible} />
            ))}
          </ul>
          <p className="facts__note">Характеристики демонстрационной компании, а не данные реального сервиса.</p>
        </div>
      </div>
    </section>
  );
}
