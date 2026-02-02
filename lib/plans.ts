// Plan limits for frontend display (matches backend plans.ts)

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';

export const PLAN_LIMITS: Record<PlanType, { documents: number; credits: number }> = {
  free: { documents: 10, credits: 100 },
  starter: { documents: 150, credits: 750 },
  pro: { documents: 750, credits: 3000 },
  enterprise: { documents: 0, credits: 0 },
};

export function getPlanLimits(plan: string): { documents: number; credits: number } {
  return PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.free;
}
