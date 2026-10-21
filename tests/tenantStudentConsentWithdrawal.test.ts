import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { withdrawTenantStudentConsent } from "../server/tenancy/studentConsentWithdrawal";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient(options: { policy?: any; existing?: any; createError?: any } = {}) {
  const calls: Record<string, any> = {};
  const withdrawalModel = {
    findUnique: async (args: unknown) => { calls.findWithdrawal = args; return options.existing ?? null; },
    create: async (args: unknown) => { calls.createWithdrawal = args; if (options.createError) throw options.createError; return { id: "withdrawal-1", policyVersion: "v1" }; },
  };
  const tx = {
    $queryRawUnsafe: async (...args: unknown[]) => { calls.lock = args; return []; },
    studentConsentWithdrawal: withdrawalModel,
  };
  const client = {
    applicationConsentPolicy: { findFirst: async (args: unknown) => { calls.findPolicy = args; return options.policy === undefined ? { version: "v1" } : options.policy; } },
    studentConsentWithdrawal: withdrawalModel,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx),
  } as unknown as Pick<TenantPrismaClient, "applicationConsentPolicy" | "studentConsentWithdrawal" | "$transaction">;
  return { client, calls };
}

test("withdrawal records the authenticated subject and a durable reason", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await withdrawTenantStudentConsent(context, "student-uid", "v1", "I no longer agree", () => client), {
    kind: "withdrawn", withdrawalId: "withdrawal-1", policyVersion: "v1",
  });
  assert.deepEqual((calls.findPolicy as any).where, { purpose: "JOB_APPLICATION", version: "v1", status: { in: ["PUBLISHED", "RETIRED"] } });
  assert.deepEqual(calls.lock, ["SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "student-uid", "JOB_APPLICATION"]);
  assert.deepEqual((calls.createWithdrawal as any).data, { actorSubject: "student-uid", purpose: "JOB_APPLICATION", policyVersion: "v1", reason: "I no longer agree" });
});

test("withdrawal is idempotent and unknown consent version is rejected", async () => {
  const existing = fakeClient({ existing: { id: "withdrawal-existing", policyVersion: "v1" } });
  assert.deepEqual(await withdrawTenantStudentConsent(context, "student-uid", "v1", undefined, () => existing.client), {
    kind: "already_withdrawn", withdrawalId: "withdrawal-existing", policyVersion: "v1",
  });
  const missing = fakeClient({ policy: null });
  assert.deepEqual(await withdrawTenantStudentConsent(context, "student-uid", "v2", undefined, () => missing.client), { kind: "policy_not_found" });
});

test("invalid identity, version and reason fail safely", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => withdrawTenantStudentConsent(context, " ", "v1", undefined, () => client), /Authenticated user subject/);
  await assert.rejects(() => withdrawTenantStudentConsent(context, "student-uid", "../v1", undefined, () => client), /consent version/);
  await assert.rejects(() => withdrawTenantStudentConsent(context, "student-uid", "v1", "x".repeat(501), () => client), /500 characters/);
});
