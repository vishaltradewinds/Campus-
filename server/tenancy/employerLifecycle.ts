import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type EmployerLifecycleClient = Pick<TenantPrismaClient, "employer" | "employerRecruiter" | "employerAuditEvent" | "$transaction">;
export type EmployerLifecycleResult =
  | { kind: "created"; employerId: string; verification: "PENDING" }
  | { kind: "verified"; employerId: string }
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
    await tx.employer.update({ where: { id: employer.id }, data: { verification: "VERIFIED" } });
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

export function createTenantEmployerLifecycleHandler(action: "onboard" | "verify", getClient?: (context: TenantContext) => EmployerLifecycleClient) {
  return async function tenantEmployerLifecycleHandler(req: Request, res: Response, _next: NextFunction) {
    const context = res.locals.tenant as TenantContext | undefined;
    const identity = res.locals.identity as { uid?: string } | undefined;
    if (!context) return res.status(503).json({ error: "Tenant context is required" });
    if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
    try {
      const result = action === "onboard"
        ? await onboardTenantEmployer(context, identity.uid, {
            legalName: typeof req.body?.legalName === "string" ? req.body.legalName : "",
            displayName: typeof req.body?.displayName === "string" ? req.body.displayName : "",
          }, getClient)
        : await verifyTenantEmployer(context, identity.uid, typeof req.params.employerId === "string" ? req.params.employerId : "", getClient);
      if (result.kind === "created") return res.status(201).json({ employer: result });
      if (result.kind === "verified") return res.json({ employer: result });
      if (result.kind === "not_found") return res.status(404).json({ error: "Employer not found" });
      return res.status(409).json({ error: "Employer is not in a verifiable state" });
    } catch (error) {
      if (error instanceof Error && /must be between|Authenticated recruiter/.test(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Tenant employer lifecycle operation failed", error);
      return res.status(503).json({ error: "Employer onboarding or verification is temporarily unavailable" });
    }
  };
}
