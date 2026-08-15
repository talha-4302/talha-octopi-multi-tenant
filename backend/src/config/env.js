import dotenv from 'dotenv';

dotenv.config();

const REQUIRED = [
  'DATABASE_URL', 'ADMIN_DATABASE_URL', 'JWT_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL', 'CORS_ORIGIN',
];

const isTest = process.env.NODE_ENV === 'test';

function read(key) {
  // the test database is a different instance, selected here and nowhere else
  if (isTest && key === 'DATABASE_URL') return process.env.TEST_DATABASE_URL;
  if (isTest && key === 'ADMIN_DATABASE_URL') return process.env.TEST_ADMIN_DATABASE_URL;
  return process.env[key];
}

const missing = REQUIRED.filter((k) => !read(k));
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

export const env = Object.freeze({
  DATABASE_URL: read('DATABASE_URL'),
  ADMIN_DATABASE_URL: read('ADMIN_DATABASE_URL'),
  JWT_SECRET: read('JWT_SECRET'),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  STRIPE_SECRET_KEY: read('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: read('STRIPE_WEBHOOK_SECRET'),
  RESEND_API_KEY: read('RESEND_API_KEY'),
  EMAIL_FROM: read('EMAIL_FROM'),
  APP_URL: read('APP_URL'),
  CORS_ORIGIN: read('CORS_ORIGIN'),
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
});
