import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantApplicationListHandler } from "../server/tenancy/applicationReview";

const tenants = { mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const } };
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
const calls: Array<{ uid: string; tenantId: string; jobId: string }> = [];
const controlClient = { userIdentity: { findUnique: async () => ({
  status: "ACTIVE", platformRole: null,
  memberships: membershipStatus === "ACTIVE" ? [{ role, status: "ACTIVE" }] : [],
}) } } as any;
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "firebase-recruiter-1" };
  next();
};
const listStub = (async (context: any, uid: string, jobId: string) => {
  calls.push({ uid, tenantId: context.tenantId, jobId });
  return { kind: "listed", applications: [{ id: "application-1", status: "APPLIED", appliedAt: new Date("2026-10-21T12:00:00.000Z"), consentVersion: "v1" }] };
}) as unknown as typeof import("../server/tenancy/applicationReview").listTenantApplications;
const app = express();
app.get("/api/tenant/recruiter/jobs/:jobId/applications", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantApplicationListHandler(listStub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("tenant recruiter application list enforces HTTP authorization and minimizes personal data", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (host: string, token = "Bearer integration-token") => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest(baseUrl + "/api/tenant/recruiter/jobs/job-1/applications", { method: "GET", headers: { host, authorization: token } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
      });
    });
    req.on("error", reject);
    req.end();
  });

  await t.test("active recruiter sees only minimized application summaries for the resolved tenant", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; calls.length = 0;
    const response = await request("mit.platform.test");
    assert.equal(response.status, 200);
    assert.equal(response.body.applications[0].id, "application-1");
    assert.equal("studentSubject" in response.body.applications[0], false);
    assert.deepEqual(calls, [{ uid: "firebase-recruiter-1", tenantId: "tenant-mit", jobId: "job-1" }]);
  });

  await t.test("student, inactive membership, unknown host and missing token are denied", async () => {
    role = "STUDENT";
    assert.equal((await request("mit.platform.test")).status, 403);
    role = "RECRUITER"; membershipStatus = "INVITED";
    assert.equal((await request("mit.platform.test")).status, 403);
    membershipStatus = "ACTIVE";
    assert.equal((await request("unknown.platform.test")).status, 404);
    assert.equal((await request("mit.platform.test", "")).status, 401);
  });
});
