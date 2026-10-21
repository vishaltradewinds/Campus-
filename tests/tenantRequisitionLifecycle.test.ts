import test from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { createTenantRequisition, transitionTenantRequisition } from "../server/tenancy/requisitionLifecycle";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient(authorized = true) {
  const calls: Record<string, any[]> = { create: [], update: [], audit: [], membership: [] };
  let job: any = null;
  const tx = {
    employerRecruiter: { findFirst: async (args: any) => { calls.membership.push(args); return authorized ? { employerId: args.where.employerId || "employer-1" } : null; } },
    jobRequisition: {
      create: async (args: any) => { calls.create.push(args); job = { id: "job-1", ...args.data }; return { id: job.id, status: job.status }; },
      findUnique: async () => job ? { id: job.id, employerId: job.employerId, title: job.title, description: job.description, status: job.status, closesAt: job.closesAt } : null,
      updateMany: async (args: any) => { calls.update.push(args); if (!job || job.id !== args.where.id || job.status !== args.where.status) return { count: 0 }; job = { ...job, ...args.data }; return { count: 1 }; },
    },
    jobRequisitionAuditEvent: { create: async (args: any) => { calls.audit.push(args); return args.data; } },
  };
  const client = { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
  return { client, calls, getJob: () => job };
}

const valid = { employerId: "employer-1", title: "Graduate Software Engineer", description: "Entry-level software engineering position with training." };

test("recruiter creates a draft only for an authorized verified employer and writes audit evidence", async () => {
  const { client, calls, getJob } = fakeClient();
  const result = await createTenantRequisition(context, "recruiter-uid", valid, () => client);
  assert.deepEqual(result, { kind: "created", requisitionId: "job-1", status: "DRAFT" });
  assert.equal(getJob().status, "DRAFT");
  assert.equal(calls.membership[0].where.employer.verification, "VERIFIED");
  assert.equal(calls.audit[0].data.eventType, "DRAFT_CREATED");
});

test("unverified or unrelated employer membership cannot create a requisition", async () => {
  const { client, calls } = fakeClient(false);
  assert.deepEqual(await createTenantRequisition(context, "other-recruiter", valid, () => client), { kind: "not_authorized" });
  assert.equal(calls.create.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("draft can be edited and published with append-only lifecycle evidence", async () => {
  const { client, calls, getJob } = fakeClient();
  await createTenantRequisition(context, "recruiter-uid", valid, () => client);
  assert.deepEqual(await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "edit", title: "Junior Software Engineer" }, () => client), { kind: "updated", requisitionId: "job-1", status: "DRAFT" });
  assert.equal(getJob().title, "Junior Software Engineer");
  assert.deepEqual(await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "publish" }, () => client), { kind: "updated", requisitionId: "job-1", status: "PUBLISHED" });
  assert.ok(getJob().publishedAt instanceof Date);
  assert.deepEqual(calls.audit.map((event) => event.data.eventType), ["DRAFT_CREATED", "DRAFT_EDITED", "PUBLISHED"]);
});

test("published requisition can be closed but cannot be republished or edited", async () => {
  const { client, calls } = fakeClient();
  await createTenantRequisition(context, "recruiter-uid", valid, () => client);
  await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "publish" }, () => client);
  assert.deepEqual(await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "close" }, () => client), { kind: "updated", requisitionId: "job-1", status: "CLOSED" });
  assert.deepEqual(await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "publish" }, () => client), { kind: "invalid_state" });
  assert.deepEqual(await transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "edit", title: "Alter after publish" }, () => client), { kind: "invalid_state" });
  assert.deepEqual(calls.audit.map((event) => event.data.eventType), ["DRAFT_CREATED", "PUBLISHED", "CLOSED"]);
});

test("a missing requisition cannot be mutated by a recruiter", async () => {
  const { client } = fakeClient(false);
  assert.deepEqual(await transitionTenantRequisition(context, "other-recruiter", "missing-job", { action: "publish" }, () => client), { kind: "not_found" });
});

test("invalid fields are rejected before database writes", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => createTenantRequisition(context, "recruiter-uid", { ...valid, title: " " }, () => client), /title must be between/);
  await assert.rejects(() => transitionTenantRequisition(context, "recruiter-uid", "job-1", { action: "invalid" }, () => client), /action must be/);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.update.length, 0);
});
