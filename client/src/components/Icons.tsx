import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function base(size: number, props: Omit<IconProps, 'size'>, children: ReactNode, strokeWidth = 1.6) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ----------------------------------------------------------- Интерфейс */

export const IconPhone = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />);
export const IconArrow = ({ size = 18, ...p }: IconProps) => base(size, p, <path d="M5 12h14m-6-6 6 6-6 6" />);
export const IconArrowDown = ({ size = 18, ...p }: IconProps) => base(size, p, <path d="M12 5v14m-6-6 6 6 6-6" />);
export const IconClose = ({ size = 22, ...p }: IconProps) => base(size, p, <path d="M6 6l12 12M18 6 6 18" />);
export const IconMenu = ({ size = 24, ...p }: IconProps) => base(size, p, <path d="M4 8h16M4 16h16" />);
export const IconPlus = ({ size = 20, ...p }: IconProps) => base(size, p, <path d="M12 5v14M5 12h14" />);
export const IconCheck = ({ size = 18, ...p }: IconProps) => base(size, p, <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconChevronLeft = ({ size = 22, ...p }: IconProps) => base(size, p, <path d="m15 5-7 7 7 7" />);
export const IconChevronRight = ({ size = 22, ...p }: IconProps) => base(size, p, <path d="m9 5 7 7-7 7" />);
export const IconPin = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>);
export const IconMail = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>);
export const IconClock = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconInfo = ({ size = 18, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const IconAlert = ({ size = 18, ...p }: IconProps) =>
  base(size, p, <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v4M12 17h.01" /></>);
export const IconZoom = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5M11 8.5v5M8.5 11h5" /></>);
export const IconExternal = ({ size = 16, ...p }: IconProps) =>
  base(size, p, <path d="M14 4h6v6M20 4 10 14M18 14v5H5V6h5" />);
export const IconRoute = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></>);
export const IconStar = ({ size = 16, filled = true, ...p }: IconProps & { filled?: boolean }) =>
  base(size, { ...p, fill: filled ? 'currentColor' : 'none' }, <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z" />, 1.3);

/* ----------------------------------------------------------- Услуги */

export const IconScan = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 13h2.5l1.5-3 2 5 1.5-2H17" /></>);
export const IconEngine = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M7 8h7l2 2h2v3h2v-2h1v6h-1v-2h-2v3h-3l-2 2H8v-3H6v2H3v-7h3V8Z" /><path d="M9 5h4M11 5v3" /></>);
export const IconSuspension = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M8 3h8M8 21h8M12 3v3M12 18v3" /><path d="M8 7l8 2-8 2 8 2-8 2 8 2" /></>);
export const IconDrop = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></>);
export const IconBrake = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /><path d="M5.5 6.5A9 9 0 0 1 9 3.9M18.5 6.5A9 9 0 0 0 15 3.9" strokeWidth={3} /></>);
export const IconGear = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.5" /></>);
export const IconBolt = ({ size = 24, ...p }: IconProps) => base(size, p, <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />);
export const IconTire = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" /></>);
export const IconAlign = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><rect x="3" y="4" width="4" height="7" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /><rect x="3" y="13" width="4" height="7" rx="1" /><rect x="17" y="13" width="4" height="7" rx="1" /><path d="M7 7.5h10M7 16.5h10M12 6v12" /></>);
export const IconChecklist = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>);

/* ----------------------------------------------------------- Преимущества */

export const IconTeam = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.5a5.5 5.5 0 0 1 3 5.5" /></>);
export const IconReceipt = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M6 3h12v18l-2.5-1.5L13 21l-2-1.5L8.5 21 6 19.5V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>);
export const IconShield = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>);
export const IconPerson = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="m15.5 15.5 1.5 1.5 3-3" /></>);
export const IconCalendar = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9 15 2 2 4-4" /></>);
export const IconWrench = ({ size = 24, ...p }: IconProps) =>
  base(size, p, <path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-2 2-1.5-1.5-8 8a2.1 2.1 0 0 1-3-3l8-8L13 9l2-2 1.5 1.5-2-2Z" />);

/* ----------------------------------------------------------- Соцсети */

export const IconTelegram = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <path d="M21 4 3 11l6 2.2M21 4l-3 16-6.5-5.3M21 4 9 13.2m0 0V19l2.5-4.3" />);
export const IconViber = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><path d="M12 3c5.5 0 8.5 2 8.5 7.5S17.5 18 12 18c-.8 0-1.6 0-2.3-.2L6.5 21v-3.6C4.3 16.2 3.5 14 3.5 10.5 3.5 5 6.5 3 12 3Z" /><path d="M9.3 7.5c.5 2.9 2.3 4.8 5.2 5.4M12.5 6.6a3 3 0 0 1 2.4 2.4" /></>);
export const IconWhatsApp = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <><path d="M4 20.5 5.3 16A8.5 8.5 0 1 1 8.4 19l-4.4 1.5Z" /><path d="M9 8.5c.3 2.9 2.6 5.3 5.5 5.8l1.2-1.4-1.8-1-1 .8a4.3 4.3 0 0 1-2-2l.8-1-1-1.8L9 8.5Z" /></>);
export const IconFacebook = ({ size = 20, ...p }: IconProps) =>
  base(size, p, <path d="M14.5 8H17V4.5h-2.5A4 4 0 0 0 10.5 8.5V11H8v3.5h2.5V21H14v-6.5h2.6l.4-3.5h-3V9a1 1 0 0 1 .5-1Z" />);
