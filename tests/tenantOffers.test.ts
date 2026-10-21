import test from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { issueTenantOffer, listTenantStudentOffers, respondToTenantOffer, withdrawTenantOffer } from "../server/tenancy/offers";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");
const validInput = { requestId: "offer-request-001", offerReference: "OFFER-2026-001", documentReference: "employer-docs:offer-2026-001", expiresAt: "2026-10-31T12:00:00.000Z" };

function fakeClient(options: { authorized?: boolean; job?: any; application?: any; offer?: any; updateApplicationCount?: number; updateOfferCount?: number } = {}) {
  const calls: Record<string, any[]> = { membership: [], applicationUpdate: [], offerCreate: [], offerUpdate: [], offerAudit: [], applicationAudit: [], offerFind: [] };
  let application: any = options.application === undefined ? { id: "application-1", requisitionId: "job-1", status: "SHORTLISTED", studentSubject: "student-uid" } : options.application;
  let offer: any = options.offer ?? null;
  const tx = {
    jobRequisition: { findUnique: async (args: any) => { calls.job = [args]; return options.job === undefined ? { id: "job-1", employerId: "employer-1" } : options.job; } },
    employerRecruiter: { findFirst: async (args: any) => { calls.membership.push(args); return options.authorized === false ? null : { employerId: "employer-1" }; } },
    jobApplication: {
      findUnique: async () => application,
      updateMany: async (args: any) => {
        calls.applicationUpdate.push(args);
        if (options.updateApplicationCount !== undefined) return { count: options.updateApplicationCount };
        if (!application || application.status !== args.where.status) return { count: 0 };
        application = { ...application, ...args.data };
        return { count: 1 };
      },
    },
    applicationOffer: {
      findUnique: async (args: any) => {
        calls.offerFind.push(args);
        if (args.where.requestId) return offer?.requestId === args.where.requestId ? offer : null;
        if (args.where.id) return offer?.id === args.where.id ? { ...offer, application: { studentSubject: application?.studentSubject, status: application?.status, requisitionId: application?.requisitionId } } : null;
        return null;
      },
      create: async (args: any) => {
        calls.offerCreate.push(args);
        offer = { id: "offer-1", ...args.data, issuedAt: now, respondedAt: null, responseNote: null };
        return { id: offer.id, expiresAt: offer.expiresAt, status: offer.status };
      },
      updateMany: async (args: any) => {
        calls.offerUpdate.push(args);
        if (options.updateOfferCount !== undefined) return { count: options.updateOfferCount };
        if (!offer || offer.status !== args.where.status) return { count: 0 };
        offer = { ...offer, ...args.data };
        return { count: 1 };
      },
      findMany: async (args: any) => {
        calls.offerList = [args];
        return [{ id: "offer-1", offerReference: "OFFER-2026-001", documentReference: "employer-docs:offer-2026-001", status: "ISSUED", issuedAt: now, expiresAt: new Date("2026-10-31T12:00:00.000Z"), respondedAt: null, responseNote: null, application: { requisition: { title: "Engineer", employer: { displayName: "Example Employer" } } } }];
      },
    },
    applicationOfferAuditEvent: { create: async (args: any) => { calls.offerAudit.push(args); return { id: "offer-audit-1" }; } },
    jobApplicationAuditEvent: { create: async (args: any) => { calls.applicationAudit.push(args); return { id: "application-audit-1" }; } },
  };
  const client = { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
  return { client, calls, getApplication: () => application, getOffer: () => offer };
}

test("verified recruiter issues an offer to a shortlisted application and updates both audit trails", async () => {
  const { client, calls, getApplication, getOffer } = fakeClient();
  assert.deepEqual(await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => client, now), {
    kind: "issued", offerId: "offer-1", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z"),
  });
  assert.equal(getApplication().status, "OFFERED");
  assert.equal(getOffer().status, "ISSUED");
  assert.equal(calls.membership[0].where.employer.verification, "VERIFIED");
  assert.equal(calls.offerAudit[0].data.eventType, "OFFER_ISSUED");
  assert.equal(calls.applicationAudit[0].data.eventType, "APPLICATION_OFFERED");
});

test("offer issuance is idempotent and request ID reuse conflicts", async () => {
  const existing = { id: "offer-existing", applicationId: "application-1", requestId: validInput.requestId, createdBySubject: "recruiter-uid", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z") };
  const replay = fakeClient({ offer: existing });
  assert.deepEqual(await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => replay.client, now), {
    kind: "already_issued", offerId: "offer-existing", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z"),
  });
  assert.equal(replay.calls.offerCreate.length, 0);
  const conflict = fakeClient({ offer: { ...existing, applicationId: "another-application" } });
  assert.deepEqual(await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => conflict.client, now), { kind: "request_conflict" });
});

