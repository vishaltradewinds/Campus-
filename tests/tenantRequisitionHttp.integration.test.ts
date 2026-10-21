import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantRequisitionHandler } from "../server/tenancy/requisitionLifecycle";

const tenants = {
  mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const },
  iit: { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" as const },
};
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
let identityStatus = "ACTIVE";
const calls: Array<{ action: string; uid: string; contextTenant: string; input: any }> = [];
const controlClient = {
  userIdentity: {
    findUnique: async (args: any) => ({
      status: identityStatus,
      platformRole: null,
      memberships: membershipStatus === "ACTIVE"
        ? [{ role, status: "ACTIVE" }]
        : [],
    }),
  },
} as any;
const resolver = createTenantResolver({ baseDomain: "platform.test", lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null });
const authenticate: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-token") return res.status(401).json({ error: "Authentication required" });
  res.locals.identity = { uid: "firebase-recruiter-1" };
  next();
};
const createStub = (async (context: any, uid: string, input: any) => {
  calls.push({ action: "create", uid, contextTenant: context.tenantId, input });
  return { kind: "created", requisitionId: "job-1", status: "DRAFT" };
}) as unknown as typeof import("../server/tenancy/requisitionLifecycle").createTenantRequisition;
const transitionStub = (async (context: any, uid: string, jobId: string, input: any) => {
  calls.push({ action: "transition", uid, contextTenant: context.tenantId, input: { ...input, jobId } });
  return { kind: "updated", requisitionId: jobId, status: input.action === "publish" ? "PUBLISHED" : "CLOSED" };
}) as unknown as typeof import("../server/tenancy/requisitionLifecycle").transitionTenantRequisition;

const app = express();
app.use(express.json());
app.post("/api/tenant/recruiter/jobs", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantRequisitionHandler("create", createStub, transitionStub));
app.patch("/api/tenant/recruiter/jobs/:jobId", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantRequisitionHandler("transition", createStub, transitionStub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("tenant recruiter requisition routes enforce HTTP authorization and host scope", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (method: "POST" | "PATCH", path: string, host: string, token = "Bearer integration-token", body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
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

  await t.test("verified recruiter role can reach tenant-scoped create and transition handlers", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE"; calls.length = 0;
    const created = await request("POST", "/api/tenant/recruiter/jobs", "mit.platform.test", "Bearer integration-token", { title: "Engineer" });
    assert.equal(created.status, 201);
    assert.equal(created.body.requisition.status, "DRAFT");
    const published = await request("PATCH", "/api/tenant/recruiter/jobs/job-1", "mit.platform.test", "Bearer integration-token", { action: "publish" });
    assert.equal(published.status, 200);
    assert.equal(published.body.requisition.status, "PUBLISHED");
    assert.deepEqual(calls.map((call) => [call.action, call.uid, call.contextTenant]), [
      ["create", "firebase-recruiter-1", "tenant-mit"],
      ["transition", "firebase-recruiter-1", "tenant-mit"],
    ]);
  });

  await t.test("students, invited/suspended/revoked memberships, and inactive identities fail closed", async () => {
    role = "STUDENT"; membershipStatus = "ACTIVE";
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs", "mit.platform.test", "Bearer integration-token", {})).status, 403);
    role = "RECRUITER";
    for (const status of ["INVITED", "SUSPENDED", "REVOKED"]) {
      membershipStatus = status;
      assert.equal((await request("POST", "/api/tenant/recruiter/jobs", "mit.platform.test", "Bearer integration-token", {})).status, 403, status);
    }
    membershipStatus = "ACTIVE"; identityStatus = "SUSPENDED";
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs", "mit.platform.test", "Bearer integration-token", {})).status, 403);
    identityStatus = "ACTIVE";
  });

  await t.test("unknown tenant host and missing authentication are rejected before mutation", async () => {
    const before = calls.length;
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs", "unknown.platform.test", "Bearer integration-token", {})).status, 404);
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs", "mit.platform.test", "", {})).status, 401);
    assert.equal(calls.length, before);
  });
});
