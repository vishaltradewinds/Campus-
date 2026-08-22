import {
  Employer,
  Institution,
  StudentCareerPassport,
  HiringRequirement,
  RecruitmentCampaign,
  CallForTalent,
  StudentConsentOpportunity,
  InstitutionalReputationEntry,
} from '../types';

// Live production collections initialized empty - populated directly from real Firestore collections & registered users
export const INITIAL_EMPLOYERS: Employer[] = [];
export const INITIAL_INSTITUTIONS: Institution[] = [];
export const INITIAL_STUDENTS: StudentCareerPassport[] = [];
export const INITIAL_REQUIREMENTS: HiringRequirement[] = [];
export const INITIAL_CAMPAIGNS: RecruitmentCampaign[] = [];
export const INITIAL_CALLS_FOR_TALENT: CallForTalent[] = [];
export const INITIAL_STUDENT_OPPORTUNITIES: StudentConsentOpportunity[] = [];
export const INITIAL_REPUTATION_MATRIX: InstitutionalReputationEntry[] = [];
