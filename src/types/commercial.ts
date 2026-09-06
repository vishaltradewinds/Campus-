export type CommercialAccountType = 'employer' | 'institution';
export type BillingInterval = 'month' | 'year' | 'one_time';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type CommercialPlanCode =
  | 'EMPLOYER_FREE'
  | 'EMPLOYER_PRO'
  | 'EMPLOYER_ENTERPRISE'
  | 'INSTITUTION_FREE'
  | 'INSTITUTION_PRO'
  | 'INSTITUTION_ENTERPRISE';

export type CommercialEntitlement =
  | 'basic_profile'
  | 'basic_matching'
  | 'basic_campaigns'
  | 'advanced_matching'
  | 'ai_requirement_builder'
  | 'advanced_analytics'
  | 'bulk_outreach'
  | 'institution_targeting'
  | 'priority_support'
  | 'ats_integration'
  | 'sso'
  | 'api_access'
  | 'workforce_intelligence'
  | 'placement_analytics'
  | 'student_verification';

export interface CommercialPlan {
  code: CommercialPlanCode;
  accountType: CommercialAccountType;
  name: string;
  description: string;
  currency: CurrencyCode;
  amountMinor: number;
  billingInterval: BillingInterval;
  entitlements: CommercialEntitlement[];
  limits: {
    activeCampaigns: number | null;
    recruiterSeats: number | null;
    monthlyCandidateViews: number | null;
  };
}

export interface CommercialAccount {
  id: string;
  ownerUid: string;
  type: CommercialAccountType;
  legalName: string;
  countryCode: string;
  defaultCurrency: CurrencyCode;
  activePlan: CommercialPlanCode;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';

export interface CommercialSubscription {
  id: string;
  accountId: string;
  planCode: CommercialPlanCode;
  status: SubscriptionStatus;
  currency: CurrencyCode;
  amountMinor: number;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  provider?: string;
  providerSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignChargeStatus = 'quoted' | 'pending_payment' | 'paid' | 'voided' | 'refunded';

export interface CampaignCharge {
  id: string;
  campaignId: string;
  employerId: string;
  currency: CurrencyCode;
  amountMinor: number;
  status: CampaignChargeStatus;
  pricingModel: 'flat_campaign' | 'scaled_campaign' | 'enterprise_contract';
  quotedAt: string;
  paidAt?: string;
  providerPaymentId?: string;
}

export type SuccessFeeStatus = 'pending_outcome' | 'earned' | 'invoiced' | 'paid' | 'waived' | 'refunded';

export interface SuccessFee {
  id: string;
  opportunityId: string;
  campaignId: string;
  employerId: string;
  studentId: string;
  joinedAt: string;
  firstYearCompensationMinor: number;
  currency: CurrencyCode;
  feeRateBps: number;
  feeAmountMinor: number;
  status: SuccessFeeStatus;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface CommercialInvoiceLine {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
  sourceType: 'subscription' | 'campaign' | 'success_fee' | 'enterprise';
  sourceId: string;
}

export interface CommercialInvoice {
  id: string;
  accountId: string;
  currency: CurrencyCode;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  status: InvoiceStatus;
  lines: CommercialInvoiceLine[];
  dueAt?: string;
  paidAt?: string;
  providerInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEvent {
  id: string;
  accountId: string;
  type:
    | 'subscription_created'
    | 'subscription_renewed'
    | 'campaign_charged'
    | 'success_fee_earned'
    | 'invoice_issued'
    | 'invoice_paid'
    | 'payment_failed'
    | 'refund_issued';
  sourceId: string;
  occurredAt: string;
  immutable: true;
}
