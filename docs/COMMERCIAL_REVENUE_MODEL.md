# NexusTalent Commercial Revenue Model

## Purpose

The commercial layer monetizes the recruitment operating system without charging students for core access or weakening candidate consent and matching integrity.

## Revenue lanes

1. Employer subscriptions — Free, Pro and Enterprise tiers with entitlements and usage limits.
2. Hiring campaign fees — scaled campaign pricing based on institutions and vacancies.
3. Success fees — percentage of first-year compensation when a candidate reaches the `joined` outcome.
4. Institution SaaS — Free, Pro and Enterprise placement/verification/analytics tiers.
5. Enterprise/API and workforce intelligence — later expansion using the same entitlement model.

## Commercial domain

The repository defines explicit records for `commercialAccounts`, `subscriptions`, `campaignCharges`, `successFees`, `invoices`, and `billingEvents`. These remain separate from recruitment state.

## Deterministic pricing

`src/lib/commercial.ts` contains launch pricing and quote functions. Monetary values are integer minor units; success fees use basis points.

## Payment-provider integration

Razorpay is the initial provider adapter. The trusted server:
- calculates the campaign quote server-side;
- creates the provider order server-side;
- records an immutable invoice/billing event;
- never accepts a client-supplied paid/settled flag;
- validates webhook HMAC before processing;
- uses the provider event identifier for replay protection;
- updates invoice state only from trusted webhook events.

Razorpay API keys and webhook secrets are server-only. The provider integration follows Razorpay's published security guidance to keep API secrets out of source control and validate webhook HMAC. citeturn0search0turn0search1

## Tax, refunds and reconciliation

The software now has the accounting event boundary, but production financial operation still requires:
- verified Razorpay merchant activation;
- GST/tax invoice configuration approved for the operating entity;
- refund policy and authorized refund workflow;
- settlement-to-invoice reconciliation;
- finance-owner approval and test evidence.

These cannot be truthfully marked complete without the actual merchant account and operating-entity decisions.

## Security boundary

Commercial Firestore collections are server-owned. Browser clients cannot create, modify or delete invoices, charges, subscriptions, success fees or billing events.

No paid plan can bypass candidate consent, authorization, privacy, or AI safety controls.
