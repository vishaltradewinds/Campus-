import test from "node:test";
import assert from "node:assert/strict";
import { runTenantProvisioningSteps } from "../server/tenancy/provisioningLifecycle";

test("tenant activation occurs only after schema creation and migrations succeed", async () => {
  const events: string[] = [];
  await runTenantProvisioningSteps({
    ensureSchema: async () => { events.push("schema"); },
    applyMigrations: async () => { events.push("migrations"); },
    activate: async () => { events.push("active"); },
  });
  assert.deepEqual(events, ["schema", "migrations", "active"]);
});

test("schema preparation failure prevents migration and activation", async () => {
  const events: string[] = [];
  await assert.rejects(runTenantProvisioningSteps({
    ensureSchema: async () => { events.push("schema"); throw new Error("injected schema failure"); },
    applyMigrations: async () => { events.push("migrations"); },
    activate: async () => { events.push("active"); },
  }), /injected schema failure/);
  assert.deepEqual(events, ["schema"]);
});

test("migration failure leaves tenant non-active and prevents activation", async () => {
  const events: string[] = [];
  await assert.rejects(runTenantProvisioningSteps({
    ensureSchema: async () => { events.push("schema"); },
    applyMigrations: async () => { events.push("migrations"); throw new Error("injected migration failure"); },
    activate: async () => { events.push("active"); },
  }), /injected migration failure/);
  assert.deepEqual(events, ["schema", "migrations"]);
});

test("retry after an injected migration failure can complete and activate last", async () => {
  const events: string[] = [];
  let failOnce = true;
  const steps = {
    ensureSchema: async () => { events.push("schema"); },
    applyMigrations: async () => {
      events.push("migrations");
      if (failOnce) { failOnce = false; throw new Error("temporary migration failure"); }
    },
    activate: async () => { events.push("active"); },
  };
  await assert.rejects(runTenantProvisioningSteps(steps), /temporary migration failure/);
  assert.equal(events.includes("active"), false, "failed attempt must not activate tenant");
  events.length = 0;
  await runTenantProvisioningSteps(steps);
  assert.deepEqual(events, ["schema", "migrations", "active"]);
});
