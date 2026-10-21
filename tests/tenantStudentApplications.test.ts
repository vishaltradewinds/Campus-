import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { applyToTenantJob } from "../server/tenancy/studentApplications";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");
const profile = { graduationYear: 2027, programme: "BTech" };
const job = { id: "job-1", status: "PUBLISHED", eligibleYears: [2027], eligiblePrograms: ["BTech"], publishedAt: new Date("2026-10-01T00:00:00.000Z"), closesAt: new Date("2026-11-01T00:00:00.000Z") };
const policy = { version: "consent-v1", contentHash: "sha256:example" };

function fakeClient(options: { profile?: any; job?: any; existing?: any; policy?: any; withdrawal?: any; transactionPolicy?: any; createError?: any } = {}) {
  const calls: { profile?: unknown; job?: unknown; existing?: unknown; policy?: unknown; create?: unknown; audit?: unknown; locks?: unknown[]; transactionPolicy?: unknown } = {};
  const withdrawalModel = { findUnique: async () => options.withdrawal ?? null };
  const applicationModel = {
    findUnique: async (args: unknown) => { calls.existing = args; return options.existing ?? null; },
    create: async (args: unknown) => { calls.create = args; if (options.createError) throw options.createError; return { id: "application-1" }; },
  };
  const tx = {
    $queryRawUnsafe: async (...args: unknown[]) => { calls.locks = [...(calls.locks || []), args]; return []; },
    applicationConsentPolicy: { findFirst: async (args: unknown) => { calls.transactionPolicy = args; return options.transactionPolicy !== undefined ? options.transactionPolicy : (options.policy === undefined ? policy : options.policy); } },
    studentConsentWithdrawal: withdrawalModel,
    jobApplication: applicationModel,
    jobApplicationAuditEvent: { create: async (args: unknown) => { calls.audit = args; return { id: "audit-1" }; } },
  };
  const client = {
    studentProfile: { findUnique: async (args: unknown) => { calls.profile = args; return options.profile === undefined ? profile : options.profile; } },
    jobRequisition: { findUnique: async (args: unknown) => { calls.job = args; return options.job === undefined ? job : options.job; } },
    jobApplication: applicationModel,
    applicationConsentPolicy: { findFirst: async (args: unknown) => { calls.policy = args; return options.policy === undefined ? policy : options.policy; } },
    studentConsentWithdrawal: withdrawalModel,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx),
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobRequisition" | "jobApplication" | "applicationConsentPolicy" | "studentConsentWithdrawal" | "$transaction">;
  return { client, calls };
}

test("eligible student applies with a published consent version and atomic audit event", async () => {
  const { client, calls } = fakeClient();
  const result = await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now);
  assert.deepEqual(result, { kind: "applied", applicationId: "application-1" });
  assert.deepEqual(calls.profile, { where: { userSubject: "firebase-uid" }, select: { graduationYear: true, programme: true } });
  assert.deepEqual((calls.existing as any).where.requisitionId_studentSubject, { requisitionId: "job-1", studentSubject: "firebase-uid" });
  assert.deepEqual(calls.policy, { where: { purpose: "JOB_APPLICATION", version: "consent-v1", status: "PUBLISHED", effectiveAt: { lte: now }, OR: [{ retiredAt: null }, { retiredAt: { gt: now } }] }, select: { version: true, contentHash: true } });
  assert.deepEqual(calls.locks, [
    ["SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "CONSENT_POLICY_LIFECYCLE", "JOB_APPLICATION"],
    ["SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "firebase-uid", "JOB_APPLICATION"],
  ]);
  assert.deepEqual(calls.transactionPolicy, calls.policy);
  assert.deepEqual(calls.create, { data: { requisitionId: "job-1", studentSubject: "firebase-uid", consentVersion: "consent-v1", status: "APPLIED" }, select: { id: true } });
  assert.deepEqual(calls.audit, { data: { applicationId: "application-1", eventType: "APPLICATION_SUBMITTED", actorSubject: "firebase-uid", consentVersion: "consent-v1", consentHash: "sha256:example", metadata: { tenantId: "tenant-mit", requisitionId: "job-1" } } });
});

test("existing application is returned idempotently without creating a duplicate", async () => {
  const { client, calls } = fakeClient({ existing: { id: "application-existing" } });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "already_applied", applicationId: "application-existing" });
  assert.equal(calls.create, undefined);
  assert.equal(calls.audit, undefined);
});

test("ineligible student cannot apply", async () => {
  const { client, calls } = fakeClient({ profile: { graduationYear: 2026, programme: "BTech" } });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "ineligible" });
  assert.equal(calls.create, undefined);
});

test("closed or unpublished job cannot be applied to", async () => {
  for (const jobState of [
    { ...job, status: "DRAFT" },
    { ...job, closesAt: new Date("2026-10-20T00:00:00.000Z") },
    { ...job, publishedAt: null },
  ]) {
    const { client, calls } = fakeClient({ job: jobState });
    assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "closed" });
    assert.equal(calls.create, undefined);
  }
});

test("missing profile, blank subject, and missing consent fail safely", async () => {
  const noProfile = fakeClient({ profile: null });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => noProfile.client, now), { kind: "not_found" });
  const noConsent = fakeClient({ policy: null });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => noConsent.client, now), { kind: "consent_unavailable" });
  await assert.rejects(() => applyToTenantJob(context, " ", "job-1", "consent-v1"), /Authenticated user subject/);
  await assert.rejects(() => applyToTenantJob(context, "firebase-uid", "job-1", " "), /consent version/);
});

test("application rechecks consent after acquiring the policy lifecycle lock", async () => {
  const { client, calls } = fakeClient({ transactionPolicy: null });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "consent_unavailable" });
  assert.equal(calls.create, undefined);
  assert.equal(calls.audit, undefined);
  assert.equal((calls.locks || []).length, 1);
});

test("withdrawn consent version blocks new applications", async () => {
  const { client, calls } = fakeClient({ withdrawal: { id: "withdrawal-1" } });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "consent_withdrawn" });
  assert.equal(calls.create, undefined);
});

test("unique-constraint race resolves to the existing application", async () => {
  let lookupCount = 0;
  const client = {
    studentProfile: { findUnique: async () => profile },
    jobRequisition: { findUnique: async () => job },
    jobApplication: {
      findUnique: async () => { lookupCount += 1; return lookupCount === 1 ? null : { id: "raced-application" }; },
      create: async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); },
    },
    applicationConsentPolicy: { findFirst: async () => policy },
    studentConsentWithdrawal: { findUnique: async () => null },
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback({
      $queryRawUnsafe: async () => [],
      applicationConsentPolicy: { findFirst: async () => policy },
      studentConsentWithdrawal: { findUnique: async () => null },
      jobApplication: { create: async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); } },
      jobApplicationAuditEvent: { create: async () => ({ id: "audit-1" }) },
    }),
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobRequisition" | "jobApplication" | "applicationConsentPolicy" | "studentConsentWithdrawal" | "$transaction">;
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "already_applied", applicationId: "raced-application" });
});
