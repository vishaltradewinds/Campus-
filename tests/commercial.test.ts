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


test('Razorpay webhook signatures are verified with HMAC and reject tampering', async () => {
  const { razorpayWebhookDigest, verifyRazorpayWebhookSignature } = await import('../src/lib/paymentSecurity');
  const body = Buffer.from('{"event":"payment.captured","id":"evt-1"}');
  const secret = 'test-webhook-secret';
  const signature = razorpayWebhookDigest(body, secret);
  assert.equal(verifyRazorpayWebhookSignature(body, signature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{"event":"payment.failed","id":"evt-1"}'), signature, secret), false);
  assert.equal(verifyRazorpayWebhookSignature(body, signature, 'wrong-secret'), false);
});

test('placement extract is institution and date scoped, deduplicates, and rejects incomplete evidence', async () => {
  const { buildPlacementExtract, toSafeCsv } = await import('../src/lib/placementEvidence');
  const base = { id:'o1', institutionId:'inst', studentId:'stu', employerId:'emp', stage:'joined', joinedAt:'2026-08-01T00:00:00Z', joinedSalaryLPA:8, offerRecordId:'offer-1' };
  const report = buildPlacementExtract('inst', [base, base, {...base,id:'o2',offerRecordId:'offer-2'}, {...base,id:'other',institutionId:'other'}, {...base,id:'old',joinedAt:'2025-08-01T00:00:00Z'}, {...base,id:'missing',offerRecordId:undefined}, {...base,id:'pending',stage:'accepted'}], '2026-07-01T00:00:00Z','2027-07-01T00:00:00Z');
  assert.equal(report.recorded.length,2);
  assert.equal(report.uniqueStudents,1);
  assert.equal(report.missingEvidence,1);
  assert.equal(report.reportStatus,'LIMITED_OPERATIONAL_EXTRACT');
  assert.equal(toSafeCsv([['=SUM(1,2)','a"b','x,y']]), '"\'=SUM(1,2)","a""b","x,y"');
});

test('success fees preserve exact minor units at safe integer boundary and reject invalid compensation',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  assert.equal(quoteSuccessFee(max,9999).feeAmountMinor,Number(BigInt(max)*9999n/10000n));
  assert.equal(quoteSuccessFee(max,10000).feeAmountMinor,max);
  for(const invalid of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>quoteSuccessFee(invalid),/Invalid minor-unit/);
});
