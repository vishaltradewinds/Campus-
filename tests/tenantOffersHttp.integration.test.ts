import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantOfferIssueHandler, createTenantOfferResponseHandler, createTenantStudentOffersHandler } from "../server/tenancy/offers";

const tenants = { mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const } };
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
const calls: Array<{ action: string; uid: string; tenantId: string; jobId?: string; applicationId?: string; offerId?: string }> = [];
const controlClient = { userIdentity: { findUnique: async () => ({
  status: "ACTIVE", platformRole: null,
  memberships: membershipStatus === "ACTIVE" ? [{ role, status: "ACTIVE" }] : [],
}) } } as any;
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "firebase-user-1" };
  next();
};
const issueStub = (async (context: any, uid: string, jobId: string, applicationId: string) => {
  calls.push({ action: "issue", uid, tenantId: context.tenantId, jobId, applicationId });
  return { kind: "issued", offerId: "offer-1", status: "ISSUED", expiresAt: new Date("2026-10-31T12:00:00.000Z") };
}) as unknown as typeof import("../server/tenancy/offers").issueTenantOffer;
const responseStub = (async (context: any, uid: string, offerId: string) => {
  calls.push({ action: "respond", uid, tenantId: context.tenantId, offerId });
  return { kind: "accepted", offerId, status: "ACCEPTED" };
}) as unknown as typeof import("../server/tenancy/offers").respondToTenantOffer;
const listStub = (async (context: any, uid: string) => {
  calls.push({ action: "list", uid, tenantId: context.tenantId });
  return { offers: [{ id: "offer-1", status: "ISSUED", offerReference: "OFFER-001" }] };
}) as unknown as typeof import("../server/tenancy/offers").listTenantStudentOffers;
const app = express();
app.use(express.json());
app.post("/api/tenant/recruiter/jobs/:jobId/applications/:applicationId/offers", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantOfferIssueHandler(issueStub));
app.get("/api/tenant/students/me/offers", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["STUDENT"] }, () => controlClient), createTenantStudentOffersHandler(listStub));
app.post("/api/tenant/students/me/offers/:offerId/respond", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["STUDENT"] }, () => controlClient), createTenantOfferResponseHandler(responseStub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("offer routes enforce tenant-scoped recruiter issuance and student-only access", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (method: "GET" | "POST", path: string, host = "mit.platform.test", token = "Bearer integration-token", body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(baseUrl + path, { method, headers: { host, authorization: token, ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

  await t.test("active recruiter can issue an offer only within resolved tenant", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; calls.length = 0;
    const result = await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/offers", "mit.platform.test", "Bearer integration-token", { requestId: "offer-request-001" });
    assert.equal(result.status, 201);
    assert.equal(result.body.offer.offerId, "offer-1");
    assert.deepEqual(calls[0], { action: "issue", uid: "firebase-user-1", tenantId: "tenant-mit", jobId: "job-1", applicationId: "application-1" });
  });

  await t.test("student can list and respond to offers but cannot issue them", async () => {
    role = "STUDENT";
    assert.equal((await request("GET", "/api/tenant/students/me/offers")).status, 200);
    assert.equal((await request("POST", "/api/tenant/students/me/offers/offer-1/respond", "mit.platform.test", "Bearer integration-token", { decision: "ACCEPT" })).status, 200);
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/offers", "mit.platform.test", "Bearer integration-token", {})).status, 403);
  });

  await t.test("inactive membership, unknown tenant and missing token fail closed", async () => {
    role = "RECRUITER"; membershipStatus = "INVITED";
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/offers", "mit.platform.test", "Bearer integration-token", {})).status, 403);
    membershipStatus = "ACTIVE";
    assert.equal((await request("GET", "/api/tenant/students/me/offers", "unknown.platform.test")).status, 404);
    assert.equal((await request("GET", "/api/tenant/students/me/offers", "mit.platform.test", "")).status, 401);
  });
});
