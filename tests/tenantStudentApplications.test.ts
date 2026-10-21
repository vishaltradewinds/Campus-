import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { applyToTenantJob } from "../server/tenancy/studentApplications";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");
const profile = { graduationYear: 2027, programme: "BTech" };
const job = { id: "job-1", status: "PUBLISHED", eligibleYears: [2027], eligiblePrograms: ["BTech"], publishedAt: new Date("2026-10-01T00:00:00.000Z"), closesAt: new Date("2026-11-01T00:00:00.000Z") };

function fakeClient(options: { profile?: any; job?: any; existing?: any; createError?: any } = {}) {
  const calls: { profile?: unknown; job?: unknown; existing?: unknown; create?: unknown } = {};
  const client = {
    studentProfile: { findUnique: async (args: unknown) => { calls.profile = args; return options.profile === undefined ? profile : options.profile; } },
    jobRequisition: { findUnique: async (args: unknown) => { calls.job = args; return options.job === undefined ? job : options.job; } },
    jobApplication: {
      findUnique: async (args: unknown) => { calls.existing = args; return options.existing ?? null; },
      create: async (args: unknown) => { calls.create = args; if (options.createError) throw options.createError; return { id: "application-1" }; },
    },
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobRequisition" | "jobApplication">;
  return { client, calls };
}

test("eligible student applies with explicit consent version and tenant-scoped identity", async () => {
  const { client, calls } = fakeClient();
  const result = await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now);
  assert.deepEqual(result, { kind: "applied", applicationId: "application-1" });
  assert.deepEqual(calls.profile, { where: { userSubject: "firebase-uid" }, select: { graduationYear: true, programme: true } });
  assert.deepEqual((calls.existing as any).where.requisitionId_studentSubject, { requisitionId: "job-1", studentSubject: "firebase-uid" });
  assert.deepEqual(calls.create, { data: { requisitionId: "job-1", studentSubject: "firebase-uid", consentVersion: "consent-v1", status: "APPLIED" }, select: { id: true } });
});

test("existing application is returned idempotently without creating a duplicate", async () => {
  const { client, calls } = fakeClient({ existing: { id: "application-existing" } });
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "already_applied", applicationId: "application-existing" });
  assert.equal(calls.create, undefined);
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
  await assert.rejects(() => applyToTenantJob(context, " ", "job-1", "consent-v1"), /Authenticated user subject/);
  await assert.rejects(() => applyToTenantJob(context, "firebase-uid", "job-1", " "), /consent version/);
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
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobRequisition" | "jobApplication">;
  assert.deepEqual(await applyToTenantJob(context, "firebase-uid", "job-1", "consent-v1", () => client, now), { kind: "already_applied", applicationId: "raced-application" });
});
