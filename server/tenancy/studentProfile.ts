import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type StudentProfileClient = Pick<TenantPrismaClient, "studentProfile">;

export async function findTenantStudentProfile(
  context: TenantContext,
  userSubject: string,
  getClient: (context: TenantContext) => StudentProfileClient = getTenantPrismaClient,
) {
  if (!userSubject.trim()) throw new Error("Authenticated user subject is required");
  return getClient(context).studentProfile.findUnique({
    where: { userSubject },
    select: {
      id: true,
      studentNumber: true,
      programme: true,
      department: true,
      graduationYear: true,
      profileStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}


export function createTenantStudentProfileHandler(
  findProfile: typeof findTenantStudentProfile = findTenantStudentProfile,
) {
  return async function tenantStudentProfileHandler(_req: Request, res: Response, _next: NextFunction) {
    try {
      const context = (res.locals.tenant ?? null) as TenantContext | null;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const profile = await findProfile(context, identity.uid);
      if (!profile) return res.status(404).json({ error: "Student profile not found for this university" });
      return res.json({ tenant: { id: context.tenantId, slug: context.tenantSlug }, profile });
    } catch (error) {
      console.error("Tenant student profile lookup failed", error);
      return res.status(503).json({ error: "University student data is temporarily unavailable" });
    }
  };
}
