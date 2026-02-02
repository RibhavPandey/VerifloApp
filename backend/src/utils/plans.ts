// Plan definitions and limits

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanLimits {
  monthlyDocuments: number;
  monthlyCredits: number;
  overageDocPriceCents: number; // USD cents per doc (0 = no overage)
  overageCreditPriceCents: number; // USD cents per credit (0 = no overage)
  features: string[];
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    monthlyDocuments: 10,
    monthlyCredits: 100,
    overageDocPriceCents: 0,
    overageCreditPriceCents: 0,
    features: ['Basic features'],
  },
  starter: {
    monthlyDocuments: 150,
    monthlyCredits: 750,
    overageDocPriceCents: 15, // $0.15
    overageCreditPriceCents: 2, // $0.02
    features: ['Basic features', 'Priority support'],
  },
  pro: {
    monthlyDocuments: 750,
    monthlyCredits: 3000,
    overageDocPriceCents: 12, // $0.12
    overageCreditPriceCents: 2, // ~$0.015 (rounded)
    features: ['All starter features', 'Higher limits', 'Priority support'],
  },
  enterprise: {
    monthlyDocuments: 0, // custom
    monthlyCredits: 0, // custom
    overageDocPriceCents: 0,
    overageCreditPriceCents: 0,
    features: ['All pro features', 'Team-friendly limits', 'Dedicated support'],
  },
};

export function getPlanLimits(plan: PlanType | string): PlanLimits {
  return PLAN_LIMITS[plan as PlanType] || PLAN_LIMITS.free;
}

export function getMonthlyCredits(plan: PlanType | string): number {
  return getPlanLimits(plan).monthlyCredits;
}

export function getMonthlyDocuments(plan: PlanType | string): number {
  return getPlanLimits(plan).monthlyDocuments;
}

export function isValidPlan(plan: string): plan is PlanType {
  return plan in PLAN_LIMITS;
}
