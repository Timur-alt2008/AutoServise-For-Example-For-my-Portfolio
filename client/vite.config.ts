import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
// .env лежит в корне проекта
const envDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Пустой префикс ('') — читаем и PORT из .env, чтобы прокси знал, где сервер анализатора.
  // В браузер эти значения НЕ попадают: туда идут только переменные с префиксом VITE_.
  const fileEnv = loadEnv(mode, envDir, '');
  const apiPort = process.env.PORT ?? fileEnv.PORT ?? '8787';
  const proxy = { '/api': `http://127.0.0.1:${apiPort}` };

  return {
    root,
    envDir,
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, proxy },
    preview: { host: '127.0.0.1', port: 4173, proxy },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
  };
});
