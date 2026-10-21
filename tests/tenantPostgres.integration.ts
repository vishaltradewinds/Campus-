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
    console.log("PASS: PostgreSQL tenant schemas keep same-key student records and reads isolated across schema-scoped Prisma clients.");
  } finally {
    await Promise.allSettled(clients.map((client) => client.$disconnect()));
    for (const schema of schemas) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => { console.error("PostgreSQL tenant integration test failed", error); process.exitCode = 1; });
