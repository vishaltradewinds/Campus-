import type { NextFunction, Request, Response } from "express";
import { getControlPlaneClient } from "./prismaClients";
import type { PrismaClient as ControlPlanePrismaClient } from "../../generated/control-plane/index.js";
import { getTenantContext } from "./tenantResolver";

export type TenantMembershipRole = "UNIVERSITY_ADMIN" | "RECRUITER" | "STUDENT";
export type AuthorizedRole = TenantMembershipRole | "SYSTEM_ADMIN";

export interface TenantAuthorizationOptions {
  allowedRoles: TenantMembershipRole[];
  allowSystemAdmin?: boolean;
  /** Optional dependency seam for isolated HTTP integration tests; production uses the control-plane database. */
  lookupIdentity?: (externalSubject: string, tenantId: string) => Promise<{
    status: string;
    platformRole: string | null;
    memberships: Array<{ role: string; status: string }>;
  } | null>;
}

export interface TenantAuthorizationContext {
  tenantId: string;
  role: AuthorizedRole;
  isSystemAdmin: boolean;
}

export function resolveTenantAuthorization(
  user: { status: string; platformRole: string | null; memberships: Array<{ role: string; status: string }> },
  tenantId: string,
  options: TenantAuthorizationOptions,
): TenantAuthorizationContext | null {
  if (user.status !== "ACTIVE") return null;
  if (user.platformRole === "SYSTEM_ADMIN") {
    return options.allowSystemAdmin
      ? { tenantId, role: "SYSTEM_ADMIN", isSystemAdmin: true }
      : null;
  }
  const allowed = new Set(options.allowedRoles);
  const membershipRole = user.memberships.find(({ role, status }) => status === "ACTIVE" && allowed.has(role as TenantMembershipRole))?.role as TenantMembershipRole | undefined;
  if (!membershipRole || !allowed.has(membershipRole)) return null;
  return { tenantId, role: membershipRole, isSystemAdmin: false };
}

export function requireTenantAuthorization(
  options: TenantAuthorizationOptions,
  getControlClient: () => Pick<ControlPlanePrismaClient, "userIdentity"> = getControlPlaneClient,
) {
  return async function tenantAuthorization(_req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = getTenantContext(res);
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });

      const user = options.lookupIdentity
        ? await options.lookupIdentity(identity.uid, tenant.tenantId)
        : await getControlClient().userIdentity.findUnique({
            where: { externalSubject: identity.uid },
            select: {
              status: true,
              platformRole: true,
              memberships: {
                where: { tenantId: tenant.tenantId, status: "ACTIVE" },
                select: { role: true, status: true },
              },
            },
          });
      if (!user) return res.status(403).json({ error: "Active platform identity is required" });

      const authorization = resolveTenantAuthorization(user, tenant.tenantId, options);
      if (!authorization) return res.status(403).json({ error: "Active membership with the required role is required" });
      res.locals.tenantAuthorization = Object.freeze(authorization) satisfies TenantAuthorizationContext;
      return next();
    } catch (error) {
      console.error("Tenant authorization lookup failed", error);
      return res.status(503).json({ error: "Tenant authorization is temporarily unavailable" });
    }
  };
}

export function getTenantAuthorization(res: Response): TenantAuthorizationContext {
  const context = res.locals.tenantAuthorization as TenantAuthorizationContext | undefined;
  if (!context) throw new Error("Tenant authorization is required for this operation");
  return context;
}
