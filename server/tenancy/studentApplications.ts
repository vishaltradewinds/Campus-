import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type StudentApplicationClient = Pick<TenantPrismaClient, "studentProfile" | "jobRequisition" | "jobApplication">;
type ApplyResult =
  | { kind: "not_found" }
  | { kind: "ineligible" }
  | { kind: "closed" }
  | { kind: "already_applied"; applicationId: string }
  | { kind: "applied"; applicationId: string };

function eligible(profile: { graduationYear: number | null; programme: string | null }, job: { eligibleYears: number[]; eligiblePrograms: string[] }) {
  const yearMatches = job.eligibleYears.length === 0 || (profile.graduationYear != null && job.eligibleYears.includes(profile.graduationYear));
  const programmeMatches = job.eligiblePrograms.length === 0 || (profile.programme != null && job.eligiblePrograms.includes(profile.programme));
  return yearMatches && programmeMatches;
}

export async function applyToTenantJob(
  context: TenantContext,
  userSubject: string,
  requisitionId: string,
  consentVersion: string,
  getClient: (context: TenantContext) => StudentApplicationClient = getTenantPrismaClient,
  now = new Date(),
): Promise<ApplyResult> {
  if (!userSubject.trim()) throw new Error("Authenticated user subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!consentVersion.trim() || consentVersion.length > 64) throw new Error("A valid application consent version is required");

  const client = getClient(context);
  const profile = await client.studentProfile.findUnique({
    where: { userSubject },
    select: { graduationYear: true, programme: true },
  });
  if (!profile) return { kind: "not_found" };

  const job = await client.jobRequisition.findUnique({
    where: { id: requisitionId },
    select: { id: true, status: true, eligibleYears: true, eligiblePrograms: true, publishedAt: true, closesAt: true },
  });
  if (!job || job.status !== "PUBLISHED" || !job.publishedAt || job.publishedAt > now) return { kind: "closed" };
  if (job.closesAt && job.closesAt < now) return { kind: "closed" };
  if (!eligible(profile, job)) return { kind: "ineligible" };

  const existing = await client.jobApplication.findUnique({
    where: { requisitionId_studentSubject: { requisitionId: job.id, studentSubject: userSubject } },
    select: { id: true },
  });
  if (existing) return { kind: "already_applied", applicationId: existing.id };

  try {
    const application = await client.jobApplication.create({
      data: { requisitionId: job.id, studentSubject: userSubject, consentVersion: consentVersion.trim(), status: "APPLIED" },
      select: { id: true },
    });
    return { kind: "applied", applicationId: application.id };
  } catch (error) {
    // A concurrent duplicate request can win the unique constraint after the pre-check.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const raced = await client.jobApplication.findUnique({
        where: { requisitionId_studentSubject: { requisitionId: job.id, studentSubject: userSubject } },
        select: { id: true },
      });
      if (raced) return { kind: "already_applied", applicationId: raced.id };
    }
    throw error;
  }
}

export function createTenantJobApplicationHandler(
  apply: typeof applyToTenantJob = applyToTenantJob,
) {
  return async function tenantJobApplicationHandler(req: Request, res: Response, _next: NextFunction) {
    try {
      const context = res.locals.tenant as TenantContext | undefined;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const requisitionId = String(req.params.jobId || "");
      const consentVersion = typeof req.body?.consentVersion === "string" ? req.body.consentVersion : "";
      const result = await apply(context, identity.uid, requisitionId, consentVersion);
      if (result.kind === "not_found") return res.status(404).json({ error: "Student profile not found for this university" });
      if (result.kind === "ineligible") return res.status(403).json({ error: "This job is not eligible for your student profile" });
      if (result.kind === "closed") return res.status(409).json({ error: "This job is not open for applications" });
      if (result.kind === "already_applied") return res.status(200).json({ status: result.kind, applicationId: result.applicationId });
      return res.status(201).json({ status: result.kind, applicationId: result.applicationId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("valid requisition ID") || message.includes("consent version")) {
        return res.status(400).json({ error: message });
      }
      console.error("Tenant job application failed", error);
      return res.status(503).json({ error: "University applications are temporarily unavailable" });
    }
  };
}
