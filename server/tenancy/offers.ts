import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type OfferClient = Pick<TenantPrismaClient, "jobRequisition" | "employerRecruiter" | "jobApplication" | "applicationOffer" | "applicationOfferAuditEvent" | "$transaction">;
type OfferResult =
  | { kind: "issued" | "already_issued"; offerId: string; status: "ISSUED"; expiresAt: Date }
  | { kind: "accepted" | "declined" | "already_responded"; offerId: string; status: "ACCEPTED" | "DECLINED" }
  | { kind: "expired"; offerId: string; status: "EXPIRED" }
  | { kind: "withdrawn"; offerId: string; status: "WITHDRAWN" }
  | { kind: "not_found" }
  | { kind: "not_authorized" }
  | { kind: "not_shortlisted" }
  | { kind: "invalid_state" }
  | { kind: "request_conflict" };

const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

function validateOfferInput(input: { requestId?: unknown; offerReference?: unknown; documentReference?: unknown; expiresAt?: unknown }, now: Date) {
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  if (!requestIdPattern.test(requestId)) throw new Error("A valid offer requestId is required");
  const offerReference = typeof input.offerReference === "string" ? input.offerReference.trim() : "";
  if (offerReference.length < 2 || offerReference.length > 200) throw new Error("Offer reference must be between 2 and 200 characters");
  const documentReference = typeof input.documentReference === "string" ? input.documentReference.trim() : "";
  if (!documentReference || documentReference.length > 2000) throw new Error("Document reference must be between 1 and 2000 characters");
  if (typeof input.expiresAt !== "string" || !input.expiresAt.trim()) throw new Error("A valid future offer expiresAt is required");
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new Error("A valid future offer expiresAt is required");
  return { requestId, offerReference, documentReference, expiresAt };
}

export async function issueTenantOffer(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  applicationId: string,
  input: { requestId?: unknown; offerReference?: unknown; documentReference?: unknown; expiresAt?: unknown },
  getClient: (context: TenantContext) => OfferClient = getTenantPrismaClient,
  now = new Date(),
): Promise<OfferResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!applicationId.trim() || applicationId.length > 128) throw new Error("A valid application ID is required");
  const normalized = validateOfferInput(input, now);
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
      const application = await tx.jobApplication.findUnique({ where: { id: applicationId }, select: { id: true, requisitionId: true, status: true } });
      if (!application || application.requisitionId !== job.id) return { kind: "not_found" as const };
      const existing = await tx.applicationOffer.findUnique({
        where: { requestId: normalized.requestId },
        select: { id: true, applicationId: true, createdBySubject: true, status: true, expiresAt: true },
      });
      if (existing) {
        if (existing.applicationId === application.id && existing.createdBySubject === actorSubject && existing.status === "ISSUED") {
          return { kind: "already_issued" as const, offerId: existing.id, status: "ISSUED" as const, expiresAt: existing.expiresAt };
        }
        return { kind: "request_conflict" as const };
      }
      if (application.status !== "SHORTLISTED") return { kind: "not_shortlisted" as const };
      const changed = await tx.jobApplication.updateMany({
        where: { id: application.id, requisitionId: job.id, status: "SHORTLISTED" },
        data: { status: "OFFERED" },
      });
      if (changed.count !== 1) return { kind: "invalid_state" as const };
      const offer = await tx.applicationOffer.create({
        data: { applicationId: application.id, ...normalized, status: "ISSUED", createdBySubject: actorSubject },
        select: { id: true, expiresAt: true, status: true },
      });
      await tx.applicationOfferAuditEvent.create({
        data: { offerId: offer.id, eventType: "OFFER_ISSUED", actorSubject, metadata: { tenantId: context.tenantId, requisitionId: job.id, applicationId: application.id, requestId: normalized.requestId, offerReference: normalized.offerReference, expiresAt: normalized.expiresAt.toISOString() } },
      });
      await tx.jobApplicationAuditEvent.create({
        data: { applicationId: application.id, eventType: "APPLICATION_OFFERED", actorSubject, metadata: { tenantId: context.tenantId, offerId: offer.id, offerReference: normalized.offerReference } },
      });
      return { kind: "issued" as const, offerId: offer.id, status: "ISSUED" as const, expiresAt: offer.expiresAt };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const raced = await client.applicationOffer.findUnique({ where: { requestId: normalized.requestId }, select: { id: true, applicationId: true, createdBySubject: true, status: true, expiresAt: true } });
      if (raced?.applicationId === applicationId && raced.createdBySubject === actorSubject && raced.status === "ISSUED") {
        return { kind: "already_issued", offerId: raced.id, status: "ISSUED", expiresAt: raced.expiresAt };
      }
      return { kind: "request_conflict" };
    }
    throw error;
  }
}

