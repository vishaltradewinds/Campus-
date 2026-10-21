import type { PrismaClient as TenantPrismaClient } from "../../generated/tenant/index.js";
import type { TenantContext } from "./tenantResolver";
import { getTenantPrismaClient } from "./prismaClients";

type StudentProfileClient = Pick<TenantPrismaClient, "studentProfile">;

export async function findTenantStudentProfile(
  context: TenantContext,
  userSubject: string,
  getClient: (context: TenantContext) => StudentProfileClient = getTenantPrismaClient,
) {
  if (!userSubject.trim()) throw new Error("Authenticated user subject is required");
  return getClient(context).studentProfile.findUnique({
    where: { userSubject },
    select: {
      id: true,
      studentNumber: true,
      programme: true,
      department: true,
      graduationYear: true,
      profileStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
