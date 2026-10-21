import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { listTenantStudentJobs } from "../server/tenancy/studentJobs";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };
const now = new Date("2026-10-21T12:00:00.000Z");

function fakeClient(profile: any, jobs: any[] = []) {
  const calls: { profile?: unknown; jobs?: unknown } = {};
  const client = {
    studentProfile: {
      findUnique: async (args: unknown) => { calls.profile = args; return profile; },
    },
    jobRequisition: {
      findMany: async (args: unknown) => { calls.jobs = args; return jobs; },
    },
  } as unknown as Pick<TenantPrismaClient, "studentProfile" | "jobRequisition">;
  return { client, calls };
}

test("student job discovery scopes the profile query to authenticated UID and resolved tenant client", async () => {
  const jobs = [{ id: "job-1", title: "Graduate Engineer" }];
  const { client, calls } = fakeClient({ graduationYear: 2027, programme: "BTech" }, jobs);
  const result = await listTenantStudentJobs(context, "firebase-uid", () => client, now);
  assert.deepEqual(result, jobs);
  assert.deepEqual(calls.profile, {
    where: { userSubject: "firebase-uid" },
    select: { graduationYear: true, programme: true },
  });
  assert.ok(calls.jobs);
  const query = calls.jobs as any;
  assert.equal(query.where.status, "PUBLISHED");
  assert.deepEqual(query.where.publishedAt, { lte: now });
  assert.equal(query.take, 50);
  assert.deepEqual(query.orderBy, { publishedAt: "desc" });
  assert.deepEqual(query.select.employer, { select: { displayName: true } });
});

test("student job discovery applies graduation year and programme eligibility and excludes closed jobs", async () => {
  const { client, calls } = fakeClient({ graduationYear: 2027, programme: "BTech" });
  await listTenantStudentJobs(context, "firebase-uid", () => client, now);
  const query = calls.jobs as any;
  assert.ok(query.where.AND.some((clause: any) => clause.OR?.some((entry: any) => entry.eligibleYears?.has === 2027)));
  assert.ok(query.where.AND.some((clause: any) => clause.OR?.some((entry: any) => entry.eligiblePrograms?.has === "BTech")));
  assert.ok(query.where.AND.some((clause: any) => clause.OR?.some((entry: any) => entry.closesAt?.gte === now)));
});

test("student without a tenant profile gets no job list and does not query requisitions", async () => {
  const { client, calls } = fakeClient(null);
  assert.equal(await listTenantStudentJobs(context, "firebase-uid", () => client, now), null);
  assert.equal(calls.jobs, undefined);
});

test("student job discovery rejects blank authenticated subjects", async () => {
  await assert.rejects(() => listTenantStudentJobs(context, "  ", () => { throw new Error("client must not be requested"); }, now), /Authenticated user subject is required/);
});
