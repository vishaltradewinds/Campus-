import type {
  BillingInterval,
  CommercialEntitlement,
  CommercialPlan,
  CommercialPlanCode,
  CurrencyCode,
} from '../types/commercial';

export const COMMERCIAL_PLANS: Record<CommercialPlanCode, CommercialPlan> = {
  EMPLOYER_FREE: {
    code: 'EMPLOYER_FREE', accountType: 'employer', name: 'Employer Free',
    description: 'Basic employer presence and limited hiring workflows.', currency: 'INR', amountMinor: 0, billingInterval: 'month',
    entitlements: ['basic_profile', 'basic_matching', 'basic_campaigns'],
    limits: { activeCampaigns: 1, recruiterSeats: 1, monthlyCandidateViews: 100 },
  },
  EMPLOYER_PRO: {
    code: 'EMPLOYER_PRO', accountType: 'employer', name: 'Employer Pro',
    description: 'Advanced recruiting and AI-assisted hiring workflows.', currency: 'INR', amountMinor: 1200000, billingInterval: 'month',
    entitlements: ['basic_profile', 'basic_matching', 'basic_campaigns', 'advanced_matching', 'ai_requirement_builder', 'advanced_analytics', 'bulk_outreach', 'institution_targeting'],
    limits: { activeCampaigns: 20, recruiterSeats: 10, monthlyCandidateViews: 10000 },
  },
  EMPLOYER_ENTERPRISE: {
    code: 'EMPLOYER_ENTERPRISE', accountType: 'employer', name: 'Employer Enterprise',
    description: 'Contracted enterprise recruiting infrastructure.', currency: 'INR', amountMinor: 0, billingInterval: 'year',
    entitlements: ['basic_profile', 'basic_matching', 'basic_campaigns', 'advanced_matching', 'ai_requirement_builder', 'advanced_analytics', 'bulk_outreach', 'institution_targeting', 'priority_support', 'ats_integration', 'sso', 'api_access', 'workforce_intelligence'],
    limits: { activeCampaigns: null, recruiterSeats: null, monthlyCandidateViews: null },
  },
  INSTITUTION_FREE: {
    code: 'INSTITUTION_FREE', accountType: 'institution', name: 'Institution Free',
    description: 'Core institution participation and opportunity management.', currency: 'INR', amountMinor: 0, billingInterval: 'year',
    entitlements: ['basic_profile', 'basic_matching'],
    limits: { activeCampaigns: 0, recruiterSeats: 1, monthlyCandidateViews: 0 },
  },
  INSTITUTION_PRO: {
    code: 'INSTITUTION_PRO', accountType: 'institution', name: 'Institution Pro',
    description: 'Placement operations, verification and analytics.', currency: 'INR', amountMinor: 5000000, billingInterval: 'year',
    entitlements: ['basic_profile', 'basic_matching', 'placement_analytics', 'student_verification', 'advanced_analytics'],
    limits: { activeCampaigns: null, recruiterSeats: 5, monthlyCandidateViews: null },
  },
  INSTITUTION_ENTERPRISE: {
    code: 'INSTITUTION_ENTERPRISE', accountType: 'institution', name: 'Institution Enterprise',
    description: 'Enterprise placement and institutional talent infrastructure.', currency: 'INR', amountMinor: 20000000, billingInterval: 'year',
    entitlements: ['basic_profile', 'basic_matching', 'placement_analytics', 'student_verification', 'advanced_analytics', 'priority_support', 'sso', 'api_access', 'workforce_intelligence'],
    limits: { activeCampaigns: null, recruiterSeats: null, monthlyCandidateViews: null },
  },
};

export function getCommercialPlan(code: CommercialPlanCode): CommercialPlan {
  return COMMERCIAL_PLANS[code];
}

export function hasEntitlement(plan: CommercialPlan, entitlement: CommercialEntitlement): boolean {
  return plan.entitlements.includes(entitlement);
}

export function canUseLimit(value: number, limit: number | null): boolean {
  return limit === null || value < limit;
}

export interface CampaignQuoteInput {
  institutions: number;
  vacancies: number;
  currency?: CurrencyCode;
}

export interface CampaignQuote {
  currency: CurrencyCode;
  pricingModel: 'flat_campaign' | 'scaled_campaign';
  baseFeeMinor: number;
  institutionFeeMinor: number;
  vacancyFeeMinor: number;
  totalMinor: number;
}

/** Launch pricing defaults. Keep pricing here, separate from recruitment state and payment-provider code. */
export function quoteHiringCampaign(input: CampaignQuoteInput): CampaignQuote {
  const institutions = Math.max(1, Math.floor(input.institutions));
  const vacancies = Math.max(1, Math.floor(input.vacancies));
  const currency = input.currency ?? 'INR';
  const baseFeeMinor = 250000;
  const institutionFeeMinor = institutions * 25000;
  const vacancyFeeMinor = vacancies * 5000;
  return { currency, pricingModel: 'scaled_campaign', baseFeeMinor, institutionFeeMinor, vacancyFeeMinor, totalMinor: baseFeeMinor + institutionFeeMinor + vacancyFeeMinor };
}

export interface SuccessFeeQuote {
  currency: CurrencyCode;
  compensationMinor: number;
  feeRateBps: number;
  feeAmountMinor: number;
}

export function quoteSuccessFee(compensationMinor: number, feeRateBps = 500, currency: CurrencyCode = 'INR'): SuccessFeeQuote {
  const compensation = Math.max(0, Math.floor(compensationMinor));
  const rate = Math.max(0, Math.min(10000, Math.floor(feeRateBps)));
  return { currency, compensationMinor: compensation, feeRateBps: rate, feeAmountMinor: Math.floor((compensation * rate) / 10000) };
}

export function planAmountMinor(code: CommercialPlanCode): number {
  return getCommercialPlan(code).amountMinor;
}

export function planBillingInterval(code: CommercialPlanCode): BillingInterval {
  return getCommercialPlan(code).billingInterval;
}
