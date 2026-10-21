import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type ApplicationReviewClient = Pick<TenantPrismaClient, "jobRequisition" | "employerRecruiter" | "jobApplication" | "$transaction">;
type ReviewResult =
  | { kind: "updated"; applicationId: string; status: "SHORTLISTED" | "REJECTED" }
  | { kind: "not_found" }
  | { kind: "not_authorized" }
  | { kind: "invalid_state" };

export async function reviewTenantApplication(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  applicationId: string,
  decision: unknown,
  getClient: (context: TenantContext) => ApplicationReviewClient = getTenantPrismaClient,
): Promise<ReviewResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!applicationId.trim() || applicationId.length > 128) throw new Error("A valid application ID is required");
  if (decision !== "SHORTLISTED" && decision !== "REJECTED") throw new Error("decision must be SHORTLISTED or REJECTED");

  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const job = await tx.jobRequisition.findUnique({
      where: { id: requisitionId },
      select: { id: true, employerId: true },
    });
    if (!job) return { kind: "not_found" as const };

    const membership = await tx.employerRecruiter.findFirst({
      where: { userSubject: actorSubject, employerId: job.employerId, role: "RECRUITER", employer: { verification: "VERIFIED" } },
      select: { employerId: true },
    });
    if (!membership) return { kind: "not_authorized" as const };

    const application = await tx.jobApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, requisitionId: true, status: true },
    });
    if (!application || application.requisitionId !== job.id) return { kind: "not_found" as const };
    if (application.status !== "APPLIED") return { kind: "invalid_state" as const };

    const changed = await tx.jobApplication.updateMany({
      where: { id: application.id, requisitionId: job.id, status: "APPLIED" },
      data: { status: decision },
    });
    if (changed.count !== 1) return { kind: "invalid_state" as const };

    await tx.jobApplicationAuditEvent.create({
      data: {
        applicationId: application.id,
        eventType: decision === "SHORTLISTED" ? "APPLICATION_SHORTLISTED" : "APPLICATION_REJECTED",
        actorSubject,
        metadata: { tenantId: context.tenantId, requisitionId: job.id, fromStatus: "APPLIED", toStatus: decision },
      },
    });
    return { kind: "updated" as const, applicationId: application.id, status: decision };
  });
}

export function createTenantApplicationReviewHandler(
  review: typeof reviewTenantApplication = reviewTenantApplication,
) {
  return async function tenantApplicationReviewHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await review(context, identity.uid, String(req.params.jobId || ""), String(req.params.applicationId || ""), req.body?.decision);
      if (result.kind === "not_found") return res.status(404).json({ error: "Application or requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Only an APPLIED application can be shortlisted or rejected" });
      return res.json({ application: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated recruiter|valid requisition ID|valid application ID|decision must be/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant application review failed", error);
      return res.status(503).json({ error: "Application review is temporarily unavailable" });
    }
  };
}
