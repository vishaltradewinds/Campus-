-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_subject" VARCHAR(255) NOT NULL,
    "student_number" VARCHAR(100),
    "programme" VARCHAR(160),
    "department" VARCHAR(160),
    "graduation_year" INTEGER,
    "profile_status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employers" (
    "id" TEXT NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "verification" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_recruiters" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "user_subject" VARCHAR(255) NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'RECRUITER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_recruiters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "eligible_years" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "eligible_programs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "student_subject" VARCHAR(255) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'APPLIED',
    "consent_version" VARCHAR(64) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_subject_key" ON "student_profiles"("user_subject");

-- CreateIndex
CREATE INDEX "student_profiles_department_graduation_year_idx" ON "student_profiles"("department", "graduation_year");

-- CreateIndex
CREATE INDEX "student_profiles_profile_status_idx" ON "student_profiles"("profile_status");

-- CreateIndex
CREATE INDEX "employers_verification_legal_name_idx" ON "employers"("verification", "legal_name");

-- CreateIndex
CREATE INDEX "employer_recruiters_user_subject_idx" ON "employer_recruiters"("user_subject");

-- CreateIndex
CREATE UNIQUE INDEX "employer_recruiters_employer_id_user_subject_key" ON "employer_recruiters"("employer_id", "user_subject");

-- CreateIndex
CREATE INDEX "job_requisitions_status_published_at_closes_at_idx" ON "job_requisitions"("status", "published_at", "closes_at");

-- CreateIndex
CREATE INDEX "job_requisitions_employer_id_created_at_idx" ON "job_requisitions"("employer_id", "created_at");

-- CreateIndex
CREATE INDEX "job_applications_student_subject_status_idx" ON "job_applications"("student_subject", "status");

-- CreateIndex
CREATE INDEX "job_applications_requisition_id_status_applied_at_idx" ON "job_applications"("requisition_id", "status", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_requisition_id_student_subject_key" ON "job_applications"("requisition_id", "student_subject");

-- AddForeignKey
ALTER TABLE "employer_recruiters" ADD CONSTRAINT "employer_recruiters_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
