import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantEmployerLifecycleHandler } from "../server/tenancy/employerLifecycle";

const tenants = { mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const } };
let role = "UNIVERSITY_ADMIN";
let membershipStatus = "ACTIVE";
let identityStatus = "ACTIVE";
let stored: { id: string; verification: string } | null = { id: "employer-1", verification: "PENDING" };
const auditEvents: any[] = [];
const controlClient = { userIdentity: { findUnique: async () => ({
  status: identityStatus, platformRole: null,
  memberships: membershipStatus === "ACTIVE" ? [{ role, status: "ACTIVE" }] : [],
}) } } as any;
const tenantClient = {
  employer: {
    findUnique: async () => stored,
    updateMany: async (args: any) => {
      if (!stored) return { count: 0 };
      const expected = args.where.verification;
      const matches = typeof expected === "string" ? stored.verification === expected : expected?.in?.includes(stored.verification);
      if (!matches) return { count: 0 };
      stored = { ...stored, verification: args.data.verification };
      return { count: 1 };
    },
  },
  employerAuditEvent: { create: async (args: any) => { auditEvents.push(args); return args.data; }, findFirst: async () => ({ actorSubject: "recruiter-uid" }) },
  $transaction: async (callback: (tx: any) => unknown) => callback(tenantClient),
} as any;
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "university-admin-uid" };
  next();
};
const app = express();
app.use(express.json());
for (const action of ["verify", "reject", "suspend", "revoke"] as const) {
  app.post(`/api/tenant/admin/employers/:employerId/${action}`, resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["UNIVERSITY_ADMIN"] }, () => controlClient), createTenantEmployerLifecycleHandler(action, () => tenantClient));
}

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("employer rejection, suspension and revocation routes require university admin and tenant scope", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (action: string, host = "mit.platform.test", token = "Bearer integration-token") => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = JSON.stringify({ reason: "Compliance evidence requires an administrative decision.", evidenceReference: "registry-review:case-2026-001" });
    const req = httpRequest(baseUrl + `/api/tenant/admin/employers/employer-1/${action}`, {
      method: "POST", headers: { host, authorization: token, "content-type": "application/json", "content-length": Buffer.byteLength(data) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });

  await t.test("admin verification requires a different submitter and records reason plus evidence reference", async () => {
    role = "UNIVERSITY_ADMIN"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE";
    stored = { id: "employer-1", verification: "PENDING" }; auditEvents.length = 0;
    const result = await request("verify");
    assert.equal(result.status, 200);
    assert.equal(result.body.employer.kind, "verified");
    assert.equal(auditEvents[0].data.metadata.evidenceReference, "registry-review:case-2026-001");
    assert.equal(auditEvents[0].data.metadata.submittedBySubject, "recruiter-uid");
  });

  await t.test("admin can reject pending employer with auditable reason and evidence reference", async () => {
    role = "UNIVERSITY_ADMIN"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE";
    stored = { id: "employer-1", verification: "PENDING" }; auditEvents.length = 0;
    const result = await request("reject");
    assert.equal(result.status, 200);
    assert.equal(result.body.employer.verification, "REJECTED");
    assert.equal(auditEvents[0].data.metadata.evidenceReference, "registry-review:case-2026-001");
  });

  await t.test("recruiter and inactive membership/identity cannot change employer status", async () => {
    stored = { id: "employer-1", verification: "VERIFIED" };
    role = "RECRUITER";
    assert.equal((await request("suspend")).status, 403);
    role = "UNIVERSITY_ADMIN"; membershipStatus = "INVITED";
    assert.equal((await request("suspend")).status, 403);
    membershipStatus = "ACTIVE"; identityStatus = "SUSPENDED";
    assert.equal((await request("suspend")).status, 403);
    identityStatus = "ACTIVE";
    assert.equal(stored?.verification, "VERIFIED");
  });

  await t.test("verified employer can be suspended and then revoked, while unknown host and missing auth fail closed", async () => {
    stored = { id: "employer-1", verification: "VERIFIED" };
    assert.equal((await request("suspend")).status, 200);
    assert.equal(stored?.verification, "SUSPENDED");
    assert.equal((await request("revoke")).status, 200);
    assert.equal(stored?.verification, "REVOKED");
    assert.equal((await request("reject", "unknown.platform.test")).status, 404);
    assert.equal((await request("reject", "mit.platform.test", "")).status, 401);
  });
});
