import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useReveal } from '../../lib/hooks';

interface Props {
  as?: ElementType;
  className?: string;
  delay?: number;
  children?: ReactNode;
  id?: string;
}

/** Обёртка: блок мягко появляется при прокрутке (отключается при prefers-reduced-motion) */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, id }: Props) {
  const { ref, visible } = useReveal<HTMLElement>();
  const style = delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined;
  return (
    <Tag ref={ref} id={id} className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
