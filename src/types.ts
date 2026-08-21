export type UserRole = 'employer' | 'institution' | 'student' | 'simulation';

export interface VerifiedSkill {
  name: string;
  category: 'technical' | 'domain' | 'communication' | 'tools';
  score: number; // 0-100
  percentile: number;
  badge: 'Gold' | 'Silver' | 'Bronze' | 'Verified';
  verifiedAt: string;
  verifiedBy: string; // e.g. "Platform Coding Benchmark" or "Institutional Lab Assessment"
}

export interface StudentProject {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  verifiedScore?: number;
}

export interface StudentInternship {
  id: string;
  company: string;
  role: string;
  duration: string;
  summary: string;
  verified: boolean;
}

export interface StudentAssessmentScore {
  id: string;
  title: string;
  category: string;
  score: number;
  date: string;
  percentile: number;
}

export type StudentAvailability = 'actively_seeking' | 'open_to_offers' | 'not_currently_available';

export interface StudentCareerPassport {
  id: string;
  name: string;
  avatar: string;
  email: string;
  institutionId: string;
  institutionName: string;
  institutionCode: string;
  state: string;
  program: string; // e.g. "B.Tech"
  branch: string; // e.g. "Computer Science & Engineering"
  graduationYear: number; // e.g. 2027
  cgpa: number; // e.g. 8.9
  skills: VerifiedSkill[];
  projects: StudentProject[];
  internships: StudentInternship[];
  assessments: StudentAssessmentScore[];
  preferences: {
    targetRoles: string[];
    preferredLocations: string[];
    minSalaryLPA: number;
    expectedSalaryMinLPA?: number;
    employmentTypes: ('Full-Time' | 'Internship' | 'Contract')[];
  };
  availability: StudentAvailability;
  placementStatus: 'unplaced' | 'in_process' | 'placed';
  placedCompany?: string;
  placedSalaryLPA?: number;
}

export interface BranchInventory {
  branchName: string;
  totalStudents: number;
  placementSeeking: number;
  verifiedCount: number;
  assessmentReady: number;
  highMatchCount: number;
}

export interface BatchInventory {
  batchYear: number;
  program: string;
  totalStudents: number;
  placementSeeking: number;
  verifiedCount: number;
  assessmentReady: number;
  highMatchCount: number;
  branches: BranchInventory[];
}

export interface Institution {
  id: string;
  name: string;
  code: string;
  type: 'Central University' | 'State Engineering College' | 'Institute of Technology' | 'Autonomous College';
  state: string;
  city: string;
  placementOfficerName: string;
  placementOfficerEmail: string;
  placementOfficerPhone: string;
  totalStudentSupply: number;
  responseRatePercent: number; // e.g. 96%
  historicalOfferRatePercent: number; // e.g. 22%
  historicalJoiningRatePercent: number; // e.g. 94%
  overallRating: number; // e.g. 4.8
  specializations: string[];
  batches: BatchInventory[];
  publishedAvailability?: {
    batchYear: number;
    branch: string;
    talentCount: number;
    description: string;
    publishedAt: string;
  }[];
}

export interface Employer {
  id: string;
  name: string;
  logo: string;
  industry: string;
  headquarters: string;
  openRequirementsCount: number;
  totalHiresCount: number;
  reputationScore: number;
  verified: boolean;
}

export interface HiringRequirement {
  id: string;
  employerId: string;
  employerName: string;
  role: string;
  vacancies: number;
  education: string[];
  graduationYears: number[];
  branches: string[];
  requiredSkills: string[];
  experienceLevel: string;
  locations: string[];
  salaryMinLPA: number;
  salaryMaxLPA: number;
  joiningWindow: string;
  assessmentRequirements: string[];
  selectionProcess: string[];
  candidateProfileSummary: string;
  createdAt: string;
  status: 'active' | 'draft' | 'fulfilled';
}

export type CallStatus = 'pending' | 'accepted' | 'partial' | 'counter' | 'declined';

export interface CallForTalent {
  id: string;
  campaignId: string;
  employerId: string;
  employerName: string;
  institutionId: string;
  institutionName: string;
  role: string;
  vacanciesRequested: number;
  salaryLPA: string;
  locations: string[];
  joiningWindow: string;
  deadline: string;
  status: CallStatus;
  responseNotes?: string;
  offeredCandidatesCount?: number;
  counterDaysExtension?: number;
  createdAt: string;
  respondedAt?: string;
}

export type RecruitmentStage = 
  | 'invited'
  | 'consented'
  | 'declined'
  | 'assessment_pending'
  | 'assessment_completed'
  | 'shortlisted'
  | 'interviewing'
  | 'offered'
  | 'accepted'
  | 'joined'
  | 'rejected';

export interface StudentConsentOpportunity {
  id: string;
  callId?: string;
  campaignId: string;
  employerId: string;
  employerName: string;
  role: string;
  salaryLPA: number;
  locations: string[];
  joiningWindow: string;
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  matchScore: number; // 0-100
  matchBreakdown: {
    skillMatchScore: number;
    academicMatchScore: number;
    preferenceMatchScore: number;
    aiRationale: string;
  };
  alignmentReasons?: string[];
  stage: RecruitmentStage;
  assessmentScore?: number;
  interviewFeedback?: string;
  offerLetterUrl?: string;
  invitedAt: string;
  consentedAt?: string;
  stageUpdatedAt: string;
}

export type StudentOpportunity = StudentConsentOpportunity;

export interface CampaignFunnelMetrics {
  requiredVacancies: number;
  institutionsInvited: number;
  institutionsAccepted: number;
  studentsInvited: number;
  applicationsConsented: number;
  assessmentsCompleted: number;
  shortlisted: number;
  interviewed: number;
  offersMade: number;
  offersAccepted: number;
  joined: number;
}

export interface RecruitmentCampaign {
  id: string;
  requirementId: string;
  requirement: HiringRequirement;
  title: string;
  employerId: string;
  employerName: string;
  createdAt: string;
  status: 'active' | 'in_progress' | 'completed';
  funnel: CampaignFunnelMetrics;
  targetedInstitutionIds: string[];
  callsSent: CallForTalent[];
  candidateOpportunities: StudentConsentOpportunity[];
}

export interface InstitutionSupplyMatch {
  institution: Institution;
  fitScore: number; // 0-100
  eligibleStudentsCount: number;
  strongMatchCount: number;
  availableSeekingCount: number;
  reasons: string[];
  historicalPerformance: {
    offerRatePercent: number;
    joiningRatePercent: number;
    previousHires: number;
  };
}

export interface StudentCandidateMatch {
  student: StudentCareerPassport;
  candidateFitScore: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
  alignmentPoints: string[];
  aiRecommendation: string;
}

export interface InstitutionalReputationEntry {
  institutionId: string;
  institutionName: string;
  roleCategory: string;
  eligibleSample: number;
  applicants: number;
  offerRatePercent: number;
  joiningRatePercent: number;
  skillAccuracyPercent: number;
  benchmarkScore: number;
  notableStrength: string;
}
