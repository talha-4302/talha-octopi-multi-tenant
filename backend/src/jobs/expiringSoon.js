import { NOTIFICATION_KIND } from '../lib/constants.js';
import { notify } from '../lib/email/index.js';
import { findExpiringSoon } from './repository.js';

const WINDOW_DAYS = 3;

// Notification only. Expiry itself is driven by customer.subscription.deleted,
// so a missed run costs a reminder, never a state transition. The dedup key
// carries the period end, so re-running the same day sends nothing.
export async function run() {
  const due = await findExpiringSoon(WINDOW_DAYS);
  for (const sub of due) {
    await notify({
      orgId: sub.org_id,
      kind: NOTIFICATION_KIND.SUBSCRIPTION_EXPIRING,
      dedupKey: `SUBSCRIPTION_EXPIRING:${sub.id}:${sub.current_period_end.toISOString()}`,
      data: { periodEnd: sub.current_period_end.toISOString().slice(0, 10) },
    });
  }
  return due.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((n) => { console.log(`notified ${n}`); process.exit(0); })
       .catch((err) => { console.error(err); process.exit(1); });
}
