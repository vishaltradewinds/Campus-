import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantApplicationReviewHandler } from "../server/tenancy/applicationReview";

const tenants = {
  mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const },
  iit: { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" as const },
};
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
let identityStatus = "ACTIVE";
const calls: Array<{ uid: string; tenantId: string; jobId: string; applicationId: string; decision: unknown }> = [];
const controlClient = {
  userIdentity: {
    findUnique: async () => ({
      status: identityStatus,
      platformRole: null,
      memberships: membershipStatus === "ACTIVE" ? [{ role, status: "ACTIVE" }] : [],
    }),
  },
} as any;
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "firebase-recruiter-1" };
  next();
};
const reviewStub = (async (context: any, uid: string, jobId: string, applicationId: string, decision: unknown) => {
  calls.push({ uid, tenantId: context.tenantId, jobId, applicationId, decision });
  return { kind: "updated", applicationId, status: decision === "REJECTED" ? "REJECTED" : "SHORTLISTED" };
}) as unknown as typeof import("../server/tenancy/applicationReview").reviewTenantApplication;

const app = express();
app.use(express.json());
app.patch("/api/tenant/recruiter/jobs/:jobId/applications/:applicationId/decision", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantApplicationReviewHandler(reviewStub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("tenant recruiter application decision route enforces HTTP authorization and tenant scope", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (host: string, token = "Bearer integration-token", body: unknown = { decision: "SHORTLISTED" }) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = httpRequest(baseUrl + "/api/tenant/recruiter/jobs/job-1/applications/application-1/decision", {
      method: "PATCH",
      headers: { host, authorization: token, "content-type": "application/json", "content-length": Buffer.byteLength(data) },
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

  await t.test("active recruiter reaches only the resolved tenant handler", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE"; calls.length = 0;
    const response = await request("mit.platform.test");
    assert.equal(response.status, 200);
    assert.equal(response.body.application.status, "SHORTLISTED");
    assert.deepEqual(calls, [{ uid: "firebase-recruiter-1", tenantId: "tenant-mit", jobId: "job-1", applicationId: "application-1", decision: "SHORTLISTED" }]);
  });

  await t.test("student, inactive identity and non-active memberships are denied before mutation", async () => {
    role = "STUDENT"; membershipStatus = "ACTIVE";
    assert.equal((await request("mit.platform.test")).status, 403);
    role = "RECRUITER";
    for (const status of ["INVITED", "SUSPENDED", "REVOKED"]) {
      membershipStatus = status;
      assert.equal((await request("mit.platform.test")).status, 403, status);
    }
    membershipStatus = "ACTIVE"; identityStatus = "SUSPENDED";
    assert.equal((await request("mit.platform.test")).status, 403);
    identityStatus = "ACTIVE";
  });

  await t.test("unknown tenant host and missing authentication are rejected before mutation", async () => {
    const before = calls.length;
    assert.equal((await request("unknown.platform.test")).status, 404);
    assert.equal((await request("mit.platform.test", "")).status, 401);
    assert.equal(calls.length, before);
  });
});
