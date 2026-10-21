import test from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { reviewTenantApplication } from "../server/tenancy/applicationReview";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient(options: { authorized?: boolean; job?: any; application?: any; updateCount?: number } = {}) {
  const calls: Record<string, any[]> = { membership: [], update: [], audit: [] };
  let application = options.application === undefined ? { id: "application-1", requisitionId: "job-1", status: "APPLIED" } : options.application;
  const tx = {
    jobRequisition: {
      findUnique: async (args: any) => { calls.job = [args]; return options.job === undefined ? { id: "job-1", employerId: "employer-1" } : options.job; },
    },
    employerRecruiter: {
      findFirst: async (args: any) => { calls.membership.push(args); return options.authorized === false ? null : { employerId: "employer-1" }; },
    },
    jobApplication: {
      findUnique: async (args: any) => { calls.application = [args]; return application; },
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

test("authorized verified-employer recruiter can shortlist an applied candidate with audit evidence", async () => {
  const { client, calls, getApplication } = fakeClient();
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "SHORTLISTED", () => client), {
    kind: "updated", applicationId: "application-1", status: "SHORTLISTED",
  });
  assert.equal(getApplication().status, "SHORTLISTED");
  assert.equal(calls.membership[0].where.employer.verification, "VERIFIED");
  assert.deepEqual(calls.update[0].where, { id: "application-1", requisitionId: "job-1", status: "APPLIED" });
  assert.equal(calls.audit[0].data.eventType, "APPLICATION_SHORTLISTED");
  assert.deepEqual(calls.audit[0].data.metadata, { tenantId: "tenant-mit", requisitionId: "job-1", fromStatus: "APPLIED", toStatus: "SHORTLISTED" });
});

test("recruiter can reject an applied candidate and decision is audited", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "REJECTED", () => client), {
    kind: "updated", applicationId: "application-1", status: "REJECTED",
  });
  assert.equal(calls.audit[0].data.eventType, "APPLICATION_REJECTED");
});

test("review is tenant/employer scoped and never exposes or mutates another requisition's application", async () => {
  const wrongJob = fakeClient({ application: { id: "application-1", requisitionId: "job-other", status: "APPLIED" } });
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "SHORTLISTED", () => wrongJob.client), { kind: "not_found" });
  assert.equal(wrongJob.calls.update.length, 0);
  const unauthorized = fakeClient({ authorized: false });
  assert.deepEqual(await reviewTenantApplication(context, "unrelated-recruiter", "job-1", "application-1", "REJECTED", () => unauthorized.client), { kind: "not_authorized" });
  assert.equal(unauthorized.calls.update.length, 0);
});

test("only APPLIED applications may be decided and stale concurrent updates fail closed", async () => {
  const decided = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "SHORTLISTED" } });
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "REJECTED", () => decided.client), { kind: "invalid_state" });
  assert.equal(decided.calls.update.length, 0);
  const stale = fakeClient({ updateCount: 0 });
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "SHORTLISTED", () => stale.client), { kind: "invalid_state" });
  assert.equal(stale.calls.audit.length, 0);
});

test("invalid identity, IDs, decisions and missing records fail safely", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => reviewTenantApplication(context, " ", "job-1", "application-1", "SHORTLISTED", () => client), /Authenticated recruiter/);
  await assert.rejects(() => reviewTenantApplication(context, "recruiter-uid", " ", "application-1", "SHORTLISTED", () => client), /valid requisition ID/);
  await assert.rejects(() => reviewTenantApplication(context, "recruiter-uid", "job-1", " ", "SHORTLISTED", () => client), /valid application ID/);
  await assert.rejects(() => reviewTenantApplication(context, "recruiter-uid", "job-1", "application-1", "HIRED", () => client), /decision must be/);
  const missing = fakeClient({ job: null });
  assert.deepEqual(await reviewTenantApplication(context, "recruiter-uid", "missing", "application-1", "REJECTED", () => missing.client), { kind: "not_found" });
});
