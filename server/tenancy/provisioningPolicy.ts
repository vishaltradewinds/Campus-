export type ProvisioningLifecycleStatus = "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" | string;

export interface ExistingTenantLifecycleRecord {
  schemaName: string;
  canonicalHost: string;
  status: ProvisioningLifecycleStatus;
}

export type ProvisioningDecision = "CREATE" | "RESUME" | "NOOP_ACTIVE";

/**
 * Fail-closed lifecycle policy shared by the operator CLI and unit tests.
 * This validates identity before deciding whether an existing tenant can be resumed.
 */
export function decideTenantProvisioning(
  existing: ExistingTenantLifecycleRecord | null,
  expected: { schemaName: string; canonicalHost: string },
): ProvisioningDecision {
  if (!existing) return "CREATE";
  if (existing.schemaName !== expected.schemaName) {
    throw new Error("Existing tenant schema name does not match the deterministic tenant schema mapping");
  }
  if (existing.canonicalHost !== expected.canonicalHost) {
    throw new Error("Existing tenant canonical host does not match the requested tenant host");
  }
  if (existing.status === "ACTIVE") return "NOOP_ACTIVE";
  if (existing.status !== "PROVISIONING") {
    throw new Error(`Tenant already exists with status ${existing.status}; refusing to overwrite it`);
  }
  return "RESUME";
}
