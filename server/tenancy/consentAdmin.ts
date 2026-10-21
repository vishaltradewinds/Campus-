import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type ConsentAdminClient = Pick<TenantPrismaClient, "applicationConsentPolicy" | "consentPolicyAuditEvent" | "$transaction">;
const PURPOSE = "JOB_APPLICATION";
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type ConsentAdminResult =
  | { kind: "created"; policyId: string; version: string; contentHash: string }
  | { kind: "published"; policyId: string; version: string; contentHash: string }
  | { kind: "retired"; policyId: string; version: string }
  | { kind: "not_found" }
  | { kind: "invalid_state" }
  | { kind: "effective_time_invalid" };

export async function createTenantConsentDraft(
  context: TenantContext,
  actorSubject: string,
  input: { version: string; content: string; effectiveAt: string },
  getClient: (context: TenantContext) => ConsentAdminClient = getTenantPrismaClient,
  now = new Date(),
): Promise<ConsentAdminResult> {
  const version = input.version.trim();
  const content = input.content.trim();
  const effectiveAt = new Date(input.effectiveAt);
  if (!versionPattern.test(version)) throw new Error("Consent version must use 1-64 letters, numbers, dots, underscores or hyphens");
  if (content.length < 20 || content.length > 10000) throw new Error("Consent content must be between 20 and 10000 characters");
  if (!input.effectiveAt || Number.isNaN(effectiveAt.getTime()) || effectiveAt < now) return { kind: "effective_time_invalid" };
  const contentHash = `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
  const client = getClient(context);
  const policy = await client.applicationConsentPolicy.create({
    data: { purpose: PURPOSE, version, content, contentHash, status: "DRAFT", effectiveAt },
    select: { id: true, version: true, contentHash: true },
  });
  await client.consentPolicyAuditEvent.create({
    data: { policyId: policy.id, eventType: "DRAFT_CREATED", actorSubject, contentHash, metadata: { tenantId: context.tenantId, purpose: PURPOSE } },
  });
  return { kind: "created", policyId: policy.id, version: policy.version, contentHash: policy.contentHash };
}

export async function publishTenantConsentPolicy(
  context: TenantContext,
  actorSubject: string,
  policyId: string,
  getClient: (context: TenantContext) => ConsentAdminClient = getTenantPrismaClient,
  now = new Date(),
): Promise<ConsentAdminResult> {
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const policy = await tx.applicationConsentPolicy.findUnique({
      where: { id: policyId },
      select: { id: true, purpose: true, version: true, status: true, effectiveAt: true, contentHash: true },
    });
    if (!policy) return { kind: "not_found" };
    if (policy.status !== "DRAFT") return { kind: "invalid_state" };
    if (policy.effectiveAt > now) return { kind: "effective_time_invalid" };
    await tx.applicationConsentPolicy.updateMany({
      where: { purpose: policy.purpose, status: "PUBLISHED", id: { not: policy.id } },
      data: { status: "RETIRED", retiredAt: now },
    });
    await tx.applicationConsentPolicy.update({
      where: { id: policy.id },
      data: { status: "PUBLISHED" },
    });
    await tx.consentPolicyAuditEvent.create({
      data: { policyId: policy.id, eventType: "PUBLISHED", actorSubject, contentHash: policy.contentHash, metadata: { tenantId: context.tenantId, purpose: policy.purpose } },
    });
    return { kind: "published", policyId: policy.id, version: policy.version, contentHash: policy.contentHash };
  });
}

export async function retireTenantConsentPolicy(
  context: TenantContext,
  actorSubject: string,
  policyId: string,
  getClient: (context: TenantContext) => ConsentAdminClient = getTenantPrismaClient,
  now = new Date(),
): Promise<ConsentAdminResult> {
  const client = getClient(context);
  return client.$transaction(async (tx) => {
    const policy = await tx.applicationConsentPolicy.findUnique({
      where: { id: policyId },
      select: { id: true, version: true, status: true, contentHash: true },
    });
    if (!policy) return { kind: "not_found" };
    if (policy.status !== "PUBLISHED") return { kind: "invalid_state" };
    await tx.applicationConsentPolicy.update({
      where: { id: policy.id },
      data: { status: "RETIRED", retiredAt: now },
    });
    await tx.consentPolicyAuditEvent.create({
      data: { policyId: policy.id, eventType: "RETIRED", actorSubject, contentHash: policy.contentHash, metadata: { tenantId: context.tenantId } },
    });
    return { kind: "retired", policyId: policy.id, version: policy.version };
  });
}

export function createTenantConsentAdminHandler(
  action: "create" | "publish" | "retire",
  perform?: typeof createTenantConsentDraft | typeof publishTenantConsentPolicy | typeof retireTenantConsentPolicy,
) {
  return async function tenantConsentAdminHandler(req: Request, res: Response, _next: NextFunction) {
    try {
      const context = res.locals.tenant as TenantContext | undefined;
      const identity = res.locals.identity as { uid?: string } | undefined;
      if (!context) return res.status(503).json({ error: "Tenant context is required" });
      if (!identity?.uid) return res.status(401).json({ error: "Authenticated identity is required" });
      const result = action === "create"
        ? await (perform as typeof createTenantConsentDraft | undefined ?? createTenantConsentDraft)(context, identity.uid, {
            version: typeof req.body?.version === "string" ? req.body.version : "",
            content: typeof req.body?.content === "string" ? req.body.content : "",
            effectiveAt: typeof req.body?.effectiveAt === "string" ? req.body.effectiveAt : "",
          })
        : action === "publish"
          ? await (perform as typeof publishTenantConsentPolicy | undefined ?? publishTenantConsentPolicy)(context, identity.uid, String(req.params.policyId || ""))
          : await (perform as typeof retireTenantConsentPolicy | undefined ?? retireTenantConsentPolicy)(context, identity.uid, String(req.params.policyId || ""));
      if (result.kind === "not_found") return res.status(404).json({ error: "Consent policy not found" });
      if (result.kind === "invalid_state") return res.status(409).json({ error: "Consent policy is not in a state that permits this operation" });
      if (result.kind === "effective_time_invalid") return res.status(409).json({ error: "Consent policy effective time must be valid and not in the future" });
      return res.status(result.kind === "created" ? 201 : 200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("Consent version") || message.startsWith("Consent content")) return res.status(400).json({ error: message });
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return res.status(409).json({ error: "That consent version already exists" });
      console.error("Tenant consent policy administration failed", error);
      return res.status(503).json({ error: "Consent policy administration is temporarily unavailable" });
    }
  };
}
