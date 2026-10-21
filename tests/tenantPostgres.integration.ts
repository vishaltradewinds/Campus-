import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
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
  const clients: TenantPrismaClient[] = [];
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
    for (const schema of schemas) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => { console.error("PostgreSQL tenant integration test failed", error); process.exitCode = 1; });
