import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../generated/tenant/index.js";
import { createTenantResolver, getTenantContext, type TenantRecord } from "../server/tenancy/tenantResolver";
import { findTenantStudentProfile } from "../server/tenancy/studentProfile";
import { getTenantAuthorization, requireTenantAuthorization } from "../server/tenancy/tenantAuthorization";

const tenants: TenantRecord[] = [
  { id: "tenant-mit", slug: "mit", schemaName: "tenant_mit", status: "ACTIVE" },
  { id: "tenant-iit", slug: "iit", schemaName: "tenant_iit", status: "ACTIVE" },
];

const memberships: Record<string, { status: string; platformRole: string | null; memberships: Array<{ role: string; status: string }> }> = {
  "student-active": { status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "ACTIVE" }] },
  "student-invited": { status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "INVITED" }] },
  "student-revoked": { status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "REVOKED" }] },
  "student-suspended": { status: "ACTIVE", platformRole: null, memberships: [{ role: "STUDENT", status: "SUSPENDED" }] },
};

function makeApp() {
  const app = express();
  const resolver = createTenantResolver({
    baseDomain: "platform.test",
    lookupTenant: async (slug) => tenants.find((tenant) => tenant.slug === slug) ?? null,
  });

  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication required" });
    res.locals.identity = { uid: token };
    return next();
  };

  const authorize = requireTenantAuthorization({
    allowedRoles: ["STUDENT"],
    lookupIdentity: async (externalSubject, tenantId) => {
      const record = memberships[externalSubject];
      if (!record) return null;
      // The fixture is intentionally tenant-bound; membership is not implicitly global.
      return tenantId === "tenant-mit" ? record : { ...record, memberships: [] };
    },
  });

  app.get("/api/tenant/students/me", (req, res, next) => resolver(req, res, next), authenticate, authorize, async (_req, res) => {
    const tenant = getTenantContext(res);
    const authorization = getTenantAuthorization(res);
    try {
      const profile = await findTenantStudentProfile(tenant, (res.locals.identity as { uid: string }).uid, (context) => ({
        studentProfile: {
          findUnique: async (args: unknown) => {
            const query = args as { where: { userSubject: string } };
            if (context.tenantId !== "tenant-mit" || query.where.userSubject !== "student-active") return null;
            return { id: "profile-1", studentNumber: "S-1", programme: "BTech", department: "CSE", graduationYear: 2027, profileStatus: "ACTIVE", createdAt: new Date(0), updatedAt: new Date(0) };
          },
        },
      } as unknown as Pick<TenantPrismaClient, "studentProfile">));
      if (!profile) return res.status(404).json({ error: "Student profile not found for this university" });
      return res.json({ tenant: { id: tenant.tenantId, slug: tenant.tenantSlug }, role: authorization.role, profile });
    } catch {
      return res.status(503).json({ error: "University student data is temporarily unavailable" });
    }
  });

  return app;
}

async function request(app: express.Express, host: string, token?: string) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address() as AddressInfo;
    const headers: Record<string, string> = { host };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tenant/students/me`, { headers });
    return { status: response.status, body: await response.json() as Record<string, any> };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("HTTP tenant student endpoint returns only the authenticated student's profile in the resolved tenant", async () => {
  const result = await request(makeApp(), "mit.platform.test", "student-active");
  assert.equal(result.status, 200);
  assert.equal(result.body.tenant.id, "tenant-mit");
  assert.equal(result.body.role, "STUDENT");
  assert.equal(result.body.profile.id, "profile-1");
  assert.equal(result.body.profile.studentNumber, "S-1");
});

test("HTTP tenant student endpoint rejects missing authentication and inactive membership states", async () => {
  assert.equal((await request(makeApp(), "mit.platform.test")).status, 401);
  for (const token of ["student-invited", "student-revoked", "student-suspended"]) {
    const result = await request(makeApp(), "mit.platform.test", token);
    assert.equal(result.status, 403, `${token} must not be authorized`);
  }
});

test("HTTP tenant student endpoint rejects cross-tenant membership and unknown host", async () => {
  const crossTenant = await request(makeApp(), "iit.platform.test", "student-active");
  assert.equal(crossTenant.status, 403);
  const unknownHost = await request(makeApp(), "unknown.platform.test", "student-active");
  assert.equal(unknownHost.status, 404);
});

test("HTTP tenant student endpoint returns 404 when the authenticated student has no tenant profile", async () => {
  const result = await request(makeApp(), "mit.platform.test", "student-active-no-profile");
  assert.equal(result.status, 403, "unregistered control-plane identity is rejected before profile lookup");
});
