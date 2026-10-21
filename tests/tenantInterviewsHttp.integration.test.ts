import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantInterviewHandler, createTenantStudentInterviewsHandler } from "../server/tenancy/interviews";

const tenants = { mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const } };
let role = "RECRUITER";
let membershipStatus = "ACTIVE";
const calls: Array<{ action: string; uid: string; tenantId: string; jobId?: string; applicationId?: string; interviewId?: string }> = [];
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
const scheduleStub = (async (context: any, uid: string, jobId: string, applicationId: string) => {
  calls.push({ action: "schedule", uid, tenantId: context.tenantId, jobId, applicationId });
  return { kind: "scheduled", interviewId: "interview-1", scheduledAt: new Date("2026-10-22T10:00:00.000Z"), status: "SCHEDULED" };
}) as unknown as typeof import("../server/tenancy/interviews").scheduleTenantInterview;
const cancelStub = (async (context: any, uid: string, jobId: string, interviewId: string) => {
  calls.push({ action: "cancel", uid, tenantId: context.tenantId, jobId, interviewId });
  return { kind: "cancelled", interviewId, status: "CANCELLED" };
}) as unknown as typeof import("../server/tenancy/interviews").cancelTenantInterview;
const studentListStub = (async (context: any, uid: string) => {
  calls.push({ action: "student-list", uid, tenantId: context.tenantId });
  return { interviews: [{ id: "interview-1", mode: "ONLINE", status: "SCHEDULED" }] };
}) as unknown as typeof import("../server/tenancy/interviews").listTenantStudentInterviews;
const app = express();
app.use(express.json());
app.post("/api/tenant/recruiter/jobs/:jobId/applications/:applicationId/interviews", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantInterviewHandler("schedule", scheduleStub, cancelStub));
app.patch("/api/tenant/recruiter/jobs/:jobId/interviews/:interviewId", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["RECRUITER"] }, () => controlClient), createTenantInterviewHandler("cancel", scheduleStub, cancelStub));
app.get("/api/tenant/students/me/interviews", resolver, authenticate, requireTenantAuthorization({ allowedRoles: ["STUDENT"] }, () => controlClient), createTenantStudentInterviewsHandler(studentListStub));

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("interview routes enforce tenant role authorization for recruiters and students", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (method: "GET" | "POST" | "PATCH", path: string, host = "mit.platform.test", token = "Bearer integration-token", body?: unknown) => new Promise<{ status: number; body: any }>((resolve, reject) => {
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

  await t.test("recruiter can schedule and cancel interviews within resolved tenant scope", async () => {
    role = "RECRUITER"; membershipStatus = "ACTIVE"; calls.length = 0;
    const scheduled = await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/interviews", "mit.platform.test", "Bearer integration-token", { requestId: "interview-request-001" });
    assert.equal(scheduled.status, 201);
    assert.equal(scheduled.body.interview.interviewId, "interview-1");
    const cancelled = await request("PATCH", "/api/tenant/recruiter/jobs/job-1/interviews/interview-1", "mit.platform.test", "Bearer integration-token", { action: "cancel" });
    assert.equal(cancelled.status, 200);
    assert.deepEqual(calls.map((call) => [call.action, call.tenantId]), [["schedule", "tenant-mit"], ["cancel", "tenant-mit"]]);
  });

  await t.test("student can read own interview endpoint but cannot use recruiter routes", async () => {
    role = "STUDENT";
    const own = await request("GET", "/api/tenant/students/me/interviews");
    assert.equal(own.status, 200);
    assert.equal(own.body.interviews[0].id, "interview-1");
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/interviews", "mit.platform.test", "Bearer integration-token", {})).status, 403);
  });

  await t.test("inactive memberships, unknown tenant and missing auth fail closed", async () => {
    role = "RECRUITER"; membershipStatus = "INVITED";
    assert.equal((await request("POST", "/api/tenant/recruiter/jobs/job-1/applications/application-1/interviews", "mit.platform.test", "Bearer integration-token", {})).status, 403);
    membershipStatus = "ACTIVE";
    assert.equal((await request("GET", "/api/tenant/students/me/interviews", "unknown.platform.test")).status, 404);
    assert.equal((await request("GET", "/api/tenant/students/me/interviews", "mit.platform.test", "")).status, 401);
  });
});
