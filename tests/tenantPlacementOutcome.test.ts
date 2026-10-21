import test from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { recordTenantJoiningOutcome } from "../server/tenancy/placementOutcome";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");

function fakeClient(options: { authorized?: boolean; job?: any; application?: any; updateCount?: number } = {}) {
  const calls: Record<string, any[]> = { membership: [], update: [], audit: [] };
  let application = options.application === undefined ? { id: "application-1", requisitionId: "job-1", status: "OFFER_ACCEPTED" } : options.application;
  const tx = {
    jobRequisition: { findUnique: async (args: any) => { calls.job = [args]; return options.job === undefined ? { id: "job-1", employerId: "employer-1" } : options.job; } },
    employerRecruiter: { findFirst: async (args: any) => { calls.membership.push(args); return options.authorized === false ? null : { employerId: "employer-1" }; } },
    jobApplication: {
      findUnique: async () => application,
      updateMany: async (args: any) => {
        calls.update.push(args);
        if (options.updateCount !== undefined) return { count: options.updateCount };
        if (!application || application.status !== args.where.status) return { count: 0 };
        application = { ...application, ...args.data };
        return { count: 1 };
      },
    },
    jobApplicationAuditEvent: { create: async (args: any) => { calls.audit.push(args); return { id: "audit-1" }; } },
  };
  const client = { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
  return { client, calls, getApplication: () => application };
}

test("recruiter records a joining outcome with conditional state update and audit evidence", async () => {
  const { client, calls, getApplication } = fakeClient();
  const joinedAt = "2026-10-20T09:00:00.000Z";
  assert.deepEqual(await recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", {
    outcome: "JOINED", joinedAt, reason: "Employer confirmed candidate joined on the reported date.",
  }, () => client, now), { kind: "recorded", applicationId: "application-1", outcome: "JOINED", joinedAt: new Date(joinedAt) });
  assert.equal(getApplication().status, "JOINED");
  assert.equal(getApplication().outcomeRecordedBySubject, "recruiter-uid");
  assert.deepEqual(calls.update[0].where, { id: "application-1", requisitionId: "job-1", status: "OFFER_ACCEPTED" });
  assert.equal(calls.audit[0].data.eventType, "PLACEMENT_JOINED");
});

test("not-joined outcome requires a reason and records no joined date", async () => {
  const { client, calls, getApplication } = fakeClient();
  assert.deepEqual(await recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", {
    outcome: "NOT_JOINED", reason: "Candidate did not join by the agreed start date.",
  }, () => client, now), { kind: "recorded", applicationId: "application-1", outcome: "NOT_JOINED", joinedAt: null });
  assert.equal(getApplication().status, "NOT_JOINED");
  assert.equal(getApplication().joinedAt, null);
  assert.equal(calls.audit[0].data.eventType, "PLACEMENT_NOT_JOINED");
});

test("joining outcomes reject unauthorized, unrelated, non-accepted and stale applications", async () => {
  const unauthorized = fakeClient({ authorized: false });
  assert.deepEqual(await recordTenantJoiningOutcome(context, "other-recruiter", "job-1", "application-1", {
    outcome: "NOT_JOINED", reason: "Candidate did not join by the agreed start date.",
  }, () => unauthorized.client, now), { kind: "not_authorized" });
  const notAccepted = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "OFFERED" } });
  assert.deepEqual(await recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", {
    outcome: "NOT_JOINED", reason: "Candidate did not join by the agreed start date.",
  }, () => notAccepted.client, now), { kind: "invalid_state" });
  const stale = fakeClient({ updateCount: 0 });
  assert.deepEqual(await recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", {
    outcome: "NOT_JOINED", reason: "Candidate did not join by the agreed start date.",
  }, () => stale.client, now), { kind: "invalid_state" });
  const missing = fakeClient({ job: null });
  assert.deepEqual(await recordTenantJoiningOutcome(context, "recruiter-uid", "missing", "application-1", {
    outcome: "NOT_JOINED", reason: "Candidate did not join by the agreed start date.",
  }, () => missing.client, now), { kind: "not_found" });
});

test("outcome input requires a valid outcome, reason and appropriate joining date", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", { outcome: "HIRED", reason: "A reason with enough characters." }, () => client, now), /outcome must be/);
  await assert.rejects(() => recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", { outcome: "JOINED", reason: "A reason with enough characters." }, () => client, now), /requires a valid joinedAt/);
  await assert.rejects(() => recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", { outcome: "JOINED", joinedAt: "2026-10-22T12:00:00.000Z", reason: "A reason with enough characters." }, () => client, now), /not in the future/);
  await assert.rejects(() => recordTenantJoiningOutcome(context, "recruiter-uid", "job-1", "application-1", { outcome: "NOT_JOINED", joinedAt: "2026-10-20T09:00:00.000Z", reason: "A reason with enough characters." }, () => client, now), /must not include joinedAt/);
});
