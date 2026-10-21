import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantAuthorization } from "../server/tenancy/tenantAuthorization";

const allowedRoles = ["UNIVERSITY_ADMIN", "RECRUITER", "STUDENT"] as const;

test("tenant authorization accepts an active member only for an allowed role", () => {
  const result = resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "ACTIVE" }] }, "tenant-mit", { allowedRoles: [...allowedRoles] });
  assert.deepEqual(result, { tenantId: "tenant-mit", role: "STUDENT", isSystemAdmin: false });
  assert.equal(resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "ACTIVE" }] }, "tenant-iit", { allowedRoles: ["RECRUITER"] }), null);
  assert.deepEqual(resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "ACTIVE" }, { role: "UNIVERSITY_ADMIN", status: "ACTIVE" }] }, "tenant-mit", { allowedRoles: ["UNIVERSITY_ADMIN"] }), { tenantId: "tenant-mit", role: "UNIVERSITY_ADMIN", isSystemAdmin: false });
});

test("tenant authorization rejects inactive identities and missing memberships", () => {
  assert.equal(resolveTenantAuthorization({ status: "SUSPENDED", platformRole: null, memberships: [{ role: "UNIVERSITY_ADMIN", status: "ACTIVE" }] }, "tenant-mit", { allowedRoles: ["UNIVERSITY_ADMIN"] }), null);
  assert.equal(resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [] }, "tenant-mit", { allowedRoles: [...allowedRoles] }), null);
});

test("tenant authorization rejects invited, suspended, or revoked memberships even if supplied by a stale caller", () => {
  for (const status of ["INVITED", "SUSPENDED", "REVOKED"]) {
    assert.equal(
      resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status }] }, "tenant-mit", { allowedRoles: ["STUDENT"] }),
      null,
      `membership status ${status} must not grant access`,
    );
  }
  assert.deepEqual(
    resolveTenantAuthorization({ status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "REVOKED" }, { role: "STUDENT", status: "ACTIVE" }] }, "tenant-mit", { allowedRoles: ["STUDENT"] }),
    { tenantId: "tenant-mit", role: "STUDENT", isSystemAdmin: false },
  );
});

test("global system administrator access must be explicitly enabled by each route", () => {
  const admin = { status: "ACTIVE", platformRole: "SYSTEM_ADMIN", memberships: [] };
  assert.deepEqual(resolveTenantAuthorization(admin, "tenant-mit", { allowedRoles: ["UNIVERSITY_ADMIN"], allowSystemAdmin: true }), { tenantId: "tenant-mit", role: "SYSTEM_ADMIN", isSystemAdmin: true });
  assert.equal(resolveTenantAuthorization(admin, "tenant-mit", { allowedRoles: ["UNIVERSITY_ADMIN"] }), null);
});
