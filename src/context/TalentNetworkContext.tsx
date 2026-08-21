import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  Employer,
  Institution,
  StudentCareerPassport,
  HiringRequirement,
  RecruitmentCampaign,
  CallForTalent,
  StudentConsentOpportunity,
  InstitutionalReputationEntry,
  CallStatus,
  RecruitmentStage,
  InstitutionSupplyMatch,
  StudentCandidateMatch,
  CampaignConsentPermission,
  ConsentAuditRecord,
  StudentGlobalPrivacySettings,
} from '../types';
import {
  INITIAL_EMPLOYERS,
  INITIAL_INSTITUTIONS,
  INITIAL_STUDENTS,
  INITIAL_REQUIREMENTS,
  INITIAL_CAMPAIGNS,
  INITIAL_CALLS_FOR_TALENT,
  INITIAL_STUDENT_OPPORTUNITIES,
  INITIAL_REPUTATION_MATRIX,
} from '../data/mockData';

interface TalentNetworkContextType {
  // Navigation & Role State
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  selectedEmployerId: string;
  setSelectedEmployerId: (id: string) => void;
  selectedInstitutionId: string;
  setSelectedInstitutionId: (id: string) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;

  // Active Entities
  currentEmployer: Employer;
  currentInstitution: Institution;
  currentStudent: StudentCareerPassport;

  // Data Collections
  employers: Employer[];
  institutions: Institution[];
  students: StudentCareerPassport[];
  requirements: HiringRequirement[];
  campaigns: RecruitmentCampaign[];
  callsForTalent: CallForTalent[];
  studentOpportunities: StudentConsentOpportunity[];
  reputationMatrix: InstitutionalReputationEntry[];

  // Matching & Alignment Engines
  getInstitutionMatchesForRequirement: (req: HiringRequirement) => InstitutionSupplyMatch[];
  getStudentMatchesForRequirement: (req: HiringRequirement) => StudentCandidateMatch[];
  
  // Actions
  createRequirementAndCampaign: (
    reqData: Omit<HiringRequirement, 'id' | 'createdAt' | 'employerId' | 'employerName'>
  ) => { requirement: HiringRequirement; campaign: RecruitmentCampaign };

  sendCallForTalent: (
    campaignId: string,
    institutionIds: string[],
    vacanciesPerInst?: number
  ) => void;

  respondToCallForTalent: (
    callId: string,
    status: CallStatus,
    responseNotes: string,
    offeredCandidatesCount?: number,
    counterDaysExtension?: number
  ) => void;

  activateInstitutionStudents: (callId: string, studentIds: string[]) => void;

  submitStudentConsent: (opportunityId: string, consented: boolean) => void;
  studentConsentToOpportunity: (opportunityId: string) => void;
  declineOpportunity: (opportunityId: string) => void;

  // Advanced Student Data Sovereignty & Consent Toggling
  toggleCampaignConsent: (campaignId: string, approved: boolean, reason?: string) => void;
  updateCampaignConsentScope: (
    campaignId: string,
    scopeKey: keyof Pick<
      CampaignConsentPermission,
      'academicDataShared' | 'skillBenchmarksShared' | 'projectReposShared' | 'contactInfoShared'
    >,
    value: boolean
  ) => void;
  updateGlobalPrivacySettings: (settings: Partial<StudentGlobalPrivacySettings>) => void;
  grantAllCampaignConsents: () => void;
  revokeAllCampaignConsents: () => void;

  advanceCandidateStage: (
    opportunityId: string,
    nextStage: RecruitmentStage,
    meta?: { assessmentScore?: number; interviewFeedback?: string; offerLetterUrl?: string }
  ) => void;

  publishInstitutionAvailability: (
    institutionId: string,
    batchYear: number,
    branch: string,
    count: number,
    description: string
  ) => void;

  updateStudentAvailability: (
    studentIdOrAvailability: string,
    maybeAvailability?: StudentCareerPassport['availability']
  ) => void;

  addVerifiedSkillToStudent: (
    studentId: string,
    skill: { name: string; category: any; score: number; badge: any; verifiedBy: string }
  ) => void;

