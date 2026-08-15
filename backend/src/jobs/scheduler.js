import cron from 'node-cron';
import { run as expiringSoon } from './expiringSoon.js';

export function startScheduler() {
  // 09:00 daily. Safe to re-run: the dedup key makes a repeat a no-op.
  cron.schedule('0 9 * * *', () => {
    expiringSoon().catch((err) => console.error('[expiringSoon]', err));
  });
}
