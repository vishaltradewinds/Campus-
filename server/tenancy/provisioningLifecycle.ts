export interface TenantProvisioningSteps {
  ensureSchema(): Promise<void>;
  applyMigrations(): Promise<void>;
  activate(): Promise<void>;
}

/**
 * Enforces the critical provisioning invariant: a tenant is marked ACTIVE only
 * after schema preparation and all tenant migrations have completed.
 * A failed attempt remains non-active and can safely be retried by the operator.
 */
export async function runTenantProvisioningSteps(steps: TenantProvisioningSteps): Promise<void> {
  await steps.ensureSchema();
  await steps.applyMigrations();
  await steps.activate();
}
