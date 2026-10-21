import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient as ControlPlanePrismaClient } from "../generated/control-plane/index.js";
import { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import { disconnectDatabaseClients } from "../server/tenancy/prismaClients";
import { isValidDnsHostname, isValidTenantSlug, tenantDatabaseUrl, tenantSchemaNameForSlug } from "../server/tenancy/tenantResolver";

const require = createRequire(import.meta.url);

interface ProvisioningArgs {
  slug: string;
  displayName: string;
}

function parseArgs(argv: string[]): ProvisioningArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key !== "--slug" && key !== "--display-name") throw new Error(`Unknown argument: ${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    if (values.has(key)) throw new Error(`Duplicate argument: ${key}`);
    values.set(key, value);
    i += 1;
  }
  const slug = values.get("--slug")?.trim().toLowerCase();
  const displayName = values.get("--display-name")?.trim();
  if (!slug || !isValidTenantSlug(slug)) throw new Error("--slug must be a lowercase alphanumeric tenant slug with optional internal hyphens");
  if (!displayName || displayName.length > 160) throw new Error("--display-name must contain 1–160 characters");
  return { slug, displayName };
}

function runPrismaMigrate(schemaPath: string, env: NodeJS.ProcessEnv): void {
  // Invoke the locally pinned Prisma CLI directly; no shell interpolation of user input.
  const cliPath = require.resolve("prisma");
  execFileSync(process.execPath, [cliPath, "migrate", "deploy", "--schema", schemaPath], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    env,
    stdio: "inherit",
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const controlMigrationUrl = process.env.CONTROL_MIGRATION_DATABASE_URL;
  const tenantMigrationUrl = process.env.TENANT_MIGRATION_DATABASE_URL;
  const controlRuntimeUrl = process.env.CONTROL_DATABASE_URL;
  const tenantRuntimeUrl = process.env.TENANT_DATABASE_URL;
  const baseDomain = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase();
  if (!controlMigrationUrl || !tenantMigrationUrl || !controlRuntimeUrl || !tenantRuntimeUrl || !baseDomain) {
    throw new Error("Set CONTROL_DATABASE_URL, CONTROL_MIGRATION_DATABASE_URL, TENANT_DATABASE_URL, TENANT_MIGRATION_DATABASE_URL and TENANT_BASE_DOMAIN before provisioning");
  }
  if (!isValidDnsHostname(baseDomain)) {
    throw new Error("TENANT_BASE_DOMAIN must be a bare DNS hostname");
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const controlSchema = path.join(root, "prisma", "control-plane", "schema.prisma");
  const tenantSchema = path.join(root, "prisma", "tenant", "schema.prisma");
  const schemaName = tenantSchemaNameForSlug(args.slug);
  const canonicalHost = `${args.slug}.${baseDomain}`;

  // Control-plane tables must exist before a tenant registry record can be created.
  runPrismaMigrate(controlSchema, {
    ...process.env,
    CONTROL_DATABASE_URL: tenantDatabaseUrl(controlMigrationUrl, "public"),
  });

  const control = new ControlPlanePrismaClient({ datasourceUrl: tenantDatabaseUrl(controlMigrationUrl, "public"), log: ["error"] });
  try {
    let tenant = await control.tenant.findUnique({ where: { slug: args.slug } });
    if (tenant && tenant.schemaName !== schemaName) throw new Error("Existing tenant schema name does not match the deterministic tenant schema mapping");
    if (tenant && tenant.status !== "PROVISIONING") throw new Error(`Tenant already exists with status ${tenant.status}; refusing to overwrite it`);
    if (!tenant) {
      tenant = await control.tenant.create({
        data: { slug: args.slug, displayName: args.displayName, schemaName, canonicalHost, status: "PROVISIONING" },
      });
    }

    const schemaAdmin = new TenantPrismaClient({ datasourceUrl: tenantDatabaseUrl(tenantMigrationUrl, "public"), log: ["error"] });
    try {
      // DDL is permitted only in this explicit operator-run CLI. The identifier is generated and regex-validated above.
      await schemaAdmin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    } finally {
      await schemaAdmin.$disconnect();
    }

    // Prisma uses the validated schema query parameter to create the migration ledger and tables inside this tenant schema.
    runPrismaMigrate(tenantSchema, {
      ...process.env,
      TENANT_DATABASE_URL: tenantDatabaseUrl(tenantMigrationUrl, schemaName),
    });

    await control.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
    console.log(`Tenant ${args.slug} provisioned and marked ACTIVE. Host: ${canonicalHost}. Schema: ${schemaName}.`);
  } finally {
    await control.$disconnect();
  }
  await disconnectDatabaseClients();
}

main().catch(async (error: unknown) => {
  console.error("Tenant provisioning failed. The tenant will not be marked ACTIVE unless all migrations succeed.", error instanceof Error ? error.message : "Unknown error");
  try { await disconnectDatabaseClients(); } catch { /* preserve the original provisioning error */ }
  process.exitCode = 1;
});
