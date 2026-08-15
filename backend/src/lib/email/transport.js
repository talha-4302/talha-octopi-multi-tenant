import { Resend } from 'resend';
import { env } from '../../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

// Exported as a named function so tests can stub exactly this boundary.
export const send = ({ to, subject, html }) =>
  resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
