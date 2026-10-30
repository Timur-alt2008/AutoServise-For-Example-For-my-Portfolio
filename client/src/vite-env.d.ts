/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес для отправки заявок. Пусто — демонстрационный режим. */
  readonly VITE_BOOKING_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Шрифты подключаются только ради CSS; у пакетов нет описаний типов
declare module '@fontsource-variable/*';
