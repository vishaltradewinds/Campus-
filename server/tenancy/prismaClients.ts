import { PrismaClient as ControlPlanePrismaClient } from "../../generated/control-plane/index.js";
import { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { tenantDatabaseUrl } from "./tenantResolver";

let controlPlane: ControlPlanePrismaClient | undefined;
const tenantClients = new Map<string, TenantPrismaClient>();
const MAX_TENANT_CLIENTS = 100;

export function getControlPlaneClient(): ControlPlanePrismaClient {
  if (!process.env.CONTROL_DATABASE_URL) throw new Error("CONTROL_DATABASE_URL is not configured");
  controlPlane ??= new ControlPlanePrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  return controlPlane;
}

export function getTenantPrismaClient(context: TenantContext): TenantPrismaClient {
  const existing = tenantClients.get(context.schemaName);
  if (existing) return existing;
  if (tenantClients.size >= MAX_TENANT_CLIENTS) {
    throw new Error("Tenant database client capacity reached; provision connection pooling before onboarding more tenants");
  }
  const baseUrl = process.env.TENANT_DATABASE_URL;
  if (!baseUrl) throw new Error("TENANT_DATABASE_URL is not configured");
  const url = new URL(tenantDatabaseUrl(baseUrl, context.schemaName));
  // Keep the per-tenant pool small. Production must use managed PostgreSQL/PgBouncer sizing validated by load tests.
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "2");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
  const client = new TenantPrismaClient({ datasourceUrl: url.toString(), log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  tenantClients.set(context.schemaName, client);
  return client;
}

export async function disconnectTenantClients(): Promise<void> {
  const clients = [...tenantClients.values()];
  tenantClients.clear();
  await Promise.allSettled(clients.map((client) => client.$disconnect()));
}

export async function disconnectDatabaseClients(): Promise<void> {
  await disconnectTenantClients();
  if (controlPlane) {
    const client = controlPlane;
    controlPlane = undefined;
    await client.$disconnect();
  }
}