  resetDemoData: () => void;
}

const TalentNetworkContext = createContext<TalentNetworkContextType | undefined>(undefined);

export const TalentNetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('employer');
  const [selectedEmployerId, setSelectedEmployerId] = useState<string>('emp-1');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('inst-1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('stu-1');

  const [employers, setEmployers] = useState<Employer[]>(INITIAL_EMPLOYERS);
  const [institutions, setInstitutions] = useState<Institution[]>(INITIAL_INSTITUTIONS);
  const [students, setStudents] = useState<StudentCareerPassport[]>(INITIAL_STUDENTS);
  const [requirements, setRequirements] = useState<HiringRequirement[]>(INITIAL_REQUIREMENTS);
  const [campaigns, setCampaigns] = useState<RecruitmentCampaign[]>(INITIAL_CAMPAIGNS);
  const [callsForTalent, setCallsForTalent] = useState<CallForTalent[]>(INITIAL_CALLS_FOR_TALENT);
  const [studentOpportunities, setStudentOpportunities] = useState<StudentConsentOpportunity[]>(INITIAL_STUDENT_OPPORTUNITIES);
  const [reputationMatrix, setReputationMatrix] = useState<InstitutionalReputationEntry[]>(INITIAL_REPUTATION_MATRIX);

  const currentEmployer = employers.find((e) => e.id === selectedEmployerId) || employers[0];
  const currentInstitution = institutions.find((i) => i.id === selectedInstitutionId) || institutions[0];
  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  // Level 1 Alignment: Employer <-> Institution Supply Matching
  const getInstitutionMatchesForRequirement = (req: HiringRequirement): InstitutionSupplyMatch[] => {
    return institutions.map((inst) => {
      // Calculate eligible students across 2027/relevant batches
      let eligibleCount = 0;
      let strongMatchCount = 0;
      let availableSeeking = 0;

      inst.batches.forEach((batch) => {
        if (req.graduationYears.includes(batch.batchYear)) {
          batch.branches.forEach((br) => {
            const isBranchRelevant = req.branches.some((reqBranch) =>
              br.branchName.toLowerCase().includes(reqBranch.toLowerCase()) ||
              reqBranch.toLowerCase().includes(br.branchName.toLowerCase())
            );
            if (isBranchRelevant) {
              eligibleCount += br.totalStudents;
              strongMatchCount += br.highMatchCount;
              availableSeeking += br.placementSeeking;
            }
          });
        }
      });

      if (eligibleCount === 0) {
        eligibleCount = Math.round(inst.totalStudentSupply * 0.7);
        strongMatchCount = Math.round(inst.totalStudentSupply * 0.45);
        availableSeeking = Math.round(inst.totalStudentSupply * 0.6);
      }

      // Compute Institutional Fit Score (0-100)
      const repEntry = reputationMatrix.find((r) => r.institutionId === inst.id);
      const histOffer = repEntry ? repEntry.offerRatePercent : inst.historicalOfferRatePercent;
      const histJoin = repEntry ? repEntry.joiningRatePercent : inst.historicalJoiningRatePercent;

      // Factors: Available Volume (30%), Historical Joining/Offer (30%), Response Rate (20%), Overall Rating (20%)
      const volumeFactor = Math.min(100, (availableSeeking / Math.max(req.vacancies, 100)) * 50);
      const historyFactor = (histOffer * 2.5 + histJoin * 0.7) / 2;
      const responseFactor = inst.responseRatePercent;
      const ratingFactor = (inst.overallRating / 5) * 100;

      const fitScore = Math.round(
        volumeFactor * 0.25 + historyFactor * 0.35 + responseFactor * 0.2 + ratingFactor * 0.2
      );

      const reasons = [
        `${availableSeeking} verified placement-seeking candidates in ${req.branches[0] || 'relevant academic departments'}`,
        `${histJoin}% historical offer-to-joining conversion with ${histOffer}% offer benchmark`,
        `High institutional responsiveness rate of ${inst.responseRatePercent}% on talent calls`,
      ];

      return {
        institution: inst,
        fitScore: Math.min(99, Math.max(72, fitScore)),
        eligibleStudentsCount: eligibleCount,
        strongMatchCount,
        availableSeekingCount: availableSeeking,
        reasons,
        historicalPerformance: {
          offerRatePercent: histOffer,
          joiningRatePercent: histJoin,
          previousHires: Math.round(histOffer * 8 + 40),
        },
      };
    }).sort((a, b) => b.fitScore - a.fitScore);
  };

  // Level 2 Alignment: Employer <-> Student Candidate Fit Score
  const getStudentMatchesForRequirement = (req: HiringRequirement): StudentCandidateMatch[] => {
    const matchingCampaign = campaigns.find((c) => c.requirementId === req.id || c.employerId === req.employerId);

    return students.map((stu) => {
      // Check candidate campaign consent
      const campaignConsent = matchingCampaign && stu.campaignConsents
        ? stu.campaignConsents[matchingCampaign.id]
        : undefined;

      const isExplicitlyDenied = campaignConsent?.status === 'denied';
      const isExplicitlyApproved = campaignConsent?.status === 'approved';
      const isPending = !isExplicitlyDenied && !isExplicitlyApproved;

      // 1. Skill Match
      const studentSkillNames = stu.skills.map((s) => s.name.toLowerCase());
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];

      req.requiredSkills.forEach((reqSkill) => {
        const found = studentSkillNames.some((sk) => sk.includes(reqSkill.toLowerCase()) || reqSkill.toLowerCase().includes(sk));
        if (found) {
          matchedSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      });

      const skillCoverageRatio = req.requiredSkills.length > 0 ? matchedSkills.length / req.requiredSkills.length : 1;
      const avgVerifiedScore = stu.skills.length > 0
        ? stu.skills.reduce((acc, s) => acc + s.score, 0) / stu.skills.length
        : 85;

      const skillScore = Math.round(skillCoverageRatio * 60 + (avgVerifiedScore / 100) * 40);

      // 2. Academic Match (CGPA & Graduation Year)
      const gradYearMatch = req.graduationYears.includes(stu.graduationYear) ? 100 : 70;
      const cgpaScore = Math.min(100, (stu.cgpa / 10) * 105);
      const academicScore = Math.round(gradYearMatch * 0.5 + cgpaScore * 0.5);

      // 3. Location & Salary Preference Match
      const locationMatch = req.locations.some((loc) =>
        stu.preferences.preferredLocations.some((pl) => pl.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(pl.toLowerCase()))
      ) ? 100 : 75;
      const salaryMatch = req.salaryMaxLPA >= stu.preferences.minSalaryLPA ? 100 : 70;
      const prefScore = Math.round(locationMatch * 0.6 + salaryMatch * 0.4);

      // Total Candidate Fit Score (Formula: Req x Inst x Capability x Preference x Availability)
      const availabilityMultiplier = stu.availability === 'actively_seeking' ? 1.0 : stu.availability === 'open_to_offers' ? 0.9 : 0.6;
      const candidateFitScore = Math.min(99, Math.round((skillScore * 0.5 + academicScore * 0.25 + prefScore * 0.25) * availabilityMultiplier));

      const alignmentPoints = isExplicitlyDenied
        ? ['[DATA LOCKED] Student exercised data sovereignty to withhold visibility for this specific campaign.']
        : [
            `Verified proficiency in ${matchedSkills.slice(0, 3).join(', ')} (Avg. benchmark ${Math.round(avgVerifiedScore)}%)`,
            `CGPA ${stu.cgpa} from ${stu.institutionName} (${stu.branch})`,
            `Preferred location matches ${req.locations[0] || 'Bengaluru'} with minimum expectations of ₹${stu.preferences.minSalaryLPA} LPA`,
          ];

      return {
        student: isExplicitlyDenied
          ? {
              ...stu,
              email: '[Redacted by Student]',
              projects: [],
              internships: [],
            }
          : stu,
        candidateFitScore,
        matchedSkills,
        missingSkills,
        alignmentPoints,
        aiRecommendation: isExplicitlyDenied
          ? 'Visibility Denied by Student Consent Protocol'
          : candidateFitScore >= 90
          ? 'Exceptional high-intent match ready for fast-tracked evaluation'
          : 'Solid foundational profile with matching core curriculum',
        visibilityDenied: isExplicitlyDenied,
        visibilityStatus: isExplicitlyDenied ? 'denied' : isExplicitlyApproved ? 'approved' : 'pending',
        redactedReason: campaignConsent?.reasonForDenial,
      };
    }).sort((a, b) => b.candidateFitScore - a.candidateFitScore);
  };

  // Actions
  const createRequirementAndCampaign = (
    reqData: Omit<HiringRequirement, 'id' | 'createdAt' | 'employerId' | 'employerName'>
  ) => {
    const newReqId = `req-${Date.now()}`;
    const newCampId = `camp-${Date.now()}`;

    const newRequirement: HiringRequirement = {
      ...reqData,
      id: newReqId,
      employerId: currentEmployer.id,
      employerName: currentEmployer.name,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    const newCampaign: RecruitmentCampaign = {
      id: newCampId,
      requirementId: newReqId,
      requirement: newRequirement,
      title: `${newRequirement.role} - Campaign ${new Date().getFullYear()}`,
      employerId: currentEmployer.id,
      employerName: currentEmployer.name,
      createdAt: new Date().toISOString(),
      status: 'active',
      funnel: {
        requiredVacancies: newRequirement.vacancies,
        institutionsInvited: 0,
        institutionsAccepted: 0,
        studentsInvited: 0,
        applicationsConsented: 0,
        assessmentsCompleted: 0,
        shortlisted: 0,
        interviewed: 0,
        offersMade: 0,
        offersAccepted: 0,
        joined: 0,
      },
      targetedInstitutionIds: [],
      callsSent: [],
      candidateOpportunities: [],
    };

    setRequirements((prev) => [newRequirement, ...prev]);
    setCampaigns((prev) => [newCampaign, ...prev]);

    return { requirement: newRequirement, campaign: newCampaign };
  };

  const sendCallForTalent = (
    campaignId: string,
    institutionIds: string[],
    vacanciesPerInst?: number
  ) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;

    const newCalls: CallForTalent[] = institutionIds.map((instId) => {
      const inst = institutions.find((i) => i.id === instId);
      const allocatedVacancies = vacanciesPerInst || Math.ceil(campaign.requirement.vacancies / institutionIds.length);
      return {
        id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        campaignId,
        employerId: campaign.employerId,
        employerName: campaign.employerName,
        institutionId: instId,
        institutionName: inst ? inst.name : 'Partner Institution',
        role: campaign.requirement.role,
        vacanciesRequested: allocatedVacancies,
        salaryLPA: `₹${campaign.requirement.salaryMinLPA} - ${campaign.requirement.salaryMaxLPA} LPA`,
        locations: campaign.requirement.locations,
        joiningWindow: campaign.requirement.joiningWindow,
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    });

    setCallsForTalent((prev) => [...newCalls, ...prev]);

    // Update campaign funnel & callsSent
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === campaignId) {
          const uniqueInstIds = Array.from(new Set([...c.targetedInstitutionIds, ...institutionIds]));
          return {
            ...c,
            targetedInstitutionIds: uniqueInstIds,
            callsSent: [...c.callsSent, ...newCalls],
            funnel: {
              ...c.funnel,
              institutionsInvited: uniqueInstIds.length,
            },
          };
        }
        return c;
      })
    );
  };

  const respondToCallForTalent = (
    callId: string,
    status: CallStatus,
    responseNotes: string,
    offeredCandidatesCount?: number,
    counterDaysExtension?: number
  ) => {
    setCallsForTalent((prev) =>
      prev.map((call) => {
        if (call.id === callId) {
          return {
            ...call,
            status,
            responseNotes,
            offeredCandidatesCount: offeredCandidatesCount || call.vacanciesRequested * 2,
            counterDaysExtension,
            respondedAt: new Date().toISOString(),
          };
        }
        return call;
      })
    );

    // If accepted or partial or counter, update campaign funnel
    const targetCall = callsForTalent.find((c) => c.id === callId);
    if (targetCall) {
      setCampaigns((prev) =>
        prev.map((camp) => {
          if (camp.id === targetCall.campaignId) {
            const acceptedCount = status !== 'declined' ? camp.funnel.institutionsAccepted + 1 : camp.funnel.institutionsAccepted;
            return {
              ...camp,
              funnel: {
                ...camp.funnel,
                institutionsAccepted: acceptedCount,
              },
            };
          }
          return camp;
        })
      );
    }
  };

  const activateInstitutionStudents = (callId: string, studentIds: string[]) => {
    const call = callsForTalent.find((c) => c.id === callId);
    if (!call) return;
    const campaign = campaigns.find((c) => c.id === call.campaignId);

    const newOpportunities: StudentConsentOpportunity[] = studentIds.map((stuId) => {
      const student = students.find((s) => s.id === stuId);
      return {
        id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        callId,
        campaignId: call.campaignId,
        employerId: call.employerId,
        employerName: call.employerName,
        role: call.role,
        salaryLPA: campaign ? campaign.requirement.salaryMinLPA : 8.5,
        locations: call.locations,
        joiningWindow: call.joiningWindow,
        studentId: stuId,
        studentName: student ? student.name : 'Student',
        institutionId: call.institutionId,
        institutionName: call.institutionName,
        matchScore: Math.floor(Math.random() * 8 + 90),
        matchBreakdown: {
          skillMatchScore: 94,
          academicMatchScore: 92,
          preferenceMatchScore: 95,
          aiRationale: `${call.institutionName} verified your programming benchmark and invited you for this high-match campus opportunity.`,
        },
        stage: 'invited',
        invitedAt: new Date().toISOString(),
        stageUpdatedAt: new Date().toISOString(),
      };
    });

    setStudentOpportunities((prev) => [...newOpportunities, ...prev]);

    // Update campaign metrics
    if (campaign) {
      setCampaigns((prev) =>
        prev.map((c) => {
          if (c.id === campaign.id) {
            return {
              ...c,
              candidateOpportunities: [...c.candidateOpportunities, ...newOpportunities],
              funnel: {
                ...c.funnel,
                studentsInvited: c.funnel.studentsInvited + studentIds.length,
              },
            };
          }
          return c;
        })
      );
    }
  };

  const submitStudentConsent = (opportunityId: string, consented: boolean) => {
    setStudentOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.id === opportunityId) {
          const nextStage: RecruitmentStage = consented ? 'assessment_pending' : 'declined';
          return {
            ...opp,
            stage: nextStage,
            consentedAt: consented ? new Date().toISOString() : undefined,
            stageUpdatedAt: new Date().toISOString(),
          };
        }
        return opp;
      })
    );

    // Update campaign metrics
    if (consented) {
      const opp = studentOpportunities.find((o) => o.id === opportunityId);
      if (opp) {
        setCampaigns((prev) =>
          prev.map((camp) => {
            if (camp.id === opp.campaignId) {
              return {
                ...camp,
                funnel: {
                  ...camp.funnel,
                  applicationsConsented: camp.funnel.applicationsConsented + 1,
                },
              };
            }
            return camp;
          })
        );
      }
    }
  };

  const studentConsentToOpportunity = (opportunityId: string) => {
    submitStudentConsent(opportunityId, true);
  };

  const declineOpportunity = (opportunityId: string) => {
    submitStudentConsent(opportunityId, false);
  };

  const toggleCampaignConsent = (campaignId: string, approved: boolean, reason?: string) => {
    const targetCampaign = campaigns.find((c) => c.id === campaignId);
    const employerName = targetCampaign ? targetCampaign.employerName : 'Employer Campaign';
    const role = targetCampaign ? targetCampaign.requirement.role : 'Hiring Opportunity';
    const salaryLPA = targetCampaign ? `₹${targetCampaign.requirement.salaryMinLPA} - ${targetCampaign.requirement.salaryMaxLPA} LPA` : undefined;

    setStudents((prev) =>
      prev.map((stu) => {
        if (stu.id === selectedStudentId) {
          const existingConsents = stu.campaignConsents || {};
          const updatedPermission: CampaignConsentPermission = {
            campaignId,
            employerId: targetCampaign?.employerId || 'emp-1',
            employerName,
            role,
            salaryLPA,
            status: approved ? 'approved' : 'denied',
            academicDataShared: approved,
            skillBenchmarksShared: approved,
            projectReposShared: approved,
            contactInfoShared: approved,
            updatedAt: new Date().toISOString(),
            reasonForDenial: approved ? undefined : (reason || 'Student elected to withhold data visibility from this employer campaign.'),
          };

          const newAuditRecord: ConsentAuditRecord = {
            id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            action: approved ? 'APPROVED' : 'DENIED',
            targetCampaign: campaignId,
            employerName,
            details: approved
              ? `Student explicitly approved full career passport visibility for "${role}".`
              : `Student explicitly denied data visibility for "${role}". ${reason ? `Reason: "${reason}"` : ''}`,
            actor: `${stu.name} (Self)`,
          };

          return {
            ...stu,
            campaignConsents: {
              ...existingConsents,
              [campaignId]: updatedPermission,
            },
            consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])],
          };
        }
        return stu;
      })
    );

    // Synchronize studentOpportunities state if an opportunity already exists for this student and campaign
    setStudentOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.studentId === selectedStudentId && opp.campaignId === campaignId) {
          if (!approved) {
            return {
              ...opp,
              stage: 'declined' as RecruitmentStage,
              stageUpdatedAt: new Date().toISOString(),
            };
          } else if (opp.stage === 'invited' || opp.stage === 'declined') {
            return {
              ...opp,
              stage: 'assessment_pending' as RecruitmentStage,
              consentedAt: new Date().toISOString(),
              stageUpdatedAt: new Date().toISOString(),
            };
          }
        }
        return opp;
      })
    );
  };

  const updateCampaignConsentScope = (
    campaignId: string,
    scopeKey: keyof Pick<
      CampaignConsentPermission,
      'academicDataShared' | 'skillBenchmarksShared' | 'projectReposShared' | 'contactInfoShared'
    >,
    value: boolean
  ) => {
    setStudents((prev) =>
      prev.map((stu) => {
        if (stu.id === selectedStudentId) {
          const existingConsents = stu.campaignConsents || {};
          const currentConsent = existingConsents[campaignId];
          if (!currentConsent) return stu;

          const updatedConsent: CampaignConsentPermission = {
            ...currentConsent,
            [scopeKey]: value,
            updatedAt: new Date().toISOString(),
          };

          const scopeLabels: Record<string, string> = {
            academicDataShared: 'Academic Records & CGPA',
            skillBenchmarksShared: 'Verified Skill Benchmarks',
            projectReposShared: 'GitHub & Project Artifacts',
            contactInfoShared: 'Direct Contact Coordinates',
          };

          const newAuditRecord: ConsentAuditRecord = {
            id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            action: 'MODIFIED_SCOPES',
            targetCampaign: campaignId,
            employerName: currentConsent.employerName,
            details: `${value ? 'Granted' : 'Revoked'} scope permission: ${scopeLabels[scopeKey] || scopeKey}.`,
            actor: `${stu.name} (Self)`,
          };

          return {
            ...stu,
            campaignConsents: {
              ...existingConsents,
              [campaignId]: updatedConsent,
            },
            consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])],
          };
        }
        return stu;
      })
    );
  };

  const updateGlobalPrivacySettings = (settings: Partial<StudentGlobalPrivacySettings>) => {
    setStudents((prev) =>
      prev.map((stu) => {
        if (stu.id === selectedStudentId) {
          const currentSettings = stu.globalDataPrivacy || {
            allowUnsolicitedPings: false,
            anonymizeProfileUntilConsent: false,
            shareVerifiedBadgesGlobally: true,
            autoDeclineBelowMinSalary: false,
          };
          return {
            ...stu,
            globalDataPrivacy: {
              ...currentSettings,
              ...settings,
            },
          };
        }
        return stu;
      })
    );
  };

  const grantAllCampaignConsents = () => {
    setStudents((prev) =>
      prev.map((stu) => {
        if (stu.id === selectedStudentId) {
          const updatedConsents = { ...(stu.campaignConsents || {}) };
          campaigns.forEach((camp) => {
            updatedConsents[camp.id] = {
              campaignId: camp.id,
              employerId: camp.employerId,
              employerName: camp.employerName,
              role: camp.requirement.role,
              salaryLPA: `₹${camp.requirement.salaryMinLPA} - ${camp.requirement.salaryMaxLPA} LPA`,
              status: 'approved',
              academicDataShared: true,
              skillBenchmarksShared: true,
              projectReposShared: true,
              contactInfoShared: true,
              updatedAt: new Date().toISOString(),
            };
          });

          const newAuditRecord: ConsentAuditRecord = {
            id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            action: 'GRANTED_ALL',
            targetCampaign: 'ALL_ACTIVE_CAMPAIGNS',
            employerName: 'All Network Employers',
            details: 'Student granted visibility across all active employer recruitment campaigns.',
            actor: `${stu.name} (Self)`,
          };

          return {
            ...stu,
            campaignConsents: updatedConsents,
            consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])],
          };
        }
        return stu;
      })
    );
  };

  const revokeAllCampaignConsents = () => {
    setStudents((prev) =>
      prev.map((stu) => {
        if (stu.id === selectedStudentId) {
          const updatedConsents = { ...(stu.campaignConsents || {}) };
          campaigns.forEach((camp) => {
            updatedConsents[camp.id] = {
              campaignId: camp.id,
              employerId: camp.employerId,
              employerName: camp.employerName,
              role: camp.requirement.role,
              salaryLPA: `₹${camp.requirement.salaryMinLPA} - ${camp.requirement.salaryMaxLPA} LPA`,
              status: 'denied',
              academicDataShared: false,
              skillBenchmarksShared: false,
              projectReposShared: false,
              contactInfoShared: false,
              updatedAt: new Date().toISOString(),
              reasonForDenial: 'Student engaged Global Privacy Lock (Revoked all campaign visibility).',
            };
          });

          const newAuditRecord: ConsentAuditRecord = {
            id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            action: 'REVOKED_ALL',
            targetCampaign: 'ALL_ACTIVE_CAMPAIGNS',
            employerName: 'All Network Employers',
            details: 'Student engaged Global Privacy Lock: Revoked visibility for all employer campaigns.',
            actor: `${stu.name} (Self)`,
          };

          return {
            ...stu,
            campaignConsents: updatedConsents,
            consentAuditTrail: [newAuditRecord, ...(stu.consentAuditTrail || [])],
          };
        }
        return stu;
      })
    );
  };

  const advanceCandidateStage = (
    opportunityId: string,
    nextStage: RecruitmentStage,
    meta?: { assessmentScore?: number; interviewFeedback?: string; offerLetterUrl?: string }
  ) => {
    setStudentOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.id === opportunityId) {
          return {
            ...opp,
            stage: nextStage,
            assessmentScore: meta?.assessmentScore ?? opp.assessmentScore,
            interviewFeedback: meta?.interviewFeedback ?? opp.interviewFeedback,
            offerLetterUrl: meta?.offerLetterUrl ?? opp.offerLetterUrl,
            stageUpdatedAt: new Date().toISOString(),
          };
        }
        return opp;
      })
    );

    // Sync student's personal placement status if offered/joined
    const opp = studentOpportunities.find((o) => o.id === opportunityId);
    if (opp) {
      if (nextStage === 'joined' || nextStage === 'accepted') {
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id === opp.studentId) {
              return {
                ...s,
                placementStatus: 'placed',
                placedCompany: opp.employerName,
                placedSalaryLPA: opp.salaryLPA,
                availability: 'not_currently_available',
              };
            }
            return s;
          })
        );
      }

      // Update campaign funnel numbers
      setCampaigns((prev) =>
        prev.map((camp) => {
          if (camp.id === opp.campaignId) {
            const funnel = { ...camp.funnel };
            if (nextStage === 'assessment_completed') funnel.assessmentsCompleted += 1;
            if (nextStage === 'shortlisted') funnel.shortlisted += 1;
            if (nextStage === 'interviewing') funnel.interviewed += 1;
            if (nextStage === 'offered') funnel.offersMade += 1;
            if (nextStage === 'accepted') funnel.offersAccepted += 1;
            if (nextStage === 'joined') funnel.joined += 1;
            return { ...camp, funnel };
          }
          return camp;
        })
      );
    }
  };

  const publishInstitutionAvailability = (
    institutionId: string,
    batchYear: number,
    branch: string,
    count: number,
    description: string
  ) => {
    setInstitutions((prev) =>
      prev.map((inst) => {
        if (inst.id === institutionId) {
          const published = inst.publishedAvailability || [];
          return {
            ...inst,
            publishedAvailability: [
              {
                batchYear,
                branch,
                talentCount: count,
                description,
                publishedAt: new Date().toISOString().split('T')[0],
              },
              ...published,
            ],
          };
        }
        return inst;
      })
    );
  };

  const updateStudentAvailability = (
    studentIdOrAvailability: string,
    maybeAvailability?: StudentCareerPassport['availability']
  ) => {
    const studentId = maybeAvailability ? studentIdOrAvailability : selectedStudentId;
    const availability = maybeAvailability ?? (studentIdOrAvailability as StudentCareerPassport['availability']);
    
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, availability } : s))
    );
  };

  const addVerifiedSkillToStudent = (
    studentId: string,
    skill: { name: string; category: any; score: number; badge: any; verifiedBy: string }
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          const existingSkills = s.skills.filter((sk) => sk.name.toLowerCase() !== skill.name.toLowerCase());
          return {
            ...s,
            skills: [
              {
                ...skill,
                percentile: Math.min(99, Math.round(skill.score * 1.05)),
                verifiedAt: new Date().toISOString().split('T')[0],
              },
              ...existingSkills,
            ],
          };
        }
        return s;
      })
    );
  };

  const resetDemoData = () => {
    setEmployers(INITIAL_EMPLOYERS);
    setInstitutions(INITIAL_INSTITUTIONS);
    setStudents(INITIAL_STUDENTS);
    setRequirements(INITIAL_REQUIREMENTS);
    setCampaigns(INITIAL_CAMPAIGNS);
    setCallsForTalent(INITIAL_CALLS_FOR_TALENT);
    setStudentOpportunities(INITIAL_STUDENT_OPPORTUNITIES);
    setReputationMatrix(INITIAL_REPUTATION_MATRIX);
  };

  return (
    <TalentNetworkContext.Provider
      value={{
        activeRole,
        setActiveRole,
        selectedEmployerId,
        setSelectedEmployerId,
        selectedInstitutionId,
        setSelectedInstitutionId,
        selectedStudentId,
        setSelectedStudentId,
        currentEmployer,
        currentInstitution,
        currentStudent,
        employers,
        institutions,
        students,
        requirements,
        campaigns,
        callsForTalent,
        studentOpportunities,
        reputationMatrix,
        getInstitutionMatchesForRequirement,
        getStudentMatchesForRequirement,
        createRequirementAndCampaign,
        sendCallForTalent,
        respondToCallForTalent,
        activateInstitutionStudents,
        submitStudentConsent,
        studentConsentToOpportunity,
        declineOpportunity,
        toggleCampaignConsent,
        updateCampaignConsentScope,
        updateGlobalPrivacySettings,
        grantAllCampaignConsents,
        revokeAllCampaignConsents,
        advanceCandidateStage,
        publishInstitutionAvailability,
        updateStudentAvailability,
        addVerifiedSkillToStudent,
        resetDemoData,
      }}
    >
      {children}
    </TalentNetworkContext.Provider>
  );
};

export const useTalentNetwork = () => {
  const context = useContext(TalentNetworkContext);
  if (!context) {
    throw new Error('useTalentNetwork must be used within a TalentNetworkProvider');
  }
  return context;
};
