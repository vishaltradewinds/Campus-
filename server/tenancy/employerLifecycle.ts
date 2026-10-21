import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type EmployerLifecycleClient = Pick<TenantPrismaClient, "employer" | "employerRecruiter" | "employerAuditEvent" | "$transaction">;
export type EmployerLifecycleResult =
  | { kind: "created"; employerId: string; verification: "PENDING" }
  | { kind: "verified"; employerId: string }
  | { kind: "rejected" | "suspended" | "revoked"; employerId: string; verification: "REJECTED" | "SUSPENDED" | "REVOKED" }
  | { kind: "not_found" }
  | { kind: "invalid_state" };

export async function onboardTenantEmployer(
  context: TenantContext,
  actorSubject: string,
  input: { legalName: string; displayName: string },
  getClient: (context: TenantContext) => EmployerLifecycleClient = getTenantPrismaClient,
): Promise<EmployerLifecycleResult> {
  const legalName = input.legalName.trim();
  const displayName = input.displayName.trim();
  if (!actorSubject.trim()) throw new Error("Authenticated recruiter subject is required");
  if (legalName.length < 2 || legalName.length > 200) throw new Error("Legal name must be between 2 and 200 characters");
  if (displayName.length < 2 || displayName.length > 200) throw new Error("Display name must be between 2 and 200 characters");
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const employer = await tx.employer.create({
      data: {
        legalName,
        displayName,
        verification: "PENDING",
        recruiters: { create: { userSubject: actorSubject, role: "RECRUITER" } },
      },
      select: { id: true, verification: true },
    });
    await tx.employerAuditEvent.create({
      data: {
        employerId: employer.id,
        eventType: "ONBOARDING_SUBMITTED",
        actorSubject,
        metadata: { tenantId: context.tenantId, legalName, displayName },
      },
    });
    return { kind: "created", employerId: employer.id, verification: "PENDING" };
  });
}

export async function verifyTenantEmployer(
  context: TenantContext,
  actorSubject: string,
  employerId: string,
  getClient: (context: TenantContext) => EmployerLifecycleClient = getTenantPrismaClient,
): Promise<EmployerLifecycleResult> {
  if (!employerId.trim() || employerId.length > 128) throw new Error("A valid employer ID is required");
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const employer = await tx.employer.findUnique({
      where: { id: employerId },
      select: { id: true, verification: true },
    });
    if (!employer) return { kind: "not_found" };
    if (employer.verification !== "PENDING") return { kind: "invalid_state" };
    const changed = await tx.employer.updateMany({ where: { id: employer.id, verification: "PENDING" }, data: { verification: "VERIFIED" } });
    if (changed.count !== 1) return { kind: "invalid_state" };
    await tx.employerAuditEvent.create({
      data: {
        employerId: employer.id,
        eventType: "VERIFIED",
        actorSubject,
        metadata: { tenantId: context.tenantId },
      },
    });
    return { kind: "verified", employerId: employer.id };
  });
}


export async function changeTenantEmployerStatus(
  context: TenantContext,
  actorSubject: string,
  employerId: string,
  action: "reject" | "suspend" | "revoke",
  input: { reason: string; evidenceReference: string },
  getClient: (context: TenantContext) => EmployerLifecycleClient = getTenantPrismaClient,
): Promise<EmployerLifecycleResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated university administrator subject is required");
  if (!employerId.trim() || employerId.length > 128) throw new Error("A valid employer ID is required");
  const reason = input.reason.trim();
  const evidenceReference = input.evidenceReference.trim();
  if (reason.length < 10 || reason.length > 1000) throw new Error("Reason must be between 10 and 1000 characters");
  if (evidenceReference.length < 1 || evidenceReference.length > 500) throw new Error("Evidence reference must be between 1 and 500 characters");
  const target = action === "reject" ? "REJECTED" : action === "suspend" ? "SUSPENDED" : "REVOKED";
  const allowed = action === "reject" ? ["PENDING"] : action === "suspend" ? ["VERIFIED"] : ["VERIFIED", "SUSPENDED"];
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const employer = await tx.employer.findUnique({ where: { id: employerId }, select: { id: true, verification: true } });
    if (!employer) return { kind: "not_found" as const };
    if (!allowed.includes(employer.verification)) return { kind: "invalid_state" as const };
    const changed = await tx.employer.updateMany({
      where: { id: employer.id, verification: { in: allowed } },
      data: { verification: target },
    });
    if (changed.count !== 1) return { kind: "invalid_state" as const };
    await tx.employerAuditEvent.create({
      data: {
        employerId: employer.id,
        eventType: target,
        actorSubject,
        metadata: { tenantId: context.tenantId, reason, evidenceReference, fromVerification: employer.verification, toVerification: target },
      },
    });
    return { kind: action === "reject" ? "rejected" as const : action === "suspend" ? "suspended" as const : "revoked" as const, employerId: employer.id, verification: target };
  });
}

export function createTenantEmployerLifecycleHandler(action: "onboard" | "verify" | "reject" | "suspend" | "revoke", getClient?: (context: TenantContext) => EmployerLifecycleClient) {
  return async function tenantEmployerLifecycleHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const employerId = typeof req.params.employerId === "string" ? req.params.employerId : "";
      const result = action === "onboard"
        ? await onboardTenantEmployer(context, identity.uid, {
            legalName: typeof req.body?.legalName === "string" ? req.body.legalName : "",
            displayName: typeof req.body?.displayName === "string" ? req.body.displayName : "",
          }, getClient)
        : action === "verify"
          ? await verifyTenantEmployer(context, identity.uid, employerId, getClient)
          : await changeTenantEmployerStatus(context, identity.uid, employerId, action, {
              reason: typeof req.body?.reason === "string" ? req.body.reason : "",
              evidenceReference: typeof req.body?.evidenceReference === "string" ? req.body.evidenceReference : "",
            }, getClient);
      if (result.kind === "created") return res.status(201).json({ employer: result });
      if (result.kind === "verified" || result.kind === "rejected" || result.kind === "suspended" || result.kind === "revoked") return res.json({ employer: result });
      if (result.kind === "not_found") return res.status(404).json({ error: "Employer not found" });
      return res.status(409).json({ error: "Employer is not in a state that permits this transition" });
    } catch (error) {
      if (error instanceof Error && /must be between|Evidence reference|Authenticated recruiter|Authenticated university administrator|valid employer ID/.test(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Tenant employer lifecycle operation failed", error);
      return res.status(503).json({ error: "Employer lifecycle operation is temporarily unavailable" });
    }
  };
}
