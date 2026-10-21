import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import { findTenantStudentProfile } from "../server/tenancy/studentProfile";
import type { TenantContext } from "../server/tenancy/tenantResolver";

const tenant: TenantContext = { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" };

test("student profile lookup uses the resolved tenant client and authenticated subject", async () => {
  let receivedContext: TenantContext | undefined;
  let receivedArgs: unknown;
  const profile = { id: "profile-1", studentNumber: "S-1", programme: "BTech", department: "CSE", graduationYear: 2027, profileStatus: "ACTIVE", createdAt: new Date(0), updatedAt: new Date(0) };
  const mockClient = {
    studentProfile: {
      findUnique: async (args: unknown) => { receivedArgs = args; return profile; },
    },
  } as unknown as Pick<TenantPrismaClient, "studentProfile">;

  const result = await findTenantStudentProfile(tenant, "firebase-uid-123", (context) => {
    receivedContext = context;
    return mockClient;
  });

  assert.deepEqual(receivedContext, tenant);
  assert.deepEqual(receivedArgs, {
    where: { userSubject: "firebase-uid-123" },
    select: { id: true, studentNumber: true, programme: true, department: true, graduationYear: true, profileStatus: true, createdAt: true, updatedAt: true },
  });
  assert.equal(result, profile);
});

test("student profile lookup preserves not-found result and rejects blank identity", async () => {
  let called = false;
  const mockClient = {
    studentProfile: { findUnique: async () => { called = true; return null; } },
  } as unknown as Pick<TenantPrismaClient, "studentProfile">;
  assert.equal(await findTenantStudentProfile(tenant, "valid-uid", () => mockClient), null);
  await assert.rejects(() => findTenantStudentProfile(tenant, "  ", () => mockClient), /subject is required/);
  assert.equal(called, true);
});
