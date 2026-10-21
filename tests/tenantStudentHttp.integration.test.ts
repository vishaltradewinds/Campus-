import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createTenantResolver } from "../server/tenancy/tenantResolver";
import { requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";
import { createTenantStudentProfileHandler } from "../server/tenancy/studentProfile";
import type { TenantContext } from "../server/tenancy/tenantResolver";

const tenants = {
  mit: { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" as const },
  iit: { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" as const },
};

let membershipTenantId = "tenant-mit";
let membershipStatus = "ACTIVE";
let identityStatus = "ACTIVE";
let profileMode: "found" | "missing" | "error" = "found";
const profileReads: Array<{ context: TenantContext; uid: string }> = [];
const controlQueries: unknown[] = [];

const controlClient = {
  userIdentity: {
    findUnique: async (args: unknown) => {
      controlQueries.push(args);
      return {
        status: identityStatus,
        platformRole: null,
        memberships: membershipStatus === "ACTIVE" && membershipTenantId === (args as any).select.memberships.where.tenantId
          ? [{ role: "STUDENT", status: "ACTIVE" }]
          : [],
      };
    },
  },
} as any;

const app = express();
const resolver = createTenantResolver({
  baseDomain: "platform.test",
  lookupTenant: async (slug) => tenants[slug as keyof typeof tenants] ?? null,
});
const authenticateTestIdentity: express.RequestHandler = (req, res, next) => {
  if (req.header("authorization") !== "Bearer integration-test-token") {
    return res.status(401).json({ error: "Authentication required" });
  }
  res.locals.identity = { uid: "firebase-student-1" };
  next();
};
const lookupProfile = (async (context: TenantContext, uid: string) => {
  profileReads.push({ context, uid });
  if (profileMode === "error") throw new Error("simulated database outage");
  if (profileMode === "missing") return null;
  return {
    id: "profile-1", studentNumber: "S-100", programme: "BTech", department: "CSE",
    graduationYear: 2027, profileStatus: "ACTIVE", createdAt: new Date(0), updatedAt: new Date(0),
  };
}) as unknown as typeof import("../server/tenancy/studentProfile").findTenantStudentProfile;

app.get(
  "/api/tenant/students/me",
  resolver,
  authenticateTestIdentity,
  requireTenantAuthorization({ allowedRoles: ["STUDENT"] }, () => controlClient),
  createTenantStudentProfileHandler(lookupProfile),
);

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
test("tenant student route HTTP integration", async (t) => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const request = (host: string, token = "Bearer integration-test-token") => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpRequest(baseUrl + "/api/tenant/students/me", { headers: { host, authorization: token } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: any = raw;
        try { body = JSON.parse(raw); } catch { /* non-JSON response is preserved for assertion diagnostics */ }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });

  await t.test("active student gets only their profile from the resolved tenant", async () => {
    membershipTenantId = "tenant-mit"; membershipStatus = "ACTIVE"; identityStatus = "ACTIVE"; profileMode = "found";
    profileReads.length = 0; controlQueries.length = 0;
    const response = await request("mit.platform.test");
    assert.equal(response.status, 200);
    const body = response.body as any;
    assert.equal(body.tenant.id, "tenant-mit");
    assert.equal(body.tenant.slug, "mit");
    assert.equal(body.profile.studentNumber, "S-100");
    assert.deepEqual(profileReads, [{ context: { tenantId: "tenant-mit", tenantSlug: "mit", schemaName: "tenant_mit" }, uid: "firebase-student-1" }]);
    assert.equal((controlQueries[0] as any).where.externalSubject, "firebase-student-1");
    assert.equal((controlQueries[0] as any).select.memberships.where.tenantId, "tenant-mit");
  });

  await t.test("same identity cannot cross into a different university without its membership", async () => {
    membershipTenantId = "tenant-mit"; membershipStatus = "ACTIVE";
    const response = await request("iit.platform.test");
    assert.equal(response.status, 403);
  });

  await t.test("invited, suspended, and revoked membership cannot access profile", async () => {
    membershipTenantId = "tenant-mit";
    for (const status of ["INVITED", "SUSPENDED", "REVOKED"]) {
      membershipStatus = status;
      const response = await request("mit.platform.test");
      assert.equal(response.status, 403, status);
    }
  });

  await t.test("inactive identity and missing bearer token fail closed", async () => {
    identityStatus = "SUSPENDED"; membershipStatus = "ACTIVE";
    assert.equal((await request("mit.platform.test")).status, 403);
    identityStatus = "ACTIVE";
    assert.equal((await request("mit.platform.test", "")).status, 401);
  });

  await t.test("unrecognized host is rejected before authentication or profile lookup", async () => {
    const before = profileReads.length;
    assert.equal((await request("unknown.platform.test")).status, 404);
    assert.equal(profileReads.length, before);
  });

  await t.test("missing profile returns 404 and database failure returns 503", async () => {
    membershipStatus = "ACTIVE"; membershipTenantId = "tenant-mit"; profileMode = "missing";
    assert.equal((await request("mit.platform.test")).status, 404);
    profileMode = "error";
    assert.equal((await request("mit.platform.test")).status, 503);
    profileMode = "found";
  });
});
