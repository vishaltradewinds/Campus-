import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import { PrismaClient as ControlPlanePrismaClient } from "../generated/control-plane/index.js";
import { runTenantProvisioningSteps } from "../server/tenancy/provisioningLifecycle";
import { tenantDatabaseUrl } from "../server/tenancy/tenantResolver";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const controlUrl = process.env.CONTROL_DATABASE_URL;
const tenantBaseUrl = process.env.TENANT_DATABASE_URL;
if (!controlUrl || !tenantBaseUrl) throw new Error("CONTROL_DATABASE_URL and TENANT_DATABASE_URL are required for PostgreSQL tenant integration tests");
const schemas = ["tenant_it_alpha", "tenant_it_beta"] as const;
const controlSchema = path.join(root, "prisma", "control-plane", "schema.prisma");
const tenantSchema = path.join(root, "prisma", "tenant", "schema.prisma");
function migrate(schemaPath: string, envName: string, url: string) {
  const cliPath = path.join(root, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [cliPath, "migrate", "deploy", "--schema", schemaPath], {
    cwd: root,
    env: { ...process.env, [envName]: url },
    stdio: "inherit",
  });
}

async function main() {
  const admin = new TenantPrismaClient({ datasourceUrl: tenantDatabaseUrl(tenantBaseUrl, "public"), log: ["error"] });
  const control = new ControlPlanePrismaClient({ datasourceUrl: tenantDatabaseUrl(controlUrl, "public"), log: ["error"] });
  const clients: TenantPrismaClient[] = [];
  const recoverySlug = "tenant-it-provisioning-recovery";
  const recoverySchema = "tenant_it_provisioning";
  let recoveryTenantId: string | undefined;
  try {
    migrate(controlSchema, "CONTROL_DATABASE_URL", controlUrl);
    for (const schema of schemas) {
      await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      migrate(tenantSchema, "TENANT_DATABASE_URL", tenantDatabaseUrl(tenantBaseUrl, schema));
      clients.push(new TenantPrismaClient({ datasourceUrl: tenantDatabaseUrl(tenantBaseUrl, schema), log: ["error"] }));
    }
    const [alpha, beta] = clients;
    await alpha.studentProfile.create({ data: { userSubject: "integration-shared-subject", studentNumber: "ALPHA-001", programme: "Engineering" } });
    assert.equal(await alpha.studentProfile.count(), 1, "tenant alpha should see its own inserted student");
    assert.equal(await beta.studentProfile.count(), 0, "tenant beta must not see tenant alpha records");
    await beta.studentProfile.create({ data: { userSubject: "integration-shared-subject", studentNumber: "BETA-001", programme: "Science" } });
    assert.equal(await beta.studentProfile.count(), 1, "tenant beta should store its own row independently");
    assert.equal(await alpha.studentProfile.count(), 1, "tenant alpha count must remain isolated after beta writes");
    assert.equal((await alpha.studentProfile.findUnique({ where: { userSubject: "integration-shared-subject" } }))?.studentNumber, "ALPHA-001");
    assert.equal((await beta.studentProfile.findUnique({ where: { userSubject: "integration-shared-subject" } }))?.studentNumber, "BETA-001");

    // Verify consent content immutability and append-only audit triggers against real disposable PostgreSQL.
    const employer = await alpha.employer.create({ data: { legalName: "Integration Test Employer", displayName: "Integration Test Employer" } });
    const requisition = await alpha.jobRequisition.create({
      data: { employerId: employer.id, title: "Integration Test Role", description: "Disposable PostgreSQL audit test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 60_000) },
    });
    const policy = await alpha.applicationConsentPolicy.create({
      data: {
        purpose: "JOB_APPLICATION", version: "integration-consent-v1",
        content: "Integration test consent wording, not for real applicants.",
        contentHash: "sha256:integration-test", status: "PUBLISHED",
        effectiveAt: new Date(Date.now() - 60_000), createdBySubject: "integration-author",
        publishedBySubject: "integration-publisher",
      },
    });
    await assert.rejects(
      alpha.applicationConsentPolicy.create({
        data: {
          purpose: "JOB_APPLICATION", version: "integration-consent-v2",
          content: "Second concurrently published policy must be rejected by the database.",
          contentHash: "sha256:integration-test-v2", status: "PUBLISHED",
          effectiveAt: new Date(Date.now() - 60_000), createdBySubject: "integration-author-2",
          publishedBySubject: "integration-publisher-2",
        },
      }),
      /application_consent_policies_one_published_per_purpose_key|unique constraint/i,
      "database must prevent two published consent policies for the same purpose",
    );
    const application = await alpha.jobApplication.create({
      data: { requisitionId: requisition.id, studentSubject: "integration-shared-subject", consentVersion: policy.version },
    });
    const applicationAudit = await alpha.jobApplicationAuditEvent.create({
      data: { applicationId: application.id, eventType: "APPLICATION_SUBMITTED", actorSubject: "integration-shared-subject", consentVersion: policy.version, consentHash: policy.contentHash },
    });
    const consentAudit = await alpha.consentPolicyAuditEvent.create({
      data: { policyId: policy.id, eventType: "PUBLISHED", actorSubject: "integration-publisher", contentHash: policy.contentHash },
    });
    await assert.rejects(alpha.jobApplicationAuditEvent.update({ where: { id: applicationAudit.id }, data: { eventType: "ALTERED" } }), /append-only/i);
    await assert.rejects(alpha.jobApplicationAuditEvent.delete({ where: { id: applicationAudit.id } }), /append-only/i);
    await assert.rejects(alpha.consentPolicyAuditEvent.update({ where: { id: consentAudit.id }, data: { eventType: "ALTERED" } }), /append-only/i);
    await assert.rejects(alpha.consentPolicyAuditEvent.delete({ where: { id: consentAudit.id } }), /append-only/i);
    await assert.rejects(alpha.applicationConsentPolicy.update({ where: { id: policy.id }, data: { content: "tampered consent wording" } }), /immutable/i);
    await assert.rejects(alpha.applicationConsentPolicy.delete({ where: { id: policy.id } }), /cannot be deleted/i);
    const withdrawal = await alpha.studentConsentWithdrawal.create({
      data: { actorSubject: "integration-shared-subject", purpose: "JOB_APPLICATION", policyVersion: policy.version, reason: "integration test only" },
    });
    await assert.rejects(alpha.studentConsentWithdrawal.update({ where: { id: withdrawal.id }, data: { reason: "tampered" } }), /append-only/i);
    await assert.rejects(alpha.studentConsentWithdrawal.delete({ where: { id: withdrawal.id } }), /append-only/i);
    console.log("PASS: PostgreSQL rejects application/consent audit mutation and consent policy content alteration/deletion.");

    // Exercise a database-backed provisioning interruption and retry against the disposable CI database.
    const recoveryTenant = await control.tenant.create({
      data: {
        slug: recoverySlug,
        displayName: "Provisioning Recovery Integration Test",
        schemaName: recoverySchema,
        canonicalHost: "tenant-it-provisioning-recovery.platform.test",
        status: "PROVISIONING",
      },
    });
    recoveryTenantId = recoveryTenant.id;
    await assert.rejects(runTenantProvisioningSteps({
      ensureSchema: async () => { await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${recoverySchema}"`); },
      applyMigrations: async () => { throw new Error("injected migration interruption"); },
      activate: async () => { await control.tenant.update({ where: { id: recoveryTenant.id }, data: { status: "ACTIVE" } }); },
    }), /injected migration interruption/);
    assert.equal((await control.tenant.findUnique({ where: { id: recoveryTenant.id } }))?.status, "PROVISIONING",
      "interrupted provisioning must remain non-active in the control plane");

    await runTenantProvisioningSteps({
      ensureSchema: async () => { await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${recoverySchema}"`); },
      applyMigrations: async () => { migrate(tenantSchema, "TENANT_DATABASE_URL", tenantDatabaseUrl(tenantBaseUrl, recoverySchema)); },
      activate: async () => { await control.tenant.update({ where: { id: recoveryTenant.id }, data: { status: "ACTIVE" } }); },
    });
    assert.equal((await control.tenant.findUnique({ where: { id: recoveryTenant.id } }))?.status, "ACTIVE",
      "successful retry must activate only after the tenant migration succeeds");
    console.log("PASS: database-backed provisioning failure remains PROVISIONING and a successful retry activates last.");

    // Create disposable least-privilege roles in the CI-only PostgreSQL service.
    // These roles intentionally receive privileges on only one tenant schema.
    await admin.$executeRawUnsafe("DROP ROLE IF EXISTS tenant_it_alpha_runtime");
    await admin.$executeRawUnsafe("DROP ROLE IF EXISTS tenant_it_beta_runtime");
    await admin.$executeRawUnsafe("CREATE ROLE tenant_it_alpha_runtime LOGIN PASSWORD 'alpha_test_only_password'");
    await admin.$executeRawUnsafe("CREATE ROLE tenant_it_beta_runtime LOGIN PASSWORD 'beta_test_only_password'");
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA "tenant_it_alpha" TO tenant_it_alpha_runtime');
    await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "tenant_it_alpha" TO tenant_it_alpha_runtime');
    await admin.$executeRawUnsafe('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "tenant_it_alpha" TO tenant_it_alpha_runtime');
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA "tenant_it_beta" TO tenant_it_beta_runtime');
    await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "tenant_it_beta" TO tenant_it_beta_runtime');
    await admin.$executeRawUnsafe('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA "tenant_it_beta" TO tenant_it_beta_runtime');

    const alphaRuntimeUrl = new URL(tenantDatabaseUrl(tenantBaseUrl, "tenant_it_alpha"));
    alphaRuntimeUrl.username = "tenant_it_alpha_runtime";
    alphaRuntimeUrl.password = "alpha_test_only_password";
    const betaRuntimeUrl = new URL(tenantDatabaseUrl(tenantBaseUrl, "tenant_it_beta"));
    betaRuntimeUrl.username = "tenant_it_beta_runtime";
    betaRuntimeUrl.password = "beta_test_only_password";
    const alphaRuntime = new TenantPrismaClient({ datasourceUrl: alphaRuntimeUrl.toString(), log: ["error"] });
    const betaRuntime = new TenantPrismaClient({ datasourceUrl: betaRuntimeUrl.toString(), log: ["error"] });
    try {
      assert.equal(await alphaRuntime.studentProfile.count(), 1, "alpha runtime role can read alpha schema");
      assert.equal(await betaRuntime.studentProfile.count(), 1, "beta runtime role can read beta schema");

      // A tenant runtime role has table DML privileges but is not an owner and cannot bypass the database audit guards.
      await assert.rejects(
        alphaRuntime.jobApplicationAuditEvent.update({ where: { id: applicationAudit.id }, data: { eventType: "RUNTIME_TAMPER" } }),
        /append-only/i,
        "runtime credentials must not mutate application audit history",
      );
      await assert.rejects(
        alphaRuntime.jobApplicationAuditEvent.delete({ where: { id: applicationAudit.id } }),
        /append-only/i,
        "runtime credentials must not delete application audit history",
      );
      await assert.rejects(
        alphaRuntime.studentConsentWithdrawal.delete({ where: { id: withdrawal.id } }),
        /append-only/i,
        "runtime credentials must not delete consent withdrawal evidence",
      );
      await assert.rejects(
        alphaRuntime.applicationConsentPolicy.update({ where: { id: policy.id }, data: { content: "runtime tampering attempt" } }),
        /immutable/i,
        "runtime credentials must not alter consent wording",
      );
      await assert.rejects(
        alphaRuntime.$executeRawUnsafe('ALTER TABLE "job_application_audit_events" DISABLE TRIGGER job_application_audit_events_no_update'),
        /permission denied|must be owner|not owner/i,
        "runtime credentials must not disable audit triggers",
      );
      await assert.rejects(
        alphaRuntime.$executeRawUnsafe("SET session_replication_role = replica"),
        /permission denied|must be superuser|superuser/i,
        "runtime credentials must not use replication role to bypass triggers",
      );
      console.log("PASS: tenant runtime credentials cannot mutate protected audit evidence or disable/bypass database triggers.");
      const alphaAttemptToReadBeta = new TenantPrismaClient({ datasourceUrl: tenantDatabaseUrl(alphaRuntimeUrl.toString(), "tenant_it_beta"), log: ["error"] });
      try {
        await assert.rejects(alphaAttemptToReadBeta.studentProfile.count(), /permission denied|does not exist|not authorized/i,
          "alpha runtime credentials must not read beta schema");
      } finally {
        await alphaAttemptToReadBeta.$disconnect();
      }
      const betaAttemptToReadAlpha = new TenantPrismaClient({ datasourceUrl: tenantDatabaseUrl(betaRuntimeUrl.toString(), "tenant_it_alpha"), log: ["error"] });
      try {
        await assert.rejects(betaAttemptToReadAlpha.studentProfile.count(), /permission denied|does not exist|not authorized/i,
          "beta runtime credentials must not read alpha schema");
      } finally {
        await betaAttemptToReadAlpha.$disconnect();
      }
      console.log("PASS: schema-scoped data separation and bidirectional PostgreSQL least-privilege cross-schema denial.");
    } finally {
      await Promise.allSettled([alphaRuntime.$disconnect(), betaRuntime.$disconnect()]);
      await admin.$executeRawUnsafe("DROP OWNED BY tenant_it_alpha_runtime");
      await admin.$executeRawUnsafe("DROP OWNED BY tenant_it_beta_runtime");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS tenant_it_alpha_runtime");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS tenant_it_beta_runtime");
    }
  } finally {
    await Promise.allSettled(clients.map((client) => client.$disconnect()));
    if (recoveryTenantId) {
      await control.tenant.deleteMany({ where: { id: recoveryTenantId } });
    }
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${"tenant_it_provisioning"}" CASCADE`);
    for (const schema of schemas) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await Promise.allSettled([admin.$disconnect(), control.$disconnect()]);
  }
}

main().catch((error) => { console.error("PostgreSQL tenant integration test failed", error); process.exitCode = 1; });
