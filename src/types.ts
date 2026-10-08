export type UserRole = 'employer' | 'institution' | 'student' | 'simulation' | 'super_admin';

export interface VerifiedSkill {
  name: string;
  category: 'technical' | 'domain' | 'communication' | 'tools';
  score: number;
  percentile: number;
  badge: 'Gold' | 'Silver' | 'Bronze' | 'Verified' | 'Unverified';
  verifiedAt: string;
  verifiedBy: string;
}

export interface StudentProject {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  projectUrl?: string;
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

export interface CampaignConsentPermission {
  campaignId: string;
  employerId: string;
  employerName: string;
  role: string;
  salaryLPA?: string | number;
  status: 'approved' | 'denied' | 'pending';
  academicDataShared: boolean;
  skillBenchmarksShared: boolean;
  projectReposShared: boolean;
  contactInfoShared: boolean;
  updatedAt: string;
  reasonForDenial?: string;
}

export interface ConsentAuditRecord {
  id: string;
  timestamp: string;
  action: 'APPROVED' | 'DENIED' | 'MODIFIED_SCOPES' | 'REVOKED_ALL' | 'GRANTED_ALL';
  targetCampaign: string;
  employerName: string;
  details: string;
  actor: string;
}

export interface StudentGlobalPrivacySettings {
  allowUnsolicitedPings: boolean;
  anonymizeProfileUntilConsent: boolean;
  shareVerifiedBadgesGlobally: boolean;
  autoDeclineBelowMinSalary: boolean;
}

export type EvidenceClaimType = 'identity' | 'enrollment' | 'degree' | 'academic_record' | 'skill' | 'project_ownership' | 'internship' | 'employment' | 'placement_outcome' | 'other';
export type EvidenceStatus = 'self_declared' | 'submitted' | 'under_review' | 'verified' | 'rejected' | 'expired';

export interface CareerPassportEvidence {
  id: string;
  studentId: string;
  claimType: EvidenceClaimType;
  claimLabel: string;
  sourceType: 'student' | 'institution' | 'employer' | 'assessment_provider' | 'approved_identity_provider' | 'other_authority';
  evidenceRef: string;
  submittedAt: string;
  status: EvidenceStatus;
  verifierUid?: string;
  verifiedAt?: string;
  expiresAt?: string;
  reviewReason?: string;
  disputeStatus?: 'none' | 'open' | 'resolved';
}

export interface VerificationRecord {
  id: string;
  evidenceId: string;
  studentId: string;
  claimType: EvidenceClaimType;
  authorityType: CareerPassportEvidence['sourceType'];
  verifierUid: string;
  status: Extract<EvidenceStatus, 'verified' | 'rejected' | 'expired'>;
  verifiedAt: string;
  expiresAt?: string;
  reason?: string;
  auditEventId: string;
}

export interface StudentCareerPassport {
  id: string;
  name: string;
  avatar: string;
  email: string;
  isEmpanelledCampus: boolean;
  candidateType?: 'empanelled_campus' | 'independent_direct';
  institutionId: string;
  institutionName: string;
  institutionCode: string;
  rollNumber?: string;
  institutionVerificationStatus: 'verified' | 'pending' | 'rejected' | 'not_applicable';
  platformVerificationStatus: 'verified' | 'pending' | 'rejected';
  verificationNotes?: string;
  independentCredentials?: {
    collegeName: string;
    universityAffiliation?: string;
    state: string;
    city: string;
    degree: string;
    branch: string;
    graduationYear: number;
    cgpa: number;
    rollNumber?: string;
    idProofType?: string;
    idProofNumber?: string;
    portfolioUrl?: string;
    certificateUrls?: string[];
    submissionDate?: string;
  };
  state: string;
  program: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
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
  campaignConsents?: Record<string, CampaignConsentPermission>;
  consentAuditTrail?: ConsentAuditRecord[];
  globalDataPrivacy?: StudentGlobalPrivacySettings;
  evidenceItems?: CareerPassportEvidence[];
  verificationRecords?: VerificationRecord[];
}

export interface BranchInventory { branchName: string; totalStudents: number; placementSeeking: number; verifiedCount: number; assessmentReady: number; highMatchCount: number; }
export interface BatchInventory { batchYear: number; program: string; totalStudents: number; placementSeeking: number; verifiedCount: number; assessmentReady: number; highMatchCount: number; branches: BranchInventory[]; }
export interface Institution {
  id: string; name: string; code: string;
  type: 'Central University' | 'State Engineering College' | 'Institute of Technology' | 'Autonomous College' | 'Private University';
  state: string; city: string; empanelmentStatus: 'empanelled' | 'pending_empanelment' | 'rejected'; tier?: 'Tier 1' | 'Tier 2' | 'Tier 3'; accreditation?: string; empanelmentDate?: string; verifiedByAdmin?: string;
  placementOfficerName: string; placementOfficerEmail: string; placementOfficerPhone: string; totalStudentSupply: number; responseRatePercent: number; historicalOfferRatePercent: number; historicalJoiningRatePercent: number; overallRating: number; specializations: string[]; batches: BatchInventory[];
  publishedAvailability?: { batchYear: number; branch: string; talentCount: number; description: string; publishedAt: string; }[];
}
export interface Employer {
  id: string; name: string; logo: string; industry: string; headquarters: string; openRequirementsCount: number; totalHiresCount: number; reputationScore: number; verified: boolean; verificationStatus: 'verified' | 'pending' | 'rejected'; tier?: 'platinum' | 'gold' | 'silver'; verificationDate?: string; verifiedByAdmin?: string; businessRegNumber?: string; gstinOrCin?: string; websiteUrl?: string; contactEmail?: string;
}
export interface HiringRequirement {
  id: string; employerId: string; employerName: string; role: string; vacancies: number; education: string[]; graduationYears: number[]; branches: string[]; requiredSkills: string[]; experienceLevel: string; locations: string[]; salaryMinLPA: number; salaryMaxLPA: number; joiningWindow: string; assessmentRequirements: string[]; selectionProcess: string[]; candidateProfileSummary: string; createdAt: string; status: 'active' | 'draft' | 'fulfilled';
}
export type CallStatus = 'pending' | 'accepted' | 'partial' | 'counter' | 'declined';
export interface CallForTalent { id: string; campaignId: string; employerId: string; employerName: string; institutionId: string; institutionName: string; role: string; vacanciesRequested: number; salaryLPA: string; locations: string[]; joiningWindow: string; deadline: string; status: CallStatus; responseNotes?: string; offeredCandidatesCount?: number; counterDaysExtension?: number; createdAt: string; respondedAt?: string; }
export type RecruitmentStage = 'invited' | 'consented' | 'declined' | 'assessment_pending' | 'assessment_completed' | 'shortlisted' | 'interviewing' | 'offered' | 'accepted' | 'joined' | 'rejected';
export interface StudentConsentOpportunity { id: string; callId?: string; campaignId: string; employerId: string; employerName: string; role: string; salaryLPA: number; locations: string[]; joiningWindow: string; studentId: string; studentName: string; institutionId: string; institutionName: string; matchScore: number; matchBreakdown: { skillMatchScore: number; academicMatchScore: number; preferenceMatchScore: number; aiRationale: string; }; alignmentReasons?: string[]; stage: RecruitmentStage; assessmentScore?: number; interviewFeedback?: string; offerLetterUrl?: string; invitedAt: string; consentedAt?: string; stageUpdatedAt: string; }
export type StudentOpportunity = StudentConsentOpportunity;
export interface CampaignFunnelMetrics { requiredVacancies: number; institutionsInvited: number; institutionsAccepted: number; studentsInvited: number; applicationsConsented: number; assessmentsCompleted: number; shortlisted: number; interviewed: number; offersMade: number; offersAccepted: number; joined: number; }
export interface RecruitmentCampaign { id: string; requirementId: string; requirement: HiringRequirement; title: string; employerId: string; employerName: string; createdAt: string; status: 'active' | 'in_progress' | 'completed'; funnel: CampaignFunnelMetrics; targetedInstitutionIds: string[]; callsSent: CallForTalent[]; candidateOpportunities: StudentConsentOpportunity[]; }
export interface InstitutionSupplyMatch { institution: Institution; fitScore: number; eligibleStudentsCount: number; strongMatchCount: number; availableSeekingCount: number; reasons: string[]; historicalPerformance: { offerRatePercent: number; joiningRatePercent: number; previousHires: number; }; }
export interface StudentCandidateMatch { studentId: string; student: StudentCareerPassport; candidateFitScore: number; matchedSkills: string[]; missingSkills: string[]; alignmentPoints: string[]; aiRecommendation: string; visibilityDenied?: boolean; visibilityStatus?: 'approved' | 'denied' | 'pending'; redactedReason?: string; }
export interface InstitutionalReputationEntry { institutionId: string; institutionName: string; roleCategory: string; eligibleSample: number; applicants: number; offerRatePercent: number; joiningRatePercent: number; skillAccuracyPercent: number; benchmarkScore: number; notableStrength: string; }

export interface InterviewScorecard {
  id: string;
  opportunityId: string;
  candidateName: string;
  role: string;
  interviewerName: string;
  submittedAt: string;
  technicalRigor: number; // 1-5
  problemSolving: number; // 1-5
  communication: number; // 1-5
  cultureAlignment: number; // 1-5
  overallScore: number;
  recommendation: 'strong_hire' | 'hire' | 'borderline' | 'no_hire';
  notes: string;
}

export interface PlacementPolicyConfig {
  oneStudentOneJobEnabled: boolean;
  regularTierMaxLPA: number;
  dreamTierMinLPA: number;
  superDreamTierMinLPA: number;
  allowDreamUpgrades: boolean;
}

export interface AccreditationBranchRecord {
  branch: string;
  totalStudents: number;
  placedStudents: number;
  medianSalaryLPA: number;
  meanSalaryLPA: number;
  malePlaced: number;
  femalePlaced: number;
  higherStudiesCount: number;
}
