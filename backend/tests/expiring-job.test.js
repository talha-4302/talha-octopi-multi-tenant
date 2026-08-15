import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminPool } from '../src/db/pool.js';
import { run } from '../src/jobs/expiringSoon.js';
import * as transport from '../src/lib/email/transport.js';
import { seedOrg, getPlan } from './helpers/db.js';
import { makeSubscription } from './helpers/factories.js';
import { ORG_STATUS, SUBSCRIPTION_STATUS } from '../src/lib/constants.js';

const inDays = (n) => new Date(Date.now() + n * 86400_000);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(transport, 'send').mockResolvedValue({ id: 'msg' });
});

describe('the expiring soon sweep', () => {
  it('notifies subscriptions ending inside three days', async () => {
    const plan = await getPlan('Starter');
    const { orgId } = await seedOrg({ status: ORG_STATUS.ACTIVE });
    await makeSubscription({ orgId, plan, periodEnd: inDays(2) });

    await run();

    const { rows } = await adminPool.query(
      `SELECT kind FROM notifications_log WHERE org_id = $1`, [orgId]);
    expect(rows[0].kind).toBe('SUBSCRIPTION_EXPIRING');
  });

  it('ignores subscriptions ending further out', async () => {
    const plan = await getPlan('Starter');
    const { orgId } = await seedOrg();
    await makeSubscription({ orgId, plan, periodEnd: inDays(20) });

    await run();
    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows).toHaveLength(0);
  });

  it('ignores subscriptions that are not ACTIVE', async () => {
    const plan = await getPlan('Starter');
    const { orgId } = await seedOrg();
    await makeSubscription({ orgId, plan, periodEnd: inDays(1), status: SUBSCRIPTION_STATUS.CANCELLED });

    await run();
    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows).toHaveLength(0);
  });

  it('sends nothing on a second run the same day', async () => {
    const plan = await getPlan('Starter');
    const { orgId } = await seedOrg();
    await makeSubscription({ orgId, plan, periodEnd: inDays(2) });

    await run();
    await run();

    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows).toHaveLength(1);
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it('writes no status, because Stripe drives EXPIRED', async () => {
    const plan = await getPlan('Starter');
    const { orgId } = await seedOrg();
    const sub = await makeSubscription({ orgId, plan, periodEnd: inDays(1) });

    await run();

    const { rows } = await adminPool.query('SELECT status FROM subscriptions WHERE id = $1', [sub.id]);
    expect(rows[0].status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });
});