export async function respondToTenantOffer(
  context: TenantContext,
  studentSubject: string,
  offerId: string,
  decision: unknown,
  responseNote: unknown,
  getClient: (context: TenantContext) => OfferClient = getTenantPrismaClient,
  now = new Date(),
): Promise<OfferResult> {
  if (!studentSubject.trim()) throw new Error("Authenticated student subject is required");
  if (!offerId.trim() || offerId.length > 128) throw new Error("A valid offer ID is required");
  if (decision !== "ACCEPT" && decision !== "DECLINE") throw new Error("decision must be ACCEPT or DECLINE");
  const note = typeof responseNote === "string" ? responseNote.trim() : "";
  if (note.length > 500) throw new Error("Offer response note must be 500 characters or fewer");
  const client = getClient(context);
  try {
    return await client.$transaction(async (tx) => {
    const offer = await tx.applicationOffer.findUnique({
      where: { id: offerId },
      select: { id: true, applicationId: true, status: true, expiresAt: true, application: { select: { studentSubject: true, status: true } } },
    });
    if (!offer) return { kind: "not_found" as const };
    if (offer.application.studentSubject !== studentSubject) return { kind: "not_authorized" as const };
    const target = decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    if (offer.status === target) return { kind: "already_responded" as const, offerId: offer.id, status: target };
    if (offer.status !== "ISSUED" || offer.application.status !== "OFFERED") return { kind: "invalid_state" as const };
    if (offer.expiresAt <= now) {
      const expired = await tx.applicationOffer.updateMany({ where: { id: offer.id, status: "ISSUED" }, data: { status: "EXPIRED" } });
      if (expired.count !== 1) return { kind: "invalid_state" as const };
      await tx.applicationOfferAuditEvent.create({ data: { offerId: offer.id, eventType: "OFFER_EXPIRED", actorSubject: studentSubject, metadata: { tenantId: context.tenantId } } });
      const applicationExpired = await tx.jobApplication.updateMany({ where: { id: offer.applicationId, status: "OFFERED" }, data: { status: "OFFER_EXPIRED" } });
      if (applicationExpired.count !== 1) throw Object.assign(new Error("Offer state changed during expiry"), { code: "OFFER_STATE_CHANGED" });
      await tx.jobApplicationAuditEvent.create({ data: { applicationId: offer.applicationId, eventType: "APPLICATION_OFFER_EXPIRED", actorSubject: studentSubject, metadata: { tenantId: context.tenantId, offerId: offer.id } } });
      return { kind: "expired" as const, offerId: offer.id, status: "EXPIRED" as const };
    }
    const updated = await tx.applicationOffer.updateMany({
      where: { id: offer.id, status: "ISSUED" },
      data: { status: target, respondedAt: now, responseNote: note || null },
    });
    if (updated.count !== 1) return { kind: "invalid_state" as const };
    const applicationStatus = decision === "ACCEPT" ? "OFFER_ACCEPTED" : "OFFER_DECLINED";
    const applicationUpdated = await tx.jobApplication.updateMany({
      where: { id: offer.applicationId, status: "OFFERED" },
      data: { status: applicationStatus },
    });
    if (applicationUpdated.count !== 1) throw Object.assign(new Error("Offer state changed during response"), { code: "OFFER_STATE_CHANGED" });
    await tx.applicationOfferAuditEvent.create({
      data: { offerId: offer.id, eventType: target, actorSubject: studentSubject, metadata: { tenantId: context.tenantId, responseNote: note || null } },
    });
    await tx.jobApplicationAuditEvent.create({
      data: { applicationId: offer.applicationId, eventType: applicationStatus, actorSubject: studentSubject, metadata: { tenantId: context.tenantId, offerId: offer.id } },
    });
    return { kind: decision === "ACCEPT" ? "accepted" as const : "declined" as const, offerId: offer.id, status: target };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "OFFER_STATE_CHANGED") return { kind: "invalid_state" };
    throw error;
  }
}


export async function withdrawTenantOffer(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  offerId: string,
  reason: unknown,
  getClient: (context: TenantContext) => OfferClient = getTenantPrismaClient,
): Promise<OfferResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  if (!offerId.trim() || offerId.length > 128) throw new Error("A valid offer ID is required");
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (normalizedReason.length < 10 || normalizedReason.length > 1000) throw new Error("Withdrawal reason must be between 10 and 1000 characters");
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
      const offer = await tx.applicationOffer.findUnique({
        where: { id: offerId },
        select: { id: true, applicationId: true, status: true, application: { select: { requisitionId: true, status: true } } },
      });
      if (!offer || offer.application.requisitionId !== job.id) return { kind: "not_found" as const };
      if (offer.status !== "ISSUED" || offer.application.status !== "OFFERED") return { kind: "invalid_state" as const };
      const changed = await tx.applicationOffer.updateMany({ where: { id: offer.id, status: "ISSUED" }, data: { status: "WITHDRAWN" } });
      if (changed.count !== 1) return { kind: "invalid_state" as const };
      const applicationChanged = await tx.jobApplication.updateMany({ where: { id: offer.applicationId, status: "OFFERED" }, data: { status: "OFFER_WITHDRAWN" } });
      if (applicationChanged.count !== 1) throw Object.assign(new Error("Offer state changed during withdrawal"), { code: "OFFER_STATE_CHANGED" });
      await tx.applicationOfferAuditEvent.create({
        data: { offerId: offer.id, eventType: "OFFER_WITHDRAWN", actorSubject, metadata: { tenantId: context.tenantId, requisitionId: job.id, reason: normalizedReason } },
      });
      await tx.jobApplicationAuditEvent.create({
        data: { applicationId: offer.applicationId, eventType: "APPLICATION_OFFER_WITHDRAWN", actorSubject, metadata: { tenantId: context.tenantId, offerId: offer.id, reason: normalizedReason } },
      });
      return { kind: "withdrawn" as const, offerId: offer.id, status: "WITHDRAWN" as const };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "OFFER_STATE_CHANGED") return { kind: "invalid_state" };
    throw error;
  }
}

