import path from 'node:path';
import { createApp } from './app.ts';
import { ROOT, isLoopbackHost, loadConfig, loadEnvFile } from './config.ts';

loadEnvFile(path.join(ROOT, '.env'));
const config = loadConfig();

// Если сервер доступен не только с этого компьютера, обязательно нужен пароль.
if (!isLoopbackHost(config.host) && !config.adminToken) {
  console.error('Ошибка: HOST открывает сервер для других компьютеров, но ADMIN_TOKEN не задан. Задайте ADMIN_TOKEN в файле .env или верните HOST=127.0.0.1.');
  process.exit(1);
}

const app = createApp(config);

app.server.listen(config.port, config.host, () => {
  console.log('');
  console.log('  EXAMPLE Auto Service + Web Inspiration Analyzer');
  console.log(`  API и собранный сайт:  http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log('  Режим разработки:      http://127.0.0.1:5173  (npm run dev)');
  console.log(`  Панель анализатора:    http://127.0.0.1:5173/#/analyzer`);
  console.log('');
});

const shutdown = () => {
  console.log('Останавливаю сервер…');
  void app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
