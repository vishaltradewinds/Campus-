import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type InterviewClient = Pick<TenantPrismaClient, "jobRequisition" | "employerRecruiter" | "jobApplication" | "applicationInterview" | "$transaction">;
type InterviewResult =
  | { kind: "scheduled" | "already_scheduled"; interviewId: string; scheduledAt: Date; status: "SCHEDULED" }
  | { kind: "cancelled"; interviewId: string; status: "CANCELLED" }
  | { kind: "not_found" }
  | { kind: "not_authorized" }
  | { kind: "not_shortlisted" }
  | { kind: "invalid_state" }
  | { kind: "request_conflict" };

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

function validateInterviewInput(input: { requestId?: unknown; scheduledAt?: unknown; durationMinutes?: unknown; mode?: unknown; locationOrJoinUrl?: unknown; instructions?: unknown }, now: Date) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  if (!requestIdPattern.test(requestId)) throw new Error("A valid interview requestId is required");
  if (typeof input.scheduledAt !== "string" || !input.scheduledAt.trim()) throw new Error("A valid future scheduledAt is required");
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) throw new Error("A valid future scheduledAt is required");
  const durationMinutes = input.durationMinutes === undefined ? 30 : input.durationMinutes;
  if (!Number.isInteger(durationMinutes) || Number(durationMinutes) < 15 || Number(durationMinutes) > 240) throw new Error("durationMinutes must be an integer between 15 and 240");
  if (input.mode !== "ONLINE" && input.mode !== "IN_PERSON" && input.mode !== "PHONE") throw new Error("mode must be ONLINE, IN_PERSON or PHONE");
  const locationOrJoinUrl = typeof input.locationOrJoinUrl === "string" ? input.locationOrJoinUrl.trim() : "";
  if (locationOrJoinUrl.length > 2000) throw new Error("locationOrJoinUrl must be 2000 characters or fewer");
  if (input.mode === "ONLINE") {
    try {
      const url = new URL(locationOrJoinUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      throw new Error("ONLINE interviews require a valid HTTP(S) join URL");
    }
  }
  if (input.mode === "IN_PERSON" && !locationOrJoinUrl) throw new Error("IN_PERSON interviews require a location");
  const instructions = typeof input.instructions === "string" ? input.instructions.trim() : "";
  if (instructions.length > 2000) throw new Error("instructions must be 2000 characters or fewer");
  return { requestId, scheduledAt, durationMinutes: Number(durationMinutes), mode: input.mode, locationOrJoinUrl: locationOrJoinUrl || null, instructions: instructions || null };
}

export async function scheduleTenantInterview(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  applicationId: string,
  input: { requestId?: unknown; scheduledAt?: unknown; durationMinutes?: unknown; mode?: unknown; locationOrJoinUrl?: unknown; instructions?: unknown },
  getClient: (context: TenantContext) => InterviewClient = getTenantPrismaClient,
  now = new Date(),
): Promise<InterviewResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!applicationId.trim() || applicationId.length > 128) throw new Error("A valid application ID is required");
  const normalized = validateInterviewInput(input, now);
  const client = getClient(context);
  try {
    return await client.$transaction(async (tx) => {
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
      const existing = await tx.applicationInterview.findUnique({
        where: { requestId: normalized.requestId },
        select: { id: true, applicationId: true, createdBySubject: true, scheduledAt: true, status: true },
      });
      if (existing) {
        if (existing.applicationId === application.id && existing.createdBySubject === actorSubject && existing.status === "SCHEDULED") {
          return { kind: "already_scheduled" as const, interviewId: existing.id, scheduledAt: existing.scheduledAt, status: "SCHEDULED" as const };
        }
        return { kind: "request_conflict" as const };
      }
      if (application.status !== "SHORTLISTED") return { kind: "not_shortlisted" as const };
      const interview = await tx.applicationInterview.create({
        data: { applicationId: application.id, ...normalized, status: "SCHEDULED", createdBySubject: actorSubject },
        select: { id: true, scheduledAt: true, status: true },
      });
      await tx.applicationInterviewAuditEvent.create({
        data: {
          interviewId: interview.id,
          eventType: "INTERVIEW_SCHEDULED",
          actorSubject,
          metadata: { tenantId: context.tenantId, requisitionId: job.id, applicationId: application.id, requestId: normalized.requestId, mode: normalized.mode, durationMinutes: normalized.durationMinutes },
        },
      });
      return { kind: "scheduled" as const, interviewId: interview.id, scheduledAt: interview.scheduledAt, status: "SCHEDULED" as const };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const raced = await client.applicationInterview.findUnique({ where: { requestId: normalized.requestId }, select: { id: true, applicationId: true, createdBySubject: true, scheduledAt: true, status: true } });
      if (raced?.applicationId === applicationId && raced.createdBySubject === actorSubject && raced.status === "SCHEDULED") {
        return { kind: "already_scheduled", interviewId: raced.id, scheduledAt: raced.scheduledAt, status: "SCHEDULED" };
      }
      return { kind: "request_conflict" };
    }
    throw error;
  }
}

