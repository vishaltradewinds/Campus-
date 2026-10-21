import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import type { TenantContext } from "../server/tenancy/tenantResolver";
import { listTenantRecruiterJobs } from "../server/tenancy/recruiterJobs";

const context: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

function fakeClient(memberships: Array<{ employerId: string }>, jobs: any[] = []) {
  const calls: Record<string, any> = {};
  const client = {
    employerRecruiter: { findMany: async (args: unknown) => { calls.memberships = args; return memberships; } },
    jobRequisition: { findMany: async (args: unknown) => { calls.jobs = args; return jobs; } },
  } as unknown as Pick<TenantPrismaClient, "employerRecruiter" | "jobRequisition">;
  return { client, calls };
}

test("recruiter sees only requisitions belonging to verified employer memberships", async () => {
  const jobs = [{ id: "job-1", title: "Engineer", status: "DRAFT", _count: { applications: 0 } }];
  const { client, calls } = fakeClient([{ employerId: "employer-1" }, { employerId: "employer-1" }, { employerId: "employer-2" }], jobs);
  assert.deepEqual(await listTenantRecruiterJobs(context, "recruiter-uid", () => client), jobs);
  assert.deepEqual(calls.memberships, { where: { userSubject: "recruiter-uid", employer: { verification: "VERIFIED" } }, select: { employerId: true } });
  assert.deepEqual(calls.jobs, {
    where: { employerId: { in: ["employer-1", "employer-2"] } },
    orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, title: true, status: true, publishedAt: true, closesAt: true, createdAt: true, updatedAt: true,
      _count: { select: { applications: true } },
    },
  });
});

test("recruiter without verified employer membership sees no jobs", async () => {
  const { client, calls } = fakeClient([]);
  assert.deepEqual(await listTenantRecruiterJobs(context, "recruiter-uid", () => client), []);
  assert.equal(calls.jobs, undefined, "do not query requisitions without an authorized employer scope");
});

test("recruiter identity must be present", async () => {
  const { client } = fakeClient([]);
  await assert.rejects(() => listTenantRecruiterJobs(context, " ", () => client), /Authenticated user subject/);
});
