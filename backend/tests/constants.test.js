import { describe, it, expect } from 'vitest';
import {
  ROLES, ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS,
  NOTIFICATION_KIND, ERROR_CODE, ORG_GATE,
} from '../src/lib/constants.js';

describe('constants', () => {
  it('freezes every exported object', () => {
    for (const obj of [ROLES, ORG_STATUS, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, ERROR_CODE]) {
      expect(Object.isFrozen(obj)).toBe(true);
    }
  });

  it('maps each key to its own name, so a typo is a TypeError not a false compare', () => {
    for (const [key, value] of Object.entries(ROLES)) expect(value).toBe(key);
    for (const [key, value] of Object.entries(TRANSACTION_STATUS)) expect(value).toBe(key);
  });

  it('carries exactly the five transaction statuses the brief names', () => {
    expect(Object.keys(TRANSACTION_STATUS).sort()).toEqual(
      ['FAILED', 'PENDING', 'REFUNDED', 'ROLLED_BACK', 'SUCCESS']
    );
  });

  it('carries exactly the seven notification kinds the brief names', () => {
    expect(Object.keys(NOTIFICATION_KIND)).toHaveLength(7);
  });

  it('defines three gate tiers, the widest containing every org status', () => {
    expect(ORG_GATE.ANY).toHaveLength(Object.keys(ORG_STATUS).length);
    expect(ORG_GATE.BILLABLE).not.toContain(ORG_STATUS.SUSPENDED);
    expect(ORG_GATE.OPERATING).not.toContain(ORG_STATUS.PENDING);
  });
});
