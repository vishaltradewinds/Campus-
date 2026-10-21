import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type StudentApplicationsClient = Pick<TenantPrismaClient, "studentProfile" | "jobApplication">;
type StudentApplicationSummary = {
  id: string;
  status: string;
  appliedAt: Date;
  consentVersion: string;
  joinedAt: Date | null;
  outcomeRecordedAt: Date | null;
  outcomeReason: string | null;
  requisition: { title: string; employer: { displayName: string } };
};

export async function listOwnTenantApplications(
  context: TenantContext,
  userSubject: string,
  getClient: (context: TenantContext) => StudentApplicationsClient = getTenantPrismaClient,
): Promise<{ kind: "not_found" } | { kind: "listed"; applications: StudentApplicationSummary[] }> {
  if (!userSubject.trim()) throw new Error("Authenticated student subject is required");
  const client = getClient(context);
  const profile = await client.studentProfile.findUnique({
    where: { userSubject },
    select: { id: true },
  });
  if (!profile) return { kind: "not_found" };
  const applications = await client.jobApplication.findMany({
    where: { studentSubject: userSubject },
    orderBy: { appliedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      appliedAt: true,
      consentVersion: true,
      joinedAt: true,
      outcomeRecordedAt: true,
      outcomeReason: true,
      requisition: { select: { title: true, employer: { select: { displayName: true } } } },
    },
  });
  return { kind: "listed", applications };
}

export function createTenantStudentApplicationsHandler(
  list: typeof listOwnTenantApplications = listOwnTenantApplications,
) {
  return async function tenantStudentApplicationsHandler(_req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await list(context, identity.uid);
      if (result.kind === "not_found") return res.status(404).json({ error: "Student profile not found for this university" });
      return res.json({ applications: result.applications });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Authenticated student subject")) return res.status(400).json({ error: message });
      console.error("Tenant student application listing failed", error);
      return res.status(503).json({ error: "Your applications are temporarily unavailable" });
    }
  };
}
