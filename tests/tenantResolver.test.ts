import test from "node:test";
import assert from "node:assert/strict";
import type { NextFunction, Request, Response } from "express";
import { createTenantResolver, getTenantContext, isValidDnsHostname, isValidSchemaName, isValidTenantSlug, tenantDatabaseUrl, tenantSchemaNameForSlug, type TenantRecord } from "../server/tenancy/tenantResolver";

function invoke(host: string | undefined, lookup: (slug: string) => Promise<TenantRecord | null>, baseDomain = "platform.test") {
  const req = { headers: { host, "x-forwarded-host": "evil.platform.test" } } as unknown as Request;
  const locals: Record<string, unknown> = {};
  let statusCode = 200;
  let body: unknown;
  let nextCalled = false;
  const res = {
    locals,
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  const next = (() => { nextCalled = true; }) as NextFunction;
  return createTenantResolver({ baseDomain, lookupTenant: lookup })(req, res, next).then(() => ({ statusCode, body, nextCalled, locals, res }));
}

const activeTenant: TenantRecord = { id: "tenant-1", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" };

test("resolves only the direct tenant subdomain and attaches trusted registry context", async () => {
  const result = await invoke("MIT.platform.test:443", async (slug) => slug === "mit" ? activeTenant : null);
  assert.equal(result.nextCalled, true);
  assert.deepEqual(getTenantContext(result.res), { tenantId: "tenant-1", tenantSlug: "mit", schemaName: "tenant_mit" });
});

test("does not trust X-Forwarded-Host for tenant identity", async () => {
  const result = await invoke("platform.test", async () => activeTenant);
  assert.equal(result.statusCode, 404);
  assert.equal(result.nextCalled, false);
});

test("rejects reserved and nested subdomains", async () => {
  for (const host of ["api.platform.test", "a.b.platform.test", "-mit.platform.test", "mit-.platform.test"]) {
    const result = await invoke(host, async () => activeTenant);
    assert.equal(result.statusCode, 404, host);
    assert.equal(result.nextCalled, false, host);
  }
});

test("rejects unknown, suspended, and malformed registry records", async () => {
  assert.equal((await invoke("mit.platform.test", async () => null)).statusCode, 404);
  assert.equal((await invoke("mit.platform.test", async () => ({ ...activeTenant, status: "SUSPENDED" }))).statusCode, 404);
  assert.equal((await invoke("mit.platform.test", async () => ({ ...activeTenant, schemaName: "mit; DROP SCHEMA public" }))).statusCode, 503);
});

test("fails closed when the tenant registry is unavailable", async () => {
  const result = await invoke("mit.platform.test", async () => { throw new Error("offline"); });
  assert.equal(result.statusCode, 503);
  assert.equal(result.nextCalled, false);
});

test("tenant database URL only accepts PostgreSQL and validated schema identifiers", () => {
  const url = new URL(tenantDatabaseUrl("postgresql://app:secret@localhost:5432/nexus?sslmode=require", "tenant_mit"));
  assert.equal(url.searchParams.get("schema"), "tenant_mit");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.throws(() => tenantDatabaseUrl("https://example.test/db", "tenant_mit"), /PostgreSQL/);
  assert.throws(() => tenantDatabaseUrl("postgresql://localhost/db", "public;drop"), /schema/);
});

test("tenant slugs map deterministically to safe PostgreSQL schema names", () => {
  assert.equal(tenantSchemaNameForSlug("mit"), "tenant_mit");
  assert.equal(tenantSchemaNameForSlug("iit-delhi"), "tenant_iit_delhi");
  assert.equal(isValidTenantSlug("mit-campus"), true);
  assert.equal(isValidTenantSlug("MIT"), false);
  assert.equal(isValidTenantSlug("mit.example"), false);
  assert.equal(isValidDnsHostname("platform.example.com"), true);
  assert.equal(isValidDnsHostname("bad..example.com"), false);
  assert.equal(isValidDnsHostname("https://platform.example.com"), false);
  assert.equal(isValidDnsHostname("-bad.example.com"), false);
  assert.throws(() => createTenantResolver({ baseDomain: "https://platform.example.com", lookupTenant: async () => activeTenant }), /valid DNS hostname/);
  assert.equal(isValidSchemaName("tenant_mit"), true);
  assert.equal(isValidSchemaName("tenant;drop"), false);
  assert.throws(() => tenantSchemaNameForSlug("bad/slug"), /Invalid tenant slug/);
});
