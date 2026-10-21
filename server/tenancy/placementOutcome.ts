import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type PlacementOutcomeClient = Pick<TenantPrismaClient, "jobRequisition" | "employerRecruiter" | "jobApplication" | "jobApplicationAuditEvent" | "$transaction">;
type PlacementOutcomeResult =
  | { kind: "recorded"; applicationId: string; outcome: "JOINED" | "NOT_JOINED"; joinedAt: Date | null }
  | { kind: "not_found" }
  | { kind: "not_authorized" }
  | { kind: "invalid_state" };

export async function recordTenantJoiningOutcome(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  applicationId: string,
  input: { outcome?: unknown; reason?: unknown; joinedAt?: unknown },
  getClient: (context: TenantContext) => PlacementOutcomeClient = getTenantPrismaClient,
  now = new Date(),
): Promise<PlacementOutcomeResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!applicationId.trim() || applicationId.length > 128) throw new Error("A valid application ID is required");
  if (input.outcome !== "JOINED" && input.outcome !== "NOT_JOINED") throw new Error("outcome must be JOINED or NOT_JOINED");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 10 || reason.length > 1000) throw new Error("Outcome reason must be between 10 and 1000 characters");
  let joinedAt: Date | null = null;
  if (input.outcome === "JOINED") {
    if (typeof input.joinedAt !== "string" || !input.joinedAt.trim()) throw new Error("JOINED outcome requires a valid joinedAt date");
    joinedAt = new Date(input.joinedAt);
    if (Number.isNaN(joinedAt.getTime()) || joinedAt > now) throw new Error("joinedAt must be a valid date that is not in the future");
  } else if (input.joinedAt !== undefined && input.joinedAt !== null && input.joinedAt !== "") {
    throw new Error("NOT_JOINED outcome must not include joinedAt");
  }

  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const job = await tx.jobRequisition.findUnique({ where: { id: requisitionId }, select: { id: true, employerId: true } });
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
    if (application.status !== "OFFER_ACCEPTED") return { kind: "invalid_state" as const };
    const outcome = input.outcome;
    const changed = await tx.jobApplication.updateMany({
      where: { id: application.id, requisitionId: job.id, status: "OFFER_ACCEPTED" },
      data: {
        status: outcome,
        joinedAt,
        outcomeRecordedAt: now,
        outcomeRecordedBySubject: actorSubject,
        outcomeReason: reason,
      },
    });
    if (changed.count !== 1) return { kind: "invalid_state" as const };
    await tx.jobApplicationAuditEvent.create({
      data: {
        applicationId: application.id,
        eventType: outcome === "JOINED" ? "PLACEMENT_JOINED" : "PLACEMENT_NOT_JOINED",
        actorSubject,
        metadata: { tenantId: context.tenantId, requisitionId: job.id, outcome, joinedAt: joinedAt?.toISOString() ?? null, reason },
      },
    });
    return { kind: "recorded" as const, applicationId: application.id, outcome, joinedAt };
  });
}

export function createTenantPlacementOutcomeHandler(record: typeof recordTenantJoiningOutcome = recordTenantJoiningOutcome) {
  return async function tenantPlacementOutcomeHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await record(context, identity.uid, String(req.params.jobId || ""), String(req.params.applicationId || ""), req.body || {});
      if (result.kind === "not_found") return res.status(404).json({ error: "Application or requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Only an OFFER_ACCEPTED application can receive a joining outcome" });
      return res.json({ placement: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated recruiter|valid requisition ID|valid application ID|outcome must be|Outcome reason|JOINED outcome|joinedAt must|NOT_JOINED outcome/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant placement outcome failed", error);
      return res.status(503).json({ error: "Placement outcome is temporarily unavailable" });
    }
  };
}
