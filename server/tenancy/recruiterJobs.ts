import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type RecruiterJobsClient = Pick<TenantPrismaClient, "employerRecruiter" | "jobRequisition">;

export async function listTenantRecruiterJobs(
  context: TenantContext,
  userSubject: string,
  getClient: (context: TenantContext) => RecruiterJobsClient = getTenantPrismaClient,
) {
  if (!userSubject.trim()) throw new Error("Authenticated user subject is required");
  const client = getClient(context);
  const memberships = await client.employerRecruiter.findMany({
    where: { userSubject, employer: { verification: "VERIFIED" } },
    select: { employerId: true },
  });
  const employerIds = [...new Set(memberships.map((membership) => membership.employerId))];
  if (employerIds.length === 0) return [];
  return client.jobRequisition.findMany({
    where: { employerId: { in: employerIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      closesAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { applications: true } },
    },
  });
}

export function createTenantRecruiterJobsHandler(
  listJobs: typeof listTenantRecruiterJobs = listTenantRecruiterJobs,
) {
  return async function tenantRecruiterJobsHandler(_req: Request, res: Response, _next: NextFunction) {
    try {
      const context = res.locals.tenant as TenantContext | undefined;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const jobs = await listJobs(context, identity.uid);
      return res.json({ tenant: { id: context.tenantId, slug: context.tenantSlug }, jobs });
    } catch (error) {
      console.error("Tenant recruiter job discovery failed", error);
      return res.status(503).json({ error: "Recruiter job listings are temporarily unavailable" });
    }
  };
}
