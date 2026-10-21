import test from "node:test";
import assert from "node:assert/strict";
import { decideTenantProvisioning } from "../server/tenancy/provisioningPolicy";

const expected = { schemaName: "tenant_mit", canonicalHost: "mit.platform.test" };
const existing = { ...expected, status: "PROVISIONING" as const };

test("new tenant is eligible for creation", () => {
  assert.equal(decideTenantProvisioning(null, expected), "CREATE");
});

test("matching PROVISIONING tenant can resume after an interrupted attempt", () => {
  assert.equal(decideTenantProvisioning(existing, expected), "RESUME");
});

test("matching ACTIVE tenant is an idempotent no-op", () => {
  assert.equal(decideTenantProvisioning({ ...existing, status: "ACTIVE" }, expected), "NOOP_ACTIVE");
});

test("tenant identity mismatches fail closed before lifecycle decisions", () => {
  assert.throws(() => decideTenantProvisioning({ ...existing, schemaName: "tenant_other" }, expected), /schema name/);
  assert.throws(() => decideTenantProvisioning({ ...existing, canonicalHost: "other.platform.test" }, expected), /canonical host/);
});

test("non-resumable tenant states are not overwritten", () => {
  for (const status of ["SUSPENDED", "ARCHIVED", "FAILED", "DELETING"]) {
    assert.throws(
      () => decideTenantProvisioning({ ...existing, status }, expected),
      new RegExp(`status ${status}.*refusing to overwrite`),
    );
  }
});
