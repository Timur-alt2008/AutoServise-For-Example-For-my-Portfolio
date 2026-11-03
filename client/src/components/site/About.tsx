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
            alt="Black sports car in a service bay"
            ratio={0.78}
            max={1600}
            sizes="(min-width: 1080px) 40vw, 100vw"
            className="about__photo"
          />
          <p className="about__caption">Every car is checked in with photos of its condition.</p>
        </Reveal>

        <div className="about__copy">
          <Reveal className="shead shead--left">
            <h2 id="about-title" className="shead__title">Why choose us</h2>
            <p className="shead__lead">
              We don’t replace parts "just in case". First we find the cause, then explain what needs to be done, and only then pick up the tools.
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
          <p className="facts__note">Figures of a fictional demo company, not data of a real business.</p>
        </div>
      </div>
    </section>
  );
}
