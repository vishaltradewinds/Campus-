import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantConsentAdminHandler } from "../server/tenancy/consentAdmin";

const tenants = {
  mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const },
  iit: { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" as const },
};
let role = "UNIVERSITY_ADMIN";
let membershipTenantId = "tenant-mit";
let membershipStatus = "ACTIVE";
let identityStatus = "ACTIVE";
const actions: Array<{ action: string; tenantId: string; uid: string; body?: unknown; policyId?: string }> = [];

const controlClient = {
  userIdentity: {
    findUnique: async (args: unknown) => ({
      status: identityStatus,
      platformRole: null,
      memberships: membershipStatus === "ACTIVE" && membershipTenantId === (args as any).select.memberships.where.tenantId
        ? [{ role, status: "ACTIVE" }]
        : [],
    }),
  },
} as any;

const app = express();
app.use(express.json());
const resolver = createTenantResolver({
  baseDomain: "platform.test",
  lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null,
});
const authenticateTestIdentity: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-test-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "firebase-admin-1" };
  next();
};
const auth = requireTenantAuthorization({ allowedRoles: ["UNIVERSITY_ADMIN"] }, () => controlClient);

const create = (async (context: any, uid: string, body: any) => {
  actions.push({ action: "create", tenantId: context.tenantId, uid, body });
  return { kind: "created", policyId: "policy-1", version: body.version, contentHash: "sha256:test" };
}) as any;
const publish = (async (context: any, uid: string, policyId: string) => {
  actions.push({ action: "publish", tenantId: context.tenantId, uid, policyId });
  return { kind: "published", policyId, version: "v1", contentHash: "sha256:test" };
}) as any;
const retire = (async (context: any, uid: string, policyId: string) => {
  actions.push({ action: "retire", tenantId: context.tenantId, uid, policyId });
  return { kind: "retired", policyId, version: "v1" };
}) as any;

app.post("/api/tenant/admin/consent-policies", resolver, authenticateTestIdentity, auth, createTenantConsentAdminHandler("create", create));
app.post("/api/tenant/admin/consent-policies/:policyId/publish", resolver, authenticateTestIdentity, auth, createTenantConsentAdminHandler("publish", publish));
app.post("/api/tenant/admin/consent-policies/:policyId/retire", resolver, authenticateTestIdentity, auth, createTenantConsentAdminHandler("retire", retire));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("tenant consent administration HTTP authorization integration", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (path: string, host = "mit.platform.test", token = "Bearer integration-test-token", body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = httpRequest(baseUrl + path, { method: "POST", headers: { host, authorization: token, "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed: any = raw;
        try { parsed = JSON.parse(raw); } catch { /* preserve non-JSON body for assertion diagnostics */ }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });

  await t.test("university admin can create, publish and retire consent only in their resolved tenant", async () => {
    role = "UNIVERSITY_ADMIN"; membershipTenantId = "tenant-mit"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE";
    actions.length = 0;
    const created = await request("/api/tenant/admin/consent-policies", "mit.platform.test", undefined, { version: "v1", content: "Institutional consent text for test coverage.", effectiveAt: "2026-10-21T11:00:00.000Z" });
    assert.equal(created.status, 201);
    const published = await request("/api/tenant/admin/consent-policies/policy-1/publish");
    assert.equal(published.status, 200);
    const retired = await request("/api/tenant/admin/consent-policies/policy-1/retire");
    assert.equal(retired.status, 200);
    assert.deepEqual(actions.map((item) => item.action), ["create", "publish", "retire"]);
    assert.ok(actions.every((item) => item.tenantId === "tenant-mit" && item.uid === "firebase-admin-1"));
  });

  await t.test("student, inactive identity, and revoked membership are denied", async () => {
    role = "STUDENT";
    assert.equal((await request("/api/tenant/admin/consent-policies", "mit.platform.test", "Bearer integration-test-token", { version: "v2", content: "Institutional consent text for test coverage.", effectiveAt: "2026-10-21T11:00:00.000Z" })).status, 403);
    role = "UNIVERSITY_ADMIN"; identityStatus = "SUSPENDED";
    assert.equal((await request("/api/tenant/admin/consent-policies")).status, 403);
    identityStatus = "ACTIVE"; membershipStatus = "REVOKED";
    assert.equal((await request("/api/tenant/admin/consent-policies")).status, 403);
    membershipStatus = "ACTIVE";
  });

  await t.test("missing token and unknown tenant host fail before policy operation", async () => {
    const before = actions.length;
    assert.equal((await request("/api/tenant/admin/consent-policies", "mit.platform.test", "")).status, 401);
    assert.equal((await request("/api/tenant/admin/consent-policies", "unknown.platform.test")).status, 404);
    assert.equal(actions.length, before);
  });

  await t.test("identity cannot administer a different tenant without that tenant membership", async () => {
    membershipTenantId = "tenant-mit"; role = "UNIVERSITY_ADMIN";
    const before = actions.length;
    assert.equal((await request("/api/tenant/admin/consent-policies/iit-policy/publish", "iit.platform.test")).status, 403);
    assert.equal(actions.length, before);
  });
});