export async function listTenantStudentOffers(
  context: TenantContext,
  studentSubject: string,
  getClient: (context: TenantContext) => OfferClient = getTenantPrismaClient,
): Promise<{ offers: Array<{ id: string; offerReference: string; documentReference: string; status: string; issuedAt: Date; expiresAt: Date; respondedAt: Date | null; responseNote: string | null; application: { requisition: { title: string; employer: { displayName: string } } } }> }> {
  if (!studentSubject.trim()) throw new Error("Authenticated student subject is required");
  const client = getClient(context);
  const offers = await client.applicationOffer.findMany({
    where: { application: { studentSubject } },
    orderBy: { issuedAt: "desc" },
    take: 100,
    select: {
      id: true,
      offerReference: true,
      documentReference: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      respondedAt: true,
      responseNote: true,
      application: {
        select: {
          requisition: {
            select: { title: true, employer: { select: { displayName: true } } },
          },
        },
      },
    },
  });
  return { offers };
}

export function createTenantOfferIssueHandler(issue: typeof issueTenantOffer = issueTenantOffer) {
  return async function tenantOfferIssueHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await issue(context, identity.uid, String(req.params.jobId || ""), String(req.params.applicationId || ""), req.body || {});
      if (result.kind === "not_found") return res.status(404).json({ error: "Application or requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      if (result.kind === "not_shortlisted") return res.status(409).json({ error: "Only shortlisted applications can receive an offer" });
      if (result.kind === "request_conflict") return res.status(409).json({ error: "This offer requestId was already used for a different request" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Application state changed; retry after refreshing" });
      return res.status(result.kind === "issued" ? 201 : 200).json({ offer: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated recruiter|valid requisition ID|valid application ID|offer requestId|Offer reference|Document reference|future offer expiresAt/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant offer issuance failed", error);
      return res.status(503).json({ error: "Offer issuance is temporarily unavailable" });
    }
  };
}

export function createTenantOfferResponseHandler(respond: typeof respondToTenantOffer = respondToTenantOffer) {
  return async function tenantOfferResponseHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await respond(context, identity.uid, String(req.params.offerId || ""), req.body?.decision, req.body?.responseNote);
      if (result.kind === "not_found") return res.status(404).json({ error: "Offer not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "This offer does not belong to the authenticated student" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Offer is not in a state that permits this response" });
      if (result.kind === "expired") return res.status(409).json({ offer: result, error: "The offer has expired" });
      return res.json({ offer: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated student|valid offer ID|decision must be|response note/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant offer response failed", error);
      return res.status(503).json({ error: "Offer response is temporarily unavailable" });
    }
  };
}


export function createTenantOfferWithdrawHandler(withdraw: typeof withdrawTenantOffer = withdrawTenantOffer) {
  return async function tenantOfferWithdrawHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = await withdraw(context, identity.uid, String(req.params.jobId || ""), String(req.params.offerId || ""), req.body?.reason);
      if (result.kind === "not_found") return res.status(404).json({ error: "Offer or requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Only an issued offer on an OFFERED application can be withdrawn" });
      return res.json({ offer: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Authenticated recruiter|valid requisition ID|valid offer ID|Withdrawal reason/.test(message)) return res.status(400).json({ error: message });
      console.error("Tenant offer withdrawal failed", error);
      return res.status(503).json({ error: "Offer withdrawal is temporarily unavailable" });
    }
  };
}

export function createTenantStudentOffersHandler(list: typeof listTenantStudentOffers = listTenantStudentOffers) {
  return async function tenantStudentOffersHandler(_req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try { return res.json(await list(context, identity.uid)); }
    catch (error) { console.error("Tenant student offer listing failed", error); return res.status(503).json({ error: "Student offers are temporarily unavailable" }); }
  };
}
