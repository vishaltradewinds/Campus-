import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { onboardTenantEmployer, verifyTenantEmployer } from "../server/tenancy/employerLifecycle";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient() {
  const calls: Record<string, any[]> = { employerCreate: [], auditCreate: [], employerUpdate: [] };
  let stored: { id: string; verification: string } | null = null;
  const tx = {
    employer: {
      create: async (args: any) => { calls.employerCreate.push(args); stored = { id: "employer-1", verification: "PENDING" }; return stored; },
      findUnique: async () => stored,
      update: async (args: any) => { calls.employerUpdate.push(args); if (stored) stored = { ...stored, verification: args.data.verification }; return stored; },
    },
    employerAuditEvent: { create: async (args: any) => { calls.auditCreate.push(args); return args.data; } },
  };
  const client = { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as Pick<TenantPrismaClient, "employer" | "employerRecruiter" | "employerAuditEvent" | "$transaction">;
  return { client, calls, getStored: () => stored };
}

test("onboarding creates a pending employer, assigns the submitting recruiter and writes audit evidence", async () => {
  const { client, calls } = fakeClient();
  const result = await onboardTenantEmployer(context, "recruiter-uid", { legalName: "Example Technologies Pvt Ltd", displayName: "Example Tech" }, () => client);
  assert.deepEqual(result, { kind: "created", employerId: "employer-1", verification: "PENDING" });
  assert.equal(calls.employerCreate[0].data.verification, "PENDING");
  assert.deepEqual(calls.employerCreate[0].data.recruiters.create, { userSubject: "recruiter-uid", role: "RECRUITER" });
  assert.equal(calls.auditCreate[0].data.eventType, "ONBOARDING_SUBMITTED");
  assert.equal(calls.auditCreate.length, 1);
});

test("onboarding rejects invalid fields before writing", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(() => onboardTenantEmployer(context, "recruiter-uid", { legalName: " ", displayName: "x" }, () => client), /Legal name/);
  assert.equal(calls.employerCreate.length, 0);
});

test("university verification transitions only pending employers and records the actor", async () => {
  const { client, calls } = fakeClient();
  await onboardTenantEmployer(context, "recruiter-uid", { legalName: "Example Technologies Pvt Ltd", displayName: "Example Tech" }, () => client);
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "employer-1", () => client), { kind: "verified", employerId: "employer-1" });
  assert.deepEqual(calls.employerUpdate[0], { where: { id: "employer-1" }, data: { verification: "VERIFIED" } });
  assert.equal(calls.auditCreate[1].data.eventType, "VERIFIED");
  assert.equal(calls.auditCreate[1].data.actorSubject, "university-admin-uid");
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "employer-1", () => client), { kind: "invalid_state" });
});

test("verification reports missing employer without mutating state", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "missing", () => ({
    ...client,
    $transaction: async (callback: (tx: any) => unknown) => callback({
      employer: { findUnique: async () => null, update: async () => { throw new Error("must not update"); } },
      employerAuditEvent: { create: async () => { throw new Error("must not audit"); } },
    }),
  } as any)), { kind: "not_found" });
  assert.equal(calls.employerUpdate.length, 0);
});