export async function cancelTenantInterview(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  interviewId: string,
  getClient: (context: TenantContext) => InterviewClient = getTenantPrismaClient,
): Promise<InterviewResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!interviewId.trim() || interviewId.length > 128) throw new Error("A valid interview ID is required");
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const job = await tx.jobRequisition.findUnique({ where: { id: requisitionId }, select: { id: true, employerId: true } });
    if (!job) return { kind: "not_found" as const };
    const membership = await tx.employerRecruiter.findFirst({
      where: { userSubject: actorSubject, employerId: job.employerId, role: "RECRUITER", employer: { verification: "VERIFIED" } },
      select: { employerId: true },
    });
    if (!membership) return { kind: "not_authorized" as const };
    const interview = await tx.applicationInterview.findUnique({
      where: { id: interviewId },
      select: { id: true, status: true, application: { select: { requisitionId: true } } },
    });
    if (!interview || interview.application.requisitionId !== job.id) return { kind: "not_found" as const };
    if (interview.status !== "SCHEDULED") return { kind: "invalid_state" as const };
    const changed = await tx.applicationInterview.updateMany({ where: { id: interview.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) return { kind: "invalid_state" as const };
    await tx.applicationInterviewAuditEvent.create({
      data: { interviewId: interview.id, eventType: "INTERVIEW_CANCELLED", actorSubject, metadata: { tenantId: context.tenantId, requisitionId: job.id } },
    });
    return { kind: "cancelled" as const, interviewId: interview.id, status: "CANCELLED" as const };
  });
}

export async function listTenantStudentInterviews(
  context: TenantContext,
  studentSubject: string,
  getClient: (context: TenantContext) => InterviewClient = getTenantPrismaClient,
): Promise<{ interviews: Array<{ id: string; scheduledAt: Date; durationMinutes: number; mode: string; locationOrJoinUrl: string | null; instructions: string | null; application: { requisition: { title: string; employer: { displayName: string } } } }> }> {
  if (!studentSubject.trim()) throw new Error("Authenticated student subject is required");
  const client = getClient(context);
  const interviews = await client.applicationInterview.findMany({
    where: { status: "SCHEDULED", application: { studentSubject } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
    select: {
      id: true, scheduledAt: true, durationMinutes: true, mode: true, locationOrJoinUrl: true, instructions: true,
      application: { select: { requisition: { select: { title: true, employer: { select: { displayName: true } } } } } },
    },
  });
  return { interviews };
}

export function createTenantInterviewHandler(
  action: "schedule" | "cancel",
  schedule: typeof scheduleTenantInterview = scheduleTenantInterview,
  cancel: typeof cancelTenantInterview = cancelTenantInterview,
) {
  return async function tenantInterviewHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = action === "schedule"
        ? await schedule(context, identity.uid, String(req.params.jobId || ""), String(req.params.applicationId || ""), req.body || {})
        : await cancel(context, identity.uid, String(req.params.jobId || ""), String(req.params.interviewId || ""));
      if (result.kind === "not_found") return res.status(404).json({ error: "Interview, application or requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      if (result.kind === "not_shortlisted") return res.status(409).json({ error: "Only shortlisted applications can be scheduled for interview" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Only scheduled interviews can be cancelled" });
      if (result.kind === "request_conflict") return res.status(409).json({ error: "This interview requestId was already used for a different request" });
      return res.status(result.kind === "scheduled" ? 201 : 200).json({ interview: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated recruiter|valid requisition ID|valid application ID|valid interview ID|valid interview requestId|valid future scheduledAt|durationMinutes|mode must be|ONLINE interviews|IN_PERSON interviews|locationOrJoinUrl|instructions must be/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant interview scheduling failed", error);
      return res.status(503).json({ error: "Interview scheduling is temporarily unavailable" });
    }
  };
}

export function createTenantStudentInterviewsHandler(
  list: typeof listTenantStudentInterviews = listTenantStudentInterviews,
) {
  return async function tenantStudentInterviewsHandler(_req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      return res.json(await list(context, identity.uid));
    } catch (error) {
      console.error("Tenant student interview listing failed", error);
      return res.status(503).json({ error: "Student interviews are temporarily unavailable" });
    }
  };
}
