import type { TenantRecord } from "./tenantResolver";
import { getControlPlaneClient } from "./prismaClients";

export async function findTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const tenant = await getControlPlaneClient().tenant.findUnique({ where: { slug } });
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
    status: tenant.status,
    canonicalHost: tenant.canonicalHost,
  };
}
