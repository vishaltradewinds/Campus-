-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('UNIVERSITY_ADMIN', 'RECRUITER', 'STUDENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "schema_name" VARCHAR(63) NOT NULL,
    "canonical_host" VARCHAR(255),
    "status" "TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "external_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "display_name" VARCHAR(160),
    "platform_role" "PlatformRole",
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_events" (
    "id" TEXT NOT NULL,
    "actor_subject" VARCHAR(255),
    "tenant_id" VARCHAR(64),
    "action" VARCHAR(120) NOT NULL,
    "resource_type" VARCHAR(120) NOT NULL,
    "resource_id" VARCHAR(255),
    "correlation_id" VARCHAR(128) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_schema_name_key" ON "tenants"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_canonical_host_key" ON "tenants"("canonical_host");

-- CreateIndex
CREATE INDEX "tenants_status_slug_idx" ON "tenants"("status", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_external_subject_key" ON "user_identities"("external_subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_email_key" ON "user_identities"("email");

-- CreateIndex
CREATE INDEX "user_identities_status_email_idx" ON "user_identities"("status", "email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_status_role_idx" ON "memberships"("tenant_id", "status", "role");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_role_key" ON "memberships"("user_id", "tenant_id", "role");

-- CreateIndex
CREATE INDEX "platform_audit_events_tenant_id_created_at_idx" ON "platform_audit_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_events_actor_subject_created_at_idx" ON "platform_audit_events"("actor_subject", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_events_correlation_id_idx" ON "platform_audit_events"("correlation_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
