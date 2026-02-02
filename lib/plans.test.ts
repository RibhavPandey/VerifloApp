import { describe, it, expect } from 'vitest';
import { getPlanLimits, PLAN_LIMITS } from './plans';

describe('getPlanLimits', () => {
  it('returns free limits for unknown plan', () => {
    const limits = getPlanLimits('unknown');
    expect(limits).toEqual({ documents: 10, credits: 100 });
  });

  it('returns correct limits for free plan', () => {
    const limits = getPlanLimits('free');
    expect(limits).toEqual(PLAN_LIMITS.free);
  });

  it('returns correct limits for starter plan', () => {
    const limits = getPlanLimits('starter');
    expect(limits).toEqual({ documents: 150, credits: 750 });
  });

  it('returns correct limits for pro plan', () => {
    const limits = getPlanLimits('pro');
    expect(limits).toEqual({ documents: 750, credits: 3000 });
  });
});
