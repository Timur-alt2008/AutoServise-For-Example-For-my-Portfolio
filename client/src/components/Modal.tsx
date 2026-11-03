import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion, useBodyLock } from '../lib/hooks';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  onPrev?: () => void;
  onNext?: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EXIT_MS = 220;

/**
 * Доступное модальное окно: Esc, возврат фокуса, ловушка Tab, блокировка прокрутки страницы.
 * Открывается и закрывается с короткой анимацией (без неё при prefers-reduced-motion).
 */
export function Modal({ open, onClose, labelledBy, children, className = '', onPrev, onNext }: Props) {
  const panel = useRef<HTMLDivElement | null>(null);
  const handlers = useRef({ onClose, onPrev, onNext });
  handlers.current = { onClose, onPrev, onNext };
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // во время закрытия показываем последнее содержимое, пока окно растворяется
  const lastChildren = useRef(children);
  if (open) lastChildren.current = children;
  useBodyLock(mounted);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.current.onClose();
      } else if (e.key === 'ArrowLeft' && handlers.current.onPrev) {
        handlers.current.onPrev();
      } else if (e.key === 'ArrowRight' && handlers.current.onNext) {
        handlers.current.onNext();
      } else if (e.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={`smodal${closing ? ' is-closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panel} className={`smodal__panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        <button type="button" className="smodal__close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
        {open ? children : lastChildren.current}
      </div>
    </div>,
    document.body,
  );
}
