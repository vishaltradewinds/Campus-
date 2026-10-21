import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type RequisitionClient = Pick<TenantPrismaClient, "employerRecruiter" | "jobRequisition" | "jobRequisitionAuditEvent" | "$transaction">;
type RequisitionResult =
  | { kind: "created"; requisitionId: string; status: "DRAFT" }
  | { kind: "updated"; requisitionId: string; status: string }
  | { kind: "not_found" }
  | { kind: "not_authorized" }
  | { kind: "invalid_state" };

function requiredText(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > max) {
    throw new Error(`${field} must be between 2 and ${max} characters`);
  }
  return value.trim();
}

function eligibleValues(input: unknown, field: string, maxCount: number): string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxCount || input.some((v) => typeof v !== "string" || !v.trim() || v.trim().length > 160)) {
    throw new Error(`${field} must be a list of at most ${maxCount} non-empty values`);
  }
  return [...new Set(input.map((v: string) => v.trim()))];
}

function eligibleYears(input: unknown): number[] {
  if (input === undefined) return [];
  const year = new Date().getUTCFullYear();
  if (!Array.isArray(input) || input.length > 20 || input.some((v) => !Number.isInteger(v) || v < year - 1 || v > year + 8)) {
    throw new Error("eligibleYears must contain valid graduation years");
  }
  return [...new Set(input as number[])];
}

function closeDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === "") return null;
  const date = new Date(String(input));
  if (Number.isNaN(date.getTime())) throw new Error("closesAt must be a valid date");
  if (date <= new Date()) throw new Error("closesAt must be in the future");
  return date;
}

export async function createTenantRequisition(
  context: TenantContext,
  actorSubject: string,
  input: { employerId?: unknown; title?: unknown; description?: unknown; eligibleYears?: unknown; eligiblePrograms?: unknown; closesAt?: unknown },
  getClient: (context: TenantContext) => RequisitionClient = getTenantPrismaClient,
): Promise<RequisitionResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  const employerId = typeof input.employerId === "string" ? input.employerId.trim() : "";
  if (!employerId || employerId.length > 128) throw new Error("A valid employer ID is required");
  const title = requiredText(input.title, "title", 200);
  const description = requiredText(input.description, "description", 10000);
  const years = eligibleYears(input.eligibleYears);
  const programs = eligibleValues(input.eligiblePrograms, "eligiblePrograms", 100);
  const closesAt = closeDate(input.closesAt);
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const membership = await tx.employerRecruiter.findFirst({
      where: { userSubject: actorSubject, employerId, role: "RECRUITER", employer: { verification: "VERIFIED" } },
      select: { employerId: true },
    });
    if (!membership) return { kind: "not_authorized" as const };
    const job = await tx.jobRequisition.create({
      data: { employerId, title, description, eligibleYears: years, eligiblePrograms: programs, closesAt, status: "DRAFT" },
      select: { id: true, status: true },
    });
    await tx.jobRequisitionAuditEvent.create({
      data: { requisitionId: job.id, eventType: "DRAFT_CREATED", actorSubject, metadata: { tenantId: context.tenantId, employerId } },
    });
    return { kind: "created" as const, requisitionId: job.id, status: "DRAFT" as const };
  });
}

