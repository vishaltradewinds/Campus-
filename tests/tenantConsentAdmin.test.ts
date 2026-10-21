import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { createTenantConsentDraft, publishTenantConsentPolicy, retireTenantConsentPolicy } from "../server/tenancy/consentAdmin";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");
const draft = { id: "policy-1", purpose: "JOB_APPLICATION", version: "v1", contentHash: "sha256:abc", status: "DRAFT", createdBySubject: "author-uid", effectiveAt: new Date("2026-10-21T11:00:00.000Z") };

function createClient(options: { policy?: any; createError?: any } = {}) {
  const calls: Record<string, any> = {};
  const policyModel = {
    create: async (args: unknown) => { calls.create = args; if (options.createError) throw options.createError; return { id: "policy-new", version: "v2", contentHash: (args as any).data.contentHash }; },
    findUnique: async (args: unknown) => { calls.find = args; return options.policy === undefined ? draft : options.policy; },
    updateMany: async (args: unknown) => { calls.updateMany = args; return { count: 1 }; },
    update: async (args: unknown) => { calls.update = args; return { id: "policy-1" }; },
  };
  const auditModel = { create: async (args: unknown) => { calls.audit = [...(calls.audit || []), args]; return { id: "audit-1" }; } };
  const tx = { $queryRawUnsafe: async (...args: unknown[]) => { calls.lock = args; return []; }, applicationConsentPolicy: policyModel, consentPolicyAuditEvent: auditModel };
  const client = {
    applicationConsentPolicy: policyModel,
    consentPolicyAuditEvent: auditModel,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx),
  } as unknown as Pick<TenantPrismaClient, "applicationConsentPolicy" | "consentPolicyAuditEvent" | "$transaction">;
  return { client, calls };
}

test("consent draft hashes the exact content and audits creation", async () => {
  const { client, calls } = createClient();
  const result = await createTenantConsentDraft(context, "admin-uid", {
    version: "v2", content: "Students consent to submit this job application.", effectiveAt: now.toISOString(),
  }, () => client, now);
  assert.equal(result.kind, "created");
  assert.match((result as any).contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal((calls.create as any).data.status, "DRAFT");
  assert.equal((calls.create as any).data.createdBySubject, "admin-uid");
  assert.equal((calls.create as any).data.purpose, "JOB_APPLICATION");
  assert.equal((calls.audit as any[])[0].data.eventType, "DRAFT_CREATED");
});

test("consent drafts reject invalid version, too-short content and past effective date", async () => {
  const { client } = createClient();
  await assert.rejects(() => createTenantConsentDraft(context, "admin", { version: "../bad", content: "A sufficiently long consent text for testing.", effectiveAt: now.toISOString() }, () => client, now), /Consent version/);
  await assert.rejects(() => createTenantConsentDraft(context, "admin", { version: "v1", content: "short", effectiveAt: now.toISOString() }, () => client, now), /Consent content/);
  assert.deepEqual(await createTenantConsentDraft(context, "admin", { version: "v1", content: "A sufficiently long consent text for testing.", effectiveAt: "2020-01-01T00:00:00.000Z" }, () => client, now), { kind: "effective_time_invalid" });
});

test("publish retires previous published policy and writes audit in one transaction", async () => {
  const { client, calls } = createClient();
  const result = await publishTenantConsentPolicy(context, "publisher-uid", "policy-1", () => client, now);
  assert.deepEqual(result, { kind: "published", policyId: "policy-1", version: "v1", contentHash: "sha256:abc" });
  assert.deepEqual(calls.lock, ["SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "CONSENT_POLICY_LIFECYCLE", "JOB_APPLICATION"]);
  assert.equal((calls.updateMany as any).data.status, "RETIRED");
  assert.equal((calls.update as any).data.status, "PUBLISHED");
  assert.equal((calls.audit as any[])[0].data.eventType, "PUBLISHED");
});

test("publishing rejects missing, already published, same-author, and future-effective policies", async () => {
  const missing = createClient({ policy: null });
  assert.deepEqual(await publishTenantConsentPolicy(context, "publisher-uid", "missing", () => missing.client, now), { kind: "not_found" });
  const published = createClient({ policy: { ...draft, status: "PUBLISHED" } });
  assert.deepEqual(await publishTenantConsentPolicy(context, "publisher-uid", "policy-1", () => published.client, now), { kind: "invalid_state" });
  const sameAuthor = createClient();
  assert.deepEqual(await publishTenantConsentPolicy(context, "author-uid", "policy-1", () => sameAuthor.client, now), { kind: "invalid_state" });
  const future = createClient({ policy: { ...draft, effectiveAt: new Date("2026-10-22T00:00:00.000Z") } });
  assert.deepEqual(await publishTenantConsentPolicy(context, "admin", "policy-1", () => future.client, now), { kind: "effective_time_invalid" });
});

test("retirement only applies to published policy and records the actor", async () => {
  const { client, calls } = createClient({ policy: { ...draft, status: "PUBLISHED" } });
  assert.deepEqual(await retireTenantConsentPolicy(context, "admin-uid", "policy-1", () => client, now), { kind: "retired", policyId: "policy-1", version: "v1" });
  assert.deepEqual(calls.lock, ["SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "CONSENT_POLICY_LIFECYCLE", "JOB_APPLICATION"]);
  assert.equal((calls.update as any).data.status, "RETIRED");
  assert.equal((calls.audit as any[])[0].data.eventType, "RETIRED");
  const invalid = createClient({ policy: draft });
  assert.deepEqual(await retireTenantConsentPolicy(context, "admin-uid", "policy-1", () => invalid.client, now), { kind: "invalid_state" });
});
