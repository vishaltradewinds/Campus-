import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type StudentJobsClient = Pick<TenantPrismaClient, "studentProfile" | "jobRequisition">;

export async function listTenantStudentJobs(
  context: TenantContext,
  userSubject: string,
  getClient: (context: TenantContext) => StudentJobsClient = getTenantPrismaClient,
  now = new Date(),
) {
  if (!userSubject.trim()) throw new Error("Authenticated user subject is required");
  const client = getClient(context);
  const profile = await client.studentProfile.findUnique({
    where: { userSubject },
    select: { graduationYear: true, programme: true },
  });
  if (!profile) return null;

  const eligibilityFilters = [
    profile.graduationYear == null
      ? { eligibleYears: { isEmpty: true } }
      : { OR: [{ eligibleYears: { isEmpty: true } }, { eligibleYears: { has: profile.graduationYear } }] },
    profile.programme == null
      ? { eligiblePrograms: { isEmpty: true } }
      : { OR: [{ eligiblePrograms: { isEmpty: true } }, { eligiblePrograms: { has: profile.programme } }] },
  ];

  return client.jobRequisition.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: now },
      AND: [
        { OR: [{ closesAt: null }, { closesAt: { gte: now } }] },
        ...eligibilityFilters,
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      eligibleYears: true,
      eligiblePrograms: true,
      publishedAt: true,
      closesAt: true,
      employer: { select: { displayName: true } },
    },
  });
}

export function createTenantStudentJobsHandler(
  listJobs: typeof listTenantStudentJobs = listTenantStudentJobs,
) {
  return async function tenantStudentJobsHandler(_req: Request, res: Response, _next: NextFunction) {
    try {
      const context = res.locals.tenant as TenantContext | undefined;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const jobs = await listJobs(context, identity.uid);
      if (jobs === null) return res.status(404).json({ error: "Student profile not found for this university" });
      return res.json({ tenant: { id: context.tenantId, slug: context.tenantSlug }, jobs });
    } catch (error) {
      console.error("Tenant student job discovery failed", error);
      return res.status(503).json({ error: "University job listings are temporarily unavailable" });
    }
  };
}
