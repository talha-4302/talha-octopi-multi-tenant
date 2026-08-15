import { withTenant } from '../../db/withTenant.js';
import * as repo from './repository.js';
import { renderTemplate, renderPasswordReset } from './templates.js';
import * as transport from './transport.js';

// Log first, send second. The unique dedup_key is what makes a repeat a
// no-op, so claiming the key before sending is what prevents a double send.
// Never throws: an unsent email must not undo a committed payment.
export async function notify({ orgId, kind, to, dedupKey, data = {} }) {
  try {
    const claim = await withTenant(orgId, async (c) => {
      const org = await repo.findRecipient(c, orgId);
      if (!org) return null;
      // Recipient resolved server side. Never client supplied.
      const recipient = to ?? org.billing_email;
      const fresh = await repo.logNotification(c, {
        orgId, recipient, kind, dedupKey, status: 'SENT' });
      return fresh ? { recipient, orgName: org.name } : null;
    });

    if (!claim) return;   // duplicate key, already sent

    const { subject, html } = renderTemplate(kind, { ...data, orgName: claim.orgName });
    try {
      await transport.send({ to: claim.recipient, subject, html });
    } catch (err) {
      await withTenant(orgId, (c) => repo.markFailed(c, dedupKey, String(err.message).slice(0, 500)));
    }
  } catch (err) {
    console.error('[notify]', err);
  }
}

// Not logged in notifications_log: password reset belongs to authentication,
// not to organization notifications, and the table is org scoped.
export async function sendPasswordReset({ to, name, token }) {
  const { subject, html } = renderPasswordReset({ name, token });
  try { await transport.send({ to, subject, html }); }
  catch (err) { console.error('[password reset email]', err); }
}
