import { NOTIFICATION_KIND } from '../constants.js';
import { env } from '../../config/env.js';

const layout = (body) =>
  `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">${body}</div>`;

const TEMPLATES = {
  [NOTIFICATION_KIND.MEMBER_INVITED]: (d) => ({
    subject: `You have been invited to ${d.orgName ?? 'an organization'}`,
    html: layout(`<p>Hello${d.name ? ` ${d.name}` : ''},</p>
      <p>You have been invited to join ${d.orgName ?? 'an organization'}.</p>
      <p><a href="${env.APP_URL}/accept-invite?token=${d.token}">Accept the invitation</a></p>
      <p>This link expires in seven days.</p>`),
  }),
  [NOTIFICATION_KIND.PAYMENT_SUCCEEDED]: () => ({
    subject: 'Payment received',
    html: layout(`<p>Your payment was successful and your subscription is active.</p>
      <p><a href="${env.APP_URL}/billing">View your billing history</a></p>`),
  }),
  [NOTIFICATION_KIND.PAYMENT_FAILED]: (d) => ({
    subject: 'Payment failed',
    html: layout(`<p>We could not process your latest payment.</p>
      ${d.reason ? `<p>${d.reason}</p>` : ''}
      <p><a href="${env.APP_URL}/billing">Update your payment method</a></p>`),
  }),
  [NOTIFICATION_KIND.SUBSCRIPTION_UPGRADED]: (d) => ({
    subject: 'Your plan has been upgraded',
    html: layout(`<p>Your subscription is now on the ${d.planName ?? 'new'} plan.</p>`),
  }),
  [NOTIFICATION_KIND.SUBSCRIPTION_DOWNGRADED]: (d) => ({
    subject: 'Your plan has been changed',
    html: layout(`<p>Your subscription is now on the ${d.planName ?? 'new'} plan.</p>`),
  }),
  [NOTIFICATION_KIND.SUBSCRIPTION_CANCELLED]: (d) => ({
    subject: 'Your subscription has been cancelled',
    html: layout(`<p>Your subscription will end on ${d.periodEnd ?? 'the end of the current period'}.
      You keep access until then.</p>`),
  }),
  [NOTIFICATION_KIND.SUBSCRIPTION_EXPIRING]: (d) => ({
    subject: 'Your subscription renews soon',
    html: layout(`<p>Your subscription renews on ${d.periodEnd ?? 'soon'}.</p>`),
  }),
};

export const renderTemplate = (kind, data = {}) => TEMPLATES[kind](data);

export const renderPasswordReset = ({ name, token }) => ({
  subject: 'Reset your password',
  html: layout(`<p>Hello${name ? ` ${name}` : ''},</p>
    <p><a href="${env.APP_URL}/reset-password?token=${token}">Choose a new password</a></p>
    <p>This link expires in one hour. If you did not ask for it, ignore this email.</p>`),
});
