import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminPool } from '../src/db/pool.js';
import { notify } from '../src/lib/email/index.js';
import * as transport from '../src/lib/email/transport.js';
import { seedOrg } from './helpers/db.js';
import { NOTIFICATION_KIND } from '../src/lib/constants.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(transport, 'send').mockResolvedValue({ id: 'msg_1' });
});

describe('notify', () => {
  it('sends and logs SENT', async () => {
    const { orgId } = await seedOrg();
    await notify({
      orgId, kind: NOTIFICATION_KIND.PAYMENT_SUCCEEDED,
      dedupKey: 'PAYMENT_SUCCEEDED:t1', data: { transactionId: 't1' } });

    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SENT');
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it('resolves the recipient server side from the org billing email', async () => {
    const { orgId } = await seedOrg();
    await notify({
      orgId, kind: NOTIFICATION_KIND.PAYMENT_SUCCEEDED,
      dedupKey: 'PAYMENT_SUCCEEDED:t2', data: {} });

    const { rows } = await adminPool.query(
      `SELECT n.recipient_email, o.billing_email FROM notifications_log n
         JOIN organizations o ON o.id = n.org_id WHERE n.org_id = $1`, [orgId]);
    expect(rows[0].recipient_email).toBe(rows[0].billing_email);
  });

  it('is a no-op on a duplicate dedup key, and does not send twice', async () => {
    const { orgId } = await seedOrg();
    const args = {
      orgId, kind: NOTIFICATION_KIND.SUBSCRIPTION_EXPIRING,
      dedupKey: 'SUBSCRIPTION_EXPIRING:s1:2026-09-01', data: {} };

    await notify(args);
    await notify(args);

    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows).toHaveLength(1);
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it('logs FAILED with the provider error instead of throwing', async () => {
    const { orgId } = await seedOrg();
    transport.send.mockRejectedValueOnce(new Error('provider down'));

    await expect(notify({
      orgId, kind: NOTIFICATION_KIND.PAYMENT_FAILED,
      dedupKey: 'PAYMENT_FAILED:t3', data: {} })).resolves.toBeUndefined();

    const { rows } = await adminPool.query('SELECT * FROM notifications_log WHERE org_id = $1', [orgId]);
    expect(rows[0].status).toBe('FAILED');
    expect(rows[0].error).toMatch(/provider down/);
  });

  it('has a template for every one of the seven kinds', async () => {
    const { renderTemplate } = await import('../src/lib/email/templates.js');
    for (const kind of Object.values(NOTIFICATION_KIND)) {
      const rendered = renderTemplate(kind, { orgName: 'Acme', token: 'x' });
      expect(rendered.subject, kind).toBeTruthy();
      expect(rendered.html, kind).toBeTruthy();
    }
  });
});
