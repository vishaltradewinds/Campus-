import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantConsentWithdrawalHandler } from "../server/tenancy/studentConsentWithdrawal";

const tenants = {
  mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const },
  iit: { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" as const },
};
let role = "STUDENT";
let membershipTenantId = "tenant-mit";
let membershipStatus = "ACTIVE";
const calls: Array<{ tenantId: string; uid: string; version: string; reason?: string }> = [];
const controlClient = {
  userIdentity: {
    findUnique: async (args: unknown) => ({
      status: "ACTIVE",
      platformRole: null,
      memberships: membershipStatus === "ACTIVE" && membershipTenantId === (args as any).select.memberships.where.tenantId
        ? [{ role, status: "ACTIVE" }]
        : [],
    }),
  },
} as any;
const app = express();
app.use(express.json());
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-test-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "student-1" };
  next();
};
const handler = createTenantConsentWithdrawalHandler((async (context: any, uid: string, version: string, reason?: string) => {
  calls.push({ tenantId: context.tenantId, uid, version, reason });
  return { kind: "withdrawn", withdrawalId: "withdrawal-1", policyVersion: version };
}) as any);
app.post("/api/tenant/consent-withdrawals", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["STUDENT"] }, () => controlClient), handler);

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("student consent withdrawal HTTP authorization integration", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  const request = (host = "mit.platform.test", token = "Bearer integration-test-token", body: unknown = { consentVersion: "v1" }) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = httpRequest(baseUrl + "/api/tenant/consent-withdrawals", { method: "POST", headers: { host, authorization: token, "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed: any = raw;
        try { parsed = JSON.parse(raw); } catch { /* preserve response for diagnostics */ }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });

  await t.test("active student can withdraw only in their own tenant", async () => {
    role = "STUDENT"; membershipTenantId = "tenant-mit"; membershipStatus = "ACTIVE"; calls.length = 0;
    const response = await request("mit.platform.test", "Bearer integration-test-token", { consentVersion: "v1", reason: "No longer consent" });
    assert.equal(response.status, 200);
    assert.equal(response.body.existingApplicationsRetained, true);
    assert.deepEqual(calls, [{ tenantId: "tenant-mit", uid: "student-1", version: "v1", reason: "No longer consent" }]);
  });
  await t.test("non-student role, revoked membership and cross-tenant host are denied", async () => {
    role = "UNIVERSITY_ADMIN";
    assert.equal((await request()).status, 403);
    role = "STUDENT"; membershipStatus = "REVOKED";
    assert.equal((await request()).status, 403);
    membershipStatus = "ACTIVE"; membershipTenantId = "tenant-mit";
    assert.equal((await request("iit.platform.test")).status, 403);
  });
  await t.test("missing token and unknown host fail closed", async () => {
    const before = calls.length;
    assert.equal((await request("mit.platform.test", "")).status, 401);
    assert.equal((await request("unknown.platform.test")).status, 404);
    assert.equal(calls.length, before);
  });
});
