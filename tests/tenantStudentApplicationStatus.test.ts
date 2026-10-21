import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { listOwnTenantApplications } from "../server/tenancy/studentApplicationStatus";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const summary = {
  id: "application-1", status: "SHORTLISTED", appliedAt: new Date("2026-10-20T10:00:00Z"),
  consentVersion: "v1", joinedAt: null, outcomeRecordedAt: null, outcomeReason: null,
  requisition: { title: "Graduate Engineer", employer: { displayName: "Example Ltd" } },
};

function fakeClient(profile: any = { id: "profile-1" }, applications: any[] = [summary]) {
  const calls: Record<string, any> = {};
  const client = {
    studentProfile: { findUnique: async (args: unknown) => { calls.profile = args; return profile; } },
    jobApplication: { findMany: async (args: unknown) => { calls.applications = args; return applications; } },
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobApplication">;
  return { client, calls };
}

test("student application status list is scoped to authenticated subject and returns only bounded status fields", async () => {
  const { client, calls } = fakeClient();
  const result = await listOwnTenantApplications(context, "student-1", () => client);
  assert.deepEqual(result, { kind: "listed", applications: [summary] });
  assert.deepEqual(calls.profile, { where: { userSubject: "student-1" }, select: { id: true } });
  assert.deepEqual(calls.applications, {
    where: { studentSubject: "student-1" },
    orderBy: { appliedAt: "desc" },
    take: 100,
    select: {
      id: true, status: true, appliedAt: true, consentVersion: true, joinedAt: true,
      outcomeRecordedAt: true, outcomeReason: true,
      requisition: { select: { title: true, employer: { select: { displayName: true } } } },
    },
  });
  assert.equal(JSON.stringify(result).includes("studentSubject"), false);
});

test("student without a tenant-local profile cannot retrieve applications", async () => {
  const { client } = fakeClient(null);
  assert.deepEqual(await listOwnTenantApplications(context, "student-unknown", () => client), { kind: "not_found" });
});

test("blank authenticated subject is rejected", async () => {
  await assert.rejects(() => listOwnTenantApplications(context, " ", () => { throw new Error("must not construct client"); }), /Authenticated student subject/);
});
