// Duplicated on purpose from backend/src/lib/constants.js. Two independent
// projects, two installs, no shared package. Change both together.

export const ROLES = Object.freeze({
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MEMBER: 'ORG_MEMBER',
});

export const ORG_STATUS = Object.freeze({
  PENDING: 'PENDING',
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
});

export const USER_STATUS = Object.freeze({
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

export const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  ROLLED_BACK: 'ROLLED_BACK',
});

// The frontend switches on error.code and never parses error.message,
// so message wording can change without breaking behaviour.
export const ERROR_CODE = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_REUSED: 'REFRESH_REUSED',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  ORG_NOT_ACTIVE: 'ORG_NOT_ACTIVE',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  NAME_IN_USE: 'NAME_IN_USE',
  ALREADY_A_MEMBER: 'ALREADY_A_MEMBER',
  LAST_ADMIN: 'LAST_ADMIN',
  SEAT_LIMIT_REACHED: 'SEAT_LIMIT_REACHED',
  SUBSCRIPTION_CONFLICT: 'SUBSCRIPTION_CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
});

export const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    (cents ?? 0) / 100,
  );

export const date = (iso) =>
  iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '';
