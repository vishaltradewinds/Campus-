# NexusTalent Commercial Revenue Model

## Purpose

The commercial layer monetizes the recruitment operating system without charging students for core access or weakening candidate consent and matching integrity.

## Revenue lanes

1. **Employer subscriptions** — Free, Pro and Enterprise tiers with entitlements and usage limits.
2. **Hiring campaign fees** — scaled campaign pricing based on institutions and vacancies.
3. **Success fees** — percentage of first-year compensation when a candidate reaches the `joined` outcome.
4. **Institution SaaS** — Free, Pro and Enterprise placement/verification/analytics tiers.
5. **Enterprise/API and workforce intelligence** — later expansion using the same entitlement model.

## Commercial domain

The repository now defines explicit records for:

- `commercialAccounts`
- `subscriptions`
- `campaignCharges`
- `successFees`
- `invoices`
- `billingEvents`

These are intentionally separate from recruitment records. Recruitment state remains the source of truth for hiring activity; commercial records reference recruitment IDs rather than embedding or replacing recruitment state.

## Pricing boundary

`src/lib/commercial.ts` contains deterministic launch pricing and quote functions. These are product defaults, not payment-provider integration. A future payment provider can consume the resulting quote/invoice amounts without changing recruitment workflows.

All monetary values are stored as integer minor units. For example, INR 12,000 is represented as `1200000` paise. Success fees use basis points, so 500 = 5%.

## Security boundary

Commercial Firestore collections are **server-owned**. Browser clients can read records that belong to their own commercial account/employer, but cannot create, modify or delete subscriptions, invoices, charges, success fees or billing events. Payment-provider webhooks and trusted backend operations must be the only writers.

## Business integrity rules

- A campaign charge references an existing campaign.
- A success fee references an existing opportunity and is earned only from the hiring outcome; the authoritative recruitment transition remains separate.
- Subscription state is independent from recruitment state.
- Billing events are immutable and suitable for reconciliation.
- No payment state is inferred from a client-controlled field.
- No paid plan may bypass candidate consent, authorization, privacy, or AI safety controls.

## What this change does not do

This change deliberately does **not** add a payment provider, collect money, or claim that a subscription is paid. Provider integration requires a separate controlled step for checkout, webhook verification, tax/invoice requirements, refunds and reconciliation.
