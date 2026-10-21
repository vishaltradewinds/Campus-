import test from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { cancelTenantInterview, listTenantStudentInterviews, scheduleTenantInterview } from "../server/tenancy/interviews";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");
const validInput = { requestId: "interview-request-001", scheduledAt: "2026-10-22T10:00:00.000Z", durationMinutes: 45, mode: "ONLINE", locationOrJoinUrl: "https://meet.example.test/room-1", instructions: "Join five minutes early" };

function fakeClient(options: { authorized?: boolean; job?: any; application?: any; existing?: any; updateCount?: number } = {}) {
  const calls: Record<string, any[]> = { membership: [], audit: [], create: [], update: [], find: [] };
  let interview: any = options.existing ?? null;
  const tx = {
    jobRequisition: { findUnique: async (args: any) => { calls.job = [args]; return options.job === undefined ? { id: "job-1", employerId: "employer-1" } : options.job; } },
    employerRecruiter: { findFirst: async (args: any) => { calls.membership.push(args); return options.authorized === false ? null : { employerId: "employer-1" }; } },
    jobApplication: { findUnique: async (args: any) => { calls.application = [args]; return options.application === undefined ? { id: "application-1", requisitionId: "job-1", status: "SHORTLISTED" } : options.application; } },
    applicationInterview: {
      findUnique: async (args: any) => {
        calls.find.push(args);
        if (args.where.requestId) return interview?.requestId === args.where.requestId ? interview : null;
        return interview?.id === args.where.id ? { ...interview, application: { requisitionId: "job-1" } } : null;
      },
      create: async (args: any) => {
        calls.create.push(args);
        interview = { id: "interview-1", applicationId: args.data.applicationId, requestId: args.data.requestId, createdBySubject: args.data.createdBySubject, scheduledAt: args.data.scheduledAt, status: args.data.status };
        return { id: interview.id, scheduledAt: interview.scheduledAt, status: interview.status };
      },
      updateMany: async (args: any) => {
        calls.update.push(args);
        if (options.updateCount !== undefined) return { count: options.updateCount };
        if (!interview || interview.status !== args.where.status) return { count: 0 };
        interview = { ...interview, ...args.data };
        return { count: 1 };
      },
      findMany: async (args: any) => { calls.list = [args]; return [{ id: "interview-1", scheduledAt: new Date("2026-10-22T10:00:00.000Z"), durationMinutes: 45, mode: "ONLINE", locationOrJoinUrl: "https://meet.example.test/room-1", instructions: "Join five minutes early", application: { requisition: { title: "Engineer", employer: { displayName: "Example Employer" } } } }]; },
    },
    applicationInterviewAuditEvent: { create: async (args: any) => { calls.audit.push(args); return { id: "audit-1" }; } },
  };
  const client = { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as any;
  return { client, calls, getInterview: () => interview };
}

test("verified recruiter schedules an interview only for a shortlisted application and audits atomically", async () => {
  const { client, calls, getInterview } = fakeClient();
  const result = await scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", validInput, () => client, now);
  assert.deepEqual(result, { kind: "scheduled", interviewId: "interview-1", scheduledAt: new Date("2026-10-22T10:00:00.000Z"), status: "SCHEDULED" });
  assert.equal(getInterview().status, "SCHEDULED");
  assert.equal(calls.membership[0].where.employer.verification, "VERIFIED");
  assert.equal(calls.create[0].data.durationMinutes, 45);
  assert.equal(calls.audit[0].data.eventType, "INTERVIEW_SCHEDULED");
});

test("interview scheduling is idempotent for the same request and rejects request ID reuse", async () => {
  const existing = { id: "interview-existing", applicationId: "application-1", requestId: validInput.requestId, createdBySubject: "recruiter-uid", scheduledAt: new Date("2026-10-22T10:00:00.000Z"), status: "SCHEDULED" };
  const replay = fakeClient({ existing });
  assert.deepEqual(await scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", validInput, () => replay.client, now), {
    kind: "already_scheduled", interviewId: "interview-existing", scheduledAt: new Date("2026-10-22T10:00:00.000Z"), status: "SCHEDULED",
  });
  assert.equal(replay.calls.create.length, 0);
  const conflict = fakeClient({ existing: { ...existing, applicationId: "other-application" } });
  assert.deepEqual(await scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", validInput, () => conflict.client, now), { kind: "request_conflict" });
});

test("only shortlisted applications and authorized recruiters can schedule interviews", async () => {
  const notShortlisted = fakeClient({ application: { id: "application-1", requisitionId: "job-1", status: "APPLIED" } });
  assert.deepEqual(await scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", validInput, () => notShortlisted.client, now), { kind: "not_shortlisted" });
  assert.equal(notShortlisted.calls.create.length, 0);
  const unauthorized = fakeClient({ authorized: false });
  assert.deepEqual(await scheduleTenantInterview(context, "other-recruiter", "job-1", "application-1", validInput, () => unauthorized.client, now), { kind: "not_authorized" });
});

test("invalid schedule fields are rejected and missing requisition fails safely", async () => {
  const { client } = fakeClient();
  await assert.rejects(() => scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", { ...validInput, requestId: "x" }, () => client, now), /requestId/);
  await assert.rejects(() => scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", { ...validInput, scheduledAt: "2026-10-20T10:00:00.000Z" }, () => client, now), /future scheduledAt/);
  await assert.rejects(() => scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", { ...validInput, durationMinutes: 5 }, () => client, now), /durationMinutes/);
  await assert.rejects(() => scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", { ...validInput, mode: "ONLINE", locationOrJoinUrl: "javascript:alert(1)" }, () => client, now), /HTTP\(S\)/);
  await assert.rejects(() => scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", { ...validInput, mode: "IN_PERSON", locationOrJoinUrl: "" }, () => client, now), /require a location/);
  const missing = fakeClient({ job: null });
  assert.deepEqual(await scheduleTenantInterview(context, "recruiter-uid", "missing", "application-1", validInput, () => missing.client, now), { kind: "not_found" });
});

test("recruiter cancellation is audited and cannot cancel twice", async () => {
  const { client, calls, getInterview } = fakeClient();
  await scheduleTenantInterview(context, "recruiter-uid", "job-1", "application-1", validInput, () => client, now);
  assert.deepEqual(await cancelTenantInterview(context, "recruiter-uid", "job-1", "interview-1", () => client), { kind: "cancelled", interviewId: "interview-1", status: "CANCELLED" });
  assert.equal(getInterview().status, "CANCELLED");
  assert.equal(calls.audit[1].data.eventType, "INTERVIEW_CANCELLED");
  assert.deepEqual(await cancelTenantInterview(context, "recruiter-uid", "job-1", "interview-1", () => client), { kind: "invalid_state" });
});

test("students receive only their own scheduled interview details", async () => {
  const { client, calls } = fakeClient();
  const result = await listTenantStudentInterviews(context, "student-uid", () => client);
  assert.equal(result.interviews.length, 1);
  assert.deepEqual(calls.list[0].where, { status: "SCHEDULED", application: { studentSubject: "student-uid" } });
  assert.deepEqual(calls.list[0].orderBy, { scheduledAt: "asc" });
  assert.equal(calls.list[0].take, 100);
});
