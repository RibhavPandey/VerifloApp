// Plan definitions and limits

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanLimits {
  monthlyCredits: number;
  features: string[];
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    monthlyCredits: 200,
    features: ['Basic features'],
  },
  starter: {
    monthlyCredits: 2000,
    features: ['Basic features', 'Priority support'],
  },
  pro: {
    monthlyCredits: 7500,
    features: ['All starter features', 'Higher limits', 'Priority support'],
  },
  enterprise: {
    monthlyCredits: 20000,
    features: ['All pro features', 'Team-friendly limits', 'Dedicated support'],
  },
};

export function getPlanLimits(plan: PlanType | string): PlanLimits {
  return PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.free;
}

export function getMonthlyCredits(plan: PlanType | string): number {
  return getPlanLimits(plan).monthlyCredits;
}

export function isValidPlan(plan: string): plan is PlanType {
  return plan in PLAN_LIMITS;
}
