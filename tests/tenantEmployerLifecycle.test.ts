import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { changeTenantEmployerStatus, onboardTenantEmployer, verifyTenantEmployer } from "../server/tenancy/employerLifecycle";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient() {
  const calls: Record<string, any[]> = { employerCreate: [], auditCreate: [], employerUpdate: [], employerUpdateMany: [] };
  let stored: { id: string; verification: string } | null = null;
  const tx = {
    employer: {
      create: async (args: any) => { calls.employerCreate.push(args); stored = { id: "employer-1", verification: "PENDING" }; return stored; },
      findUnique: async () => stored,
      update: async (args: any) => { calls.employerUpdate.push(args); if (stored) stored = { ...stored, verification: args.data.verification }; return stored; },
      updateMany: async (args: any) => {
        calls.employerUpdateMany.push(args);
        if (!stored) return { count: 0 };
        const expected = args.where.verification;
        const matches = typeof expected === "string" ? stored.verification === expected : expected?.in?.includes(stored.verification);
        if (!matches) return { count: 0 };
        stored = { ...stored, verification: args.data.verification };
        return { count: 1 };
      },
    },
    employerAuditEvent: {\n      create: async (args: any) => { calls.auditCreate.push(args); return args.data; },\n      findFirst: async (args: any) => { const event = calls.auditCreate.map((entry) => entry.data).find((data) => data.employerId === args.where.employerId && data.eventType === args.where.eventType); return event ? { actorSubject: event.actorSubject } : null; },\n    },
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
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "employer-1", { reason: "Official registry evidence reviewed and matched.", evidenceReference: "MCA:company-master:123" }, () => client), { kind: "verified", employerId: "employer-1" });
  assert.deepEqual(calls.employerUpdateMany[0], { where: { id: "employer-1", verification: "PENDING" }, data: { verification: "VERIFIED" } });
  assert.equal(calls.auditCreate[1].data.eventType, "VERIFIED");
  assert.equal(calls.auditCreate[1].data.actorSubject, "university-admin-uid");\n  assert.equal(calls.auditCreate[1].data.metadata.evidenceReference, "MCA:company-master:123");
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "employer-1", () => client), { kind: "invalid_state" });
});


test("pending employers can be rejected with reason and evidence reference", async () => {
  const { client, calls, getStored } = fakeClient();
  await onboardTenantEmployer(context, "recruiter-uid", { legalName: "Example Technologies Pvt Ltd", displayName: "Example Tech" }, () => client);
  assert.deepEqual(await changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "reject", {
    reason: "Registration evidence did not match the submitted legal entity.",
    evidenceReference: "registry-review:case-2026-001",
  }, () => client), { kind: "rejected", employerId: "employer-1", verification: "REJECTED" });
  assert.equal(getStored()?.verification, "REJECTED");
  assert.equal(calls.auditCreate[1].data.eventType, "REJECTED");
  assert.equal(calls.auditCreate[1].data.metadata.evidenceReference, "registry-review:case-2026-001");
  assert.equal(calls.auditCreate[1].data.metadata.reason, "Registration evidence did not match the submitted legal entity.");
});

test("verified employers can be suspended or revoked, with stale or invalid transitions rejected", async () => {
  const { client, calls, getStored } = fakeClient();
  await onboardTenantEmployer(context, "recruiter-uid", { legalName: "Example Technologies Pvt Ltd", displayName: "Example Tech" }, () => client);
  await verifyTenantEmployer(context, "university-admin-uid", "employer-1", () => client);
  assert.deepEqual(await changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "suspend", {
    reason: "Compliance review requires temporary suspension.",
    evidenceReference: "review-case:2026-002",
  }, () => client), { kind: "suspended", employerId: "employer-1", verification: "SUSPENDED" });
  assert.equal(getStored()?.verification, "SUSPENDED");
  assert.deepEqual(await changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "revoke", {
    reason: "The verified employer status is revoked after review.",
    evidenceReference: "review-case:2026-002",
  }, () => client), { kind: "revoked", employerId: "employer-1", verification: "REVOKED" });
  assert.equal(calls.auditCreate[2].data.eventType, "SUSPENDED");
  assert.equal(calls.auditCreate[3].data.eventType, "REVOKED");
  assert.deepEqual(await changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "suspend", {
    reason: "A later suspension is not allowed.",
    evidenceReference: "review-case:2026-003",
  }, () => client), { kind: "invalid_state" });
});

test("employer status actions require bounded reason and evidence reference", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "reject", {
    reason: "short", evidenceReference: "evidence-1",
  }, () => client), /Reason must be/);
  await assert.rejects(() => changeTenantEmployerStatus(context, "university-admin-uid", "employer-1", "reject", {
    reason: "A valid reason of sufficient length.", evidenceReference: " ",
  }, () => client), /Evidence reference/);
});


test("verification requires independent reviewer and evidence, and rejects self-approval", async () => {
  const { client, calls } = fakeClient();
  await onboardTenantEmployer(context, "recruiter-uid", { legalName: "Example Technologies Pvt Ltd", displayName: "Example Tech" }, () => client);
  assert.deepEqual(await verifyTenantEmployer(context, "recruiter-uid", "employer-1", { reason: "Official registry evidence reviewed and matched.", evidenceReference: "MCA:company-master:123" }, () => client), { kind: "invalid_state" });
  assert.equal(calls.employerUpdateMany.length, 0);
  await assert.rejects(() => verifyTenantEmployer(context, "university-admin-uid", "employer-1", { reason: "short", evidenceReference: "" }, () => client), /Reason must be/);
  assert.equal(calls.employerUpdateMany.length, 0);
});

test("verification reports missing employer without mutating state", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await verifyTenantEmployer(context, "university-admin-uid", "missing", () => ({
    ...client,
    $transaction: async (callback: (tx: any) => unknown) => callback({
      employer: { findUnique: async () => null, update: async () => { throw new Error("must not update"); } },
      employerAuditEvent: { create: async () => { throw new Error("must not audit"); }, findFirst: async () => null },
    }),
  } as any)), { kind: "not_found" });
  assert.equal(calls.employerUpdate.length, 0);
});
