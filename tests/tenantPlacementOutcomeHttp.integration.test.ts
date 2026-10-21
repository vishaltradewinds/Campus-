import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantPlacementOutcomeHandler } from "../server/tenancy/placementOutcome";

const tenants = { mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const } };
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
const calls: Array<{ uid: string; tenantId: string; jobId: string; applicationId: string; outcome: unknown }> = [];
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
const stub = (async (context: any, uid: string, jobId: string, applicationId: string, input: any) => {
  calls.push({ uid, tenantId: context.tenantId, jobId, applicationId, outcome: input.outcome });
  return { kind: "recorded", applicationId, outcome: input.outcome, joinedAt: input.outcome === "JOINED" ? new Date("2026-10-20T09:00:00.000Z") : null };
}) as unknown as typeof import("../server/tenancy/placementOutcome").recordTenantJoiningOutcome;
const app = express();
app.use(express.json());
app.post("/api/tenant/recruiter/jobs/:jobId/applications/:applicationId/outcome", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantPlacementOutcomeHandler(stub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("placement outcome route enforces recruiter authorization and tenant scope", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  const request = (host: string, token = "Bearer integration-token", body: unknown = { outcome: "JOINED", joinedAt: "2026-10-20T09:00:00.000Z", reason: "Employer confirmed candidate joined." }) => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = httpRequest(baseUrl + "/api/tenant/recruiter/jobs/job-1/applications/application-1/outcome", { method: "POST", headers: { host, authorization: token, "content-type": "application/json", "content-length": Buffer.byteLength(data) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => { const raw = Buffer.concat(chunks).toString("utf8"); try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode ?? 0, body: raw }); } });
    });
    req.on("error", reject); req.write(data); req.end();
  });

  await t.test("active recruiter records outcome in resolved tenant", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; calls.length = 0;
    const result = await request("mit.platform.test");
    assert.equal(result.status, 200);
    assert.equal(result.body.placement.outcome, "JOINED");
    assert.deepEqual(calls, [{ uid: "firebase-recruiter-1", tenantId: "tenant-mit", jobId: "job-1", applicationId: "application-1", outcome: "JOINED" }]);
  });

  await t.test("students, inactive memberships, unknown hosts and missing authentication are denied", async () => {
    role = "STUDENT";
    assert.equal((await request("mit.platform.test")).status, 403);
    role = "RECRUITER"; membershipStatus = "SUSPENDED";
    assert.equal((await request("mit.platform.test")).status, 403);
    membershipStatus = "ACTIVE";
    assert.equal((await request("unknown.platform.test")).status, 404);
    assert.equal((await request("mit.platform.test", "")).status, 401);
  });
});
