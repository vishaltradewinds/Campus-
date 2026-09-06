import test from 'node:test';
import assert from 'node:assert/strict';
import { getCommercialPlan, hasEntitlement, quoteHiringCampaign, quoteSuccessFee, canUseLimit } from '../src/lib/commercial';

test('employer pro exposes paid recruiting entitlements', () => {
  const plan = getCommercialPlan('EMPLOYER_PRO');
  assert.equal(plan.amountMinor, 1200000);
  assert.equal(plan.billingInterval, 'month');
  assert.equal(hasEntitlement(plan, 'ai_requirement_builder'), true);
  assert.equal(hasEntitlement(plan, 'api_access'), false);
});

test('enterprise plan has unlimited operational limits', () => {
  const plan = getCommercialPlan('EMPLOYER_ENTERPRISE');
  assert.equal(canUseLimit(100000, plan.limits.activeCampaigns), true);
  assert.equal(canUseLimit(100000, plan.limits.monthlyCandidateViews), true);
});

test('campaign quote is deterministic and scaled', () => {
  const quote = quoteHiringCampaign({ institutions: 4, vacancies: 20 });
  assert.equal(quote.currency, 'INR');
  assert.equal(quote.pricingModel, 'scaled_campaign');
  assert.equal(quote.totalMinor, 450000);
});

test('success fee defaults to five percent', () => {
  const quote = quoteSuccessFee(80000000);
  assert.equal(quote.feeRateBps, 500);
  assert.equal(quote.feeAmountMinor, 4000000);
});

test('success fee rate is bounded to 0-100 percent', () => {
  assert.equal(quoteSuccessFee(10000, -10).feeAmountMinor, 0);
  assert.equal(quoteSuccessFee(10000, 20000).feeAmountMinor, 10000);
});
