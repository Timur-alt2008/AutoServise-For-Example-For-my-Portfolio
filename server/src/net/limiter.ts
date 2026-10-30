const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ограничитель частоты: запросы к одному сайту выполняются строго по очереди
 * и не чаще, чем раз в `intervalMs`. Разные сайты друг другу не мешают.
 */
export class HostLimiter {
  private tails = new Map<string, Promise<unknown>>();
  private lastStart = new Map<string, number>();
  /** Сколько раз пришлось подождать — используется в тестах и на дашборде. */
  throttled = 0;
  totalWaitMs = 0;

  async run<T>(host: string, intervalMs: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(host) ?? Promise.resolve();
    const task = prev
      .catch(() => undefined)
      .then(async () => {
        const last = this.lastStart.get(host) ?? 0;
        const wait = Math.max(0, last + intervalMs - Date.now());
        if (wait > 0) {
          this.throttled += 1;
          this.totalWaitMs += wait;
          await sleep(wait);
        }
        this.lastStart.set(host, Date.now());
        return fn();
      });
    this.tails.set(
      host,
      task.catch(() => undefined),
    );
    return task;
  }
}

/** Простой ограничитель «N событий за окно» (для публичных POST, например заявок). */
export class WindowCounter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Возвращает true, если событие разрешено. */
  allow(key: string, now = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
}