export async function transitionTenantRequisition(
  context: TenantContext,
  actorSubject: string,
  requisitionId: string,
  input: { action?: unknown; title?: unknown; description?: unknown; eligibleYears?: unknown; eligiblePrograms?: unknown; closesAt?: unknown },
  getClient: (context: TenantContext) => RequisitionClient = getTenantPrismaClient,
  now = new Date(),
): Promise<RequisitionResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (!requisitionId.trim() || requisitionId.length > 128) throw new Error("A valid requisition ID is required");
  const action = input.action;
  if (action !== "edit" && action !== "publish" && action !== "close") throw new Error("action must be edit, publish, or close");
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const job = await tx.jobRequisition.findUnique({
      where: { id: requisitionId },
      select: { id: true, employerId: true, title: true, description: true, status: true, closesAt: true },
    });
    if (!job) return { kind: "not_found" as const };
    const membership = await tx.employerRecruiter.findFirst({
      where: { userSubject: actorSubject, employerId: job.employerId, role: "RECRUITER", employer: { verification: "VERIFIED" } },
      select: { employerId: true },
    });
    if (!membership) return { kind: "not_authorized" as const };
    if (action === "edit") {
      if (job.status !== "DRAFT") return { kind: "invalid_state" as const };
      const data: Record<string, unknown> = {};
      if (input.title !== undefined) data.title = requiredText(input.title, "title", 200);
      if (input.description !== undefined) data.description = requiredText(input.description, "description", 10000);
      if (input.eligibleYears !== undefined) data.eligibleYears = eligibleYears(input.eligibleYears);
      if (input.eligiblePrograms !== undefined) data.eligiblePrograms = eligibleValues(input.eligiblePrograms, "eligiblePrograms", 100);
      if (input.closesAt !== undefined) data.closesAt = closeDate(input.closesAt);
      if (Object.keys(data).length === 0) throw new Error("At least one editable field is required");
      await tx.jobRequisition.update({ where: { id: job.id }, data });
      await tx.jobRequisitionAuditEvent.create({
        data: { requisitionId: job.id, eventType: "DRAFT_EDITED", actorSubject, metadata: { tenantId: context.tenantId, fields: Object.keys(data) } },
      });
      return { kind: "updated" as const, requisitionId: job.id, status: "DRAFT" };
    }
    if (action === "publish") {
      if (job.status !== "DRAFT" || job.title.trim().length < 2 || job.description.trim().length < 2 || (job.closesAt && job.closesAt <= now)) {
        return { kind: "invalid_state" as const };
      }
      await tx.jobRequisition.update({ where: { id: job.id }, data: { status: "PUBLISHED", publishedAt: now } });
      await tx.jobRequisitionAuditEvent.create({
        data: { requisitionId: job.id, eventType: "PUBLISHED", actorSubject, metadata: { tenantId: context.tenantId } },
      });
      return { kind: "updated" as const, requisitionId: job.id, status: "PUBLISHED" };
    }
    if (job.status !== "PUBLISHED") return { kind: "invalid_state" as const };
    await tx.jobRequisition.update({ where: { id: job.id }, data: { status: "CLOSED", closesAt: now } });
    await tx.jobRequisitionAuditEvent.create({
      data: { requisitionId: job.id, eventType: "CLOSED", actorSubject, metadata: { tenantId: context.tenantId } },
    });
    return { kind: "updated" as const, requisitionId: job.id, status: "CLOSED" };
  });
}

export function createTenantRequisitionHandler(action: "create" | "transition") {
  return async function tenantRequisitionHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = action === "create"
        ? await createTenantRequisition(context, identity.uid, req.body || {})
        : await transitionTenantRequisition(context, identity.uid, String(req.params.jobId || ""), req.body || {});
      if (result.kind === "created") return res.status(201).json({ requisition: result });
      if (result.kind === "updated") return res.json({ requisition: result });
      if (result.kind === "not_found") return res.status(404).json({ error: "Job requisition not found" });
      if (result.kind === "not_authorized") return res.status(403).json({ error: "Verified employer recruiter membership is required" });
      return res.status(409).json({ error: "The requested requisition transition is not allowed from its current state" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/must be between|must be a list|graduation years|valid date|in the future|valid employer ID|valid requisition ID|action must be|editable field|Authenticated recruiter/.test(message)) {
        return res.status(400).json({ error: message });
      }
      console.error("Tenant requisition lifecycle operation failed", error);
      return res.status(503).json({ error: "Recruiter job management is temporarily unavailable" });
    }
  };
}