test("offer issuance fails closed for unauthorized recruiters, non-shortlisted applications and stale updates", async () => {
  const unauthorized = fakeClient({ authorized: false });
  assert.deepEqual(await issueTenantOffer(context, "other-recruiter", "job-1", "application-1", validInput, () => unauthorized.client, now), { kind: "not_authorized" });
  const applied = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "APPLIED", studentSubject: "student-uid" } });
  assert.deepEqual(await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => applied.client, now), { kind: "not_shortlisted" });
  const stale = fakeClient({ updateApplicationCount: 0 });
  assert.deepEqual(await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => stale.client, now), { kind: "invalid_state" });
  assert.equal(stale.calls.offerCreate.length, 0);
});

test("students can accept or decline their own unexpired offer idempotently", async () => {
  for (const [decision, status, applicationStatus, kind] of [["ACCEPT", "ACCEPTED", "OFFER_ACCEPTED", "accepted"], ["DECLINE", "DECLINED", "OFFER_DECLINED", "declined"]] as const) {
    const { client, calls, getApplication, getOffer } = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "OFFERED", studentSubject: "student-uid" }, offer: { id: "offer-1", applicationId: "application-1", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z"), requestId: validInput.requestId, createdBySubject: "recruiter-uid" } });
    assert.deepEqual(await respondToTenantOffer(context, "student-uid", "offer-1", decision, "Reviewed", () => client, now), { kind, offerId: "offer-1", status });
    assert.equal(getOffer().status, status);
    assert.equal(getApplication().status, applicationStatus);
    assert.equal(calls.offerAudit[0].data.eventType, status);
    assert.equal(calls.applicationAudit[0].data.eventType, applicationStatus);
  }
});

test("offer responses reject another student's offer, record expiry, and fail closed on concurrent changes", async () => {
  const otherStudent = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "OFFERED", studentSubject: "another-student" }, offer: { id: "offer-1", applicationId: "application-1", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z") } });
  assert.deepEqual(await respondToTenantOffer(context, "student-uid", "offer-1", "ACCEPT", "", () => otherStudent.client, now), { kind: "not_authorized" });
  const expired = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "OFFERED", studentSubject: "student-uid" }, offer: { id: "offer-1", applicationId: "application-1", status: "ISSUED", expiresAt: new Date("2026-10-20T12:00:00.000Z") } });
  assert.deepEqual(await respondToTenantOffer(context, "student-uid", "offer-1", "ACCEPT", "", () => expired.client, now), { kind: "expired", offerId: "offer-1", status: "EXPIRED" });
  assert.equal(expired.getApplication().status, "OFFER_EXPIRED");
  const stale = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "OFFERED", studentSubject: "student-uid" }, offer: { id: "offer-1", applicationId: "application-1", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z") }, updateApplicationCount: 0 });
  assert.deepEqual(await respondToTenantOffer(context, "student-uid", "offer-1", "ACCEPT", "", () => stale.client, now), { kind: "invalid_state" });
});

test("verified recruiter can withdraw an issued offer with reason and paired audit records", async () => {
  const { client, calls, getApplication, getOffer } = fakeClient();
  await issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", validInput, () => client, now);
  assert.deepEqual(await withdrawTenantOffer(context, "recruiter-uid", "job-1", "offer-1", "Hiring need changed after offer approval.", () => client), {
    kind: "withdrawn", offerId: "offer-1", status: "WITHDRAWN",
  });
  assert.equal(getOffer().status, "WITHDRAWN");
  assert.equal(getApplication().status, "OFFER_WITHDRAWN");
  assert.equal(calls.offerAudit[1].data.eventType, "OFFER_WITHDRAWN");
  assert.equal(calls.applicationAudit[1].data.eventType, "APPLICATION_OFFER_WITHDRAWN");
  assert.equal(calls.offerAudit[1].data.metadata.reason, "Hiring need changed after offer approval.");
  assert.deepEqual(await withdrawTenantOffer(context, "recruiter-uid", "job-1", "offer-1", "Attempting a second withdrawal.", () => client), { kind: "invalid_state" });
});

test("student offer list is scoped to authenticated subject and bounded", async () => {
  const { client, calls } = fakeClient();
  const result = await listTenantStudentOffers(context, "student-uid", () => client);
  assert.equal(result.offers.length, 1);
  assert.deepEqual(calls.offerList[0].where, { application: { studentSubject: "student-uid" } });
  assert.equal(calls.offerList[0].take, 100);
});

test("offer input and identity validation reject invalid values", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => issueTenantOffer(context, " ", "job-1", "application-1", validInput, () => client, now), /Authenticated recruiter/);
  await assert.rejects(() => issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", { ...validInput, requestId: "x" }, () => client, now), /offer requestId/);
  await assert.rejects(() => issueTenantOffer(context, "recruiter-uid", "job-1", "application-1", { ...validInput, expiresAt: "2026-10-20T12:00:00.000Z" }, () => client, now), /future offer expiresAt/);
  await assert.rejects(() => respondToTenantOffer(context, "student-uid", "offer-1", "maybe", "", () => client, now), /decision must be/);
});
