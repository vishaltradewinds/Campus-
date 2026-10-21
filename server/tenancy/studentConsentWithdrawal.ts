import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type WithdrawalClient = Pick<TenantPrismaClient, "applicationConsentPolicy" | "studentConsentWithdrawal" | "$transaction">;
type WithdrawalResult =
  | { kind: "withdrawn"; withdrawalId: string; policyVersion: string }
  | { kind: "already_withdrawn"; withdrawalId: string; policyVersion: string }
  | { kind: "policy_not_found" };

export async function withdrawTenantStudentConsent(
  context: TenantContext,
  actorSubject: string,
  policyVersion: string,
  reason: string | undefined,
  getClient: (context: TenantContext) => WithdrawalClient = getTenantPrismaClient,
): Promise<WithdrawalResult> {
  if (!actorSubject.trim()) throw new Error("Authenticated user subject is required");
  const version = policyVersion.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) throw new Error("A valid consent version is required");
  if (reason && reason.length > 500) throw new Error("Withdrawal reason must be 500 characters or fewer");
  const client = getClient(context);
  const policy = await client.applicationConsentPolicy.findFirst({
    where: { purpose: "JOB_APPLICATION", version, status: { in: ["PUBLISHED", "RETIRED"] } },
    select: { version: true },
  });
  if (!policy) return { kind: "policy_not_found" };
  const key = { actorSubject, purpose: "JOB_APPLICATION", policyVersion: version };
  try {
    return await client.$transaction(async (tx) => {
      // Match the application submission lock so withdrawal and submission have a defined order.
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", actorSubject, "JOB_APPLICATION");
      const existing = await tx.studentConsentWithdrawal.findUnique({
        where: { actorSubject_purpose_policyVersion: key },
        select: { id: true, policyVersion: true },
      });
      if (existing) return { kind: "already_withdrawn" as const, withdrawalId: existing.id, policyVersion: existing.policyVersion };
      const created = await tx.studentConsentWithdrawal.create({
        data: { ...key, reason: reason?.trim() || null },
        select: { id: true, policyVersion: true },
      });
      return { kind: "withdrawn" as const, withdrawalId: created.id, policyVersion: created.policyVersion };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const raced = await client.studentConsentWithdrawal.findUnique({
        where: { actorSubject_purpose_policyVersion: key },
        select: { id: true, policyVersion: true },
      });
      if (raced) return { kind: "already_withdrawn", withdrawalId: raced.id, policyVersion: raced.policyVersion };
    }
    throw error;
  }
}

export function createTenantConsentWithdrawalHandler(
  withdraw: typeof withdrawTenantStudentConsent = withdrawTenantStudentConsent,
) {
  return async function tenantConsentWithdrawalHandler(req: Request, res: Response, _next: NextFunction) {
    try {
      const context = res.locals.tenant as TenantContext | undefined;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const version = typeof req.body?.consentVersion === "string" ? req.body.consentVersion : "";
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const result = await withdraw(context, identity.uid, version, reason);
      if (result.kind === "policy_not_found") return res.status(404).json({ error: "Published consent version not found" });
      return res.status(200).json({ ...result, existingApplicationsRetained: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("consent version") || message.includes("Withdrawal reason")) return res.status(400).json({ error: message });
      console.error("Tenant student consent withdrawal failed", error);
      return res.status(503).json({ error: "Consent withdrawal is temporarily unavailable" });
    }
  };
}
