import type { NextFunction, Request, Response } from "express";

export interface TenantRecord {
  id: string;
  slug: string;
  schemaName: string;
  status: "ACTIVE" | "SUSPENDED" | "PROVISIONING" | "ARCHIVED";
  canonicalHost?: string | null;
}

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
}

export type TenantLookup = (slug: string) => Promise<TenantRecord | null>;

export interface TenantResolverOptions {
  baseDomain: string;
  lookupTenant: TenantLookup;
  reservedSubdomains?: string[];
}

const SAFE_SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/;
const SAFE_TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DEFAULT_RESERVED = ["www", "api", "admin", "app", "platform", "status", "docs"];
const SAFE_DNS_HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

export function isValidDnsHostname(hostname: string): boolean {
  return SAFE_DNS_HOSTNAME.test(hostname) && hostname.includes(".");
}

export function isValidTenantSlug(slug: string): boolean {
  return SAFE_TENANT_SLUG.test(slug) && !slug.includes(".");
}

export function isValidSchemaName(schemaName: string): boolean {
  return SAFE_SCHEMA_NAME.test(schemaName);
}

export function tenantSchemaNameForSlug(slug: string): string {
  if (!isValidTenantSlug(slug)) throw new Error("Invalid tenant slug");
  const schemaName = "tenant_" + slug.replace(/-/g, "_");
  if (!isValidSchemaName(schemaName)) throw new Error("Generated tenant schema name is invalid");
  return schemaName;
}

function normalizedHostname(hostHeader: string | undefined): string | null {
  if (!hostHeader || hostHeader.length > 255 || !/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(hostHeader)) return null;
  try {
    const parsed = new URL(`http://${hostHeader}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/") return null;
    return parsed.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function createTenantResolver(options: TenantResolverOptions) {
  const baseDomain = options.baseDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!isValidDnsHostname(baseDomain)) {
    throw new Error("TENANT_BASE_DOMAIN must be a valid DNS hostname, not a URL or host:port");
  }
  const reserved = new Set([...(options.reservedSubdomains ?? DEFAULT_RESERVED)].map((item) => item.toLowerCase()));

  return async function resolveTenant(req: Request, res: Response, next: NextFunction) {
    const hostname = normalizedHostname(req.headers.host);
    if (!hostname) return res.status(400).json({ error: "Invalid request host" });
    const suffix = `.${baseDomain}`;
    if (!hostname.endsWith(suffix)) return res.status(404).json({ error: "Tenant host not recognized" });
    const slug = hostname.slice(0, -suffix.length);
    if (!isValidTenantSlug(slug) || reserved.has(slug)) {
      return res.status(404).json({ error: "Tenant host not recognized" });
    }

    let tenant: TenantRecord | null;
    try {
      tenant = await options.lookupTenant(slug);
    } catch (error) {
      console.error("Tenant registry lookup failed", error);
      return res.status(503).json({ error: "Tenant registry unavailable" });
    }
    if (!tenant || tenant.slug !== slug || tenant.status !== "ACTIVE") {
      return res.status(404).json({ error: "Tenant is unavailable" });
    }
    if (!isValidSchemaName(tenant.schemaName)) {
      console.error("Tenant registry contains an invalid schema identifier", { tenantId: tenant.id });
      return res.status(503).json({ error: "Tenant configuration is invalid" });
    }
    if (tenant.canonicalHost && normalizedHostname(tenant.canonicalHost) !== hostname) {
      return res.status(404).json({ error: "Tenant host not recognized" });
    }

    res.locals.tenant = Object.freeze({ tenantId: tenant.id, tenantSlug: tenant.slug, schemaName: tenant.schemaName }) satisfies TenantContext;
    return next();
  };
}

export function getTenantContext(res: Response): TenantContext {
  const context = res.locals.tenant as TenantContext | undefined;
  if (!context) throw new Error("Tenant context is required for this operation");
  return context;
}

export function tenantDatabaseUrl(baseUrl: string, schemaName: string): string {
  if (!isValidSchemaName(schemaName)) throw new Error("Invalid tenant schema identifier");
  const url = new URL(baseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Tenant database URL must use PostgreSQL");
  url.searchParams.set("schema", schemaName);
  return url.toString();
}
