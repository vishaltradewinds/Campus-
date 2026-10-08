import {
  HiringRequirement,
  Institution,
  StudentCareerPassport,
  RecruitmentCampaign,
  InstitutionalReputationEntry,
  InstitutionSupplyMatch,
  StudentCandidateMatch
} from '../types';

/**
 * Level 1 Alignment: Employer <-> Institution Supply Matching.
 * Counts are derived only from authoritative batch/branch records. Missing data
 * is reported as zero instead of being fabricated from total enrollment.
 */
export const getInstitutionMatchesForRequirement = (
  req: HiringRequirement,
  institutions: Institution[],
  reputationMatrix: InstitutionalReputationEntry[]
): InstitutionSupplyMatch[] => {
  return institutions.map((inst) => {
    let eligibleCount = 0;
    let strongMatchCount = 0;
    let availableSeeking = 0;

    inst.batches.forEach((batch) => {
      if (!req.graduationYears.includes(batch.batchYear)) return;
      batch.branches.forEach((br) => {
        const isBranchRelevant = req.branches.some((reqBranch) => {
          const a = br.branchName.trim().toLowerCase();
          const b = reqBranch.trim().toLowerCase();
          return a === b || a.includes(b) || b.includes(a);
        });
        if (isBranchRelevant) {
          eligibleCount += br.totalStudents;
          strongMatchCount += br.highMatchCount;
          availableSeeking += br.placementSeeking;
        }
      });
    });

    const repEntry = reputationMatrix.find((r) => r.institutionId === inst.id);
    const histOffer = repEntry?.offerRatePercent ?? inst.historicalOfferRatePercent;
    const histJoin = repEntry?.joiningRatePercent ?? inst.historicalJoiningRatePercent;
    const volumeFactor = req.vacancies > 0 ? Math.min(100, (availableSeeking / req.vacancies) * 50) : 0;
    const historyFactor = Math.min(100, Math.max(0, (histOffer * 0.6) + (histJoin * 0.4)));
    const responseFactor = Math.min(100, Math.max(0, inst.responseRatePercent));
    const ratingFactor = Math.min(100, Math.max(0, (inst.overallRating / 5) * 100));

    const fitScore = Math.round(
      volumeFactor * 0.25 + historyFactor * 0.35 + responseFactor * 0.2 + ratingFactor * 0.2
    );

    const reasons = [
      `${availableSeeking} placement-seeking candidates recorded in matching academic data`,
      `${histJoin}% historical joining rate with ${histOffer}% offer rate`,
      `${inst.responseRatePercent}% recorded responsiveness on talent calls`,
    ];

    return {
      institution: inst,
      fitScore: Math.min(99, Math.max(0, fitScore)),
      eligibleStudentsCount: eligibleCount,
      strongMatchCount,
      availableSeekingCount: availableSeeking,
      reasons,
      historicalPerformance: {
        offerRatePercent: histOffer,
        joiningRatePercent: histJoin,
        // Historical hire count is not present in the authoritative institution
        // model, so do not derive or invent it from percentages.
        previousHires: 0,
      },
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
};

/**
 * Level 2 Alignment: Employer <-> Student Candidate Fit Score.
 * This function may run only on data already authorized for the caller. It never
 * treats UI redaction as a security boundary; Firestore rules/API authorization
 * must enforce candidate visibility.
 */
export const getStudentMatchesForRequirement = (
  req: HiringRequirement,
  students: StudentCareerPassport[],
  campaigns: RecruitmentCampaign[]
): StudentCandidateMatch[] => {
  const matchingCampaign = campaigns.find((c) => c.requirementId === req.id && c.employerId === req.employerId);

  return students.map((stu) => {
    const campaignConsent = matchingCampaign && stu.campaignConsents
      ? stu.campaignConsents[matchingCampaign.id]
      : undefined;

    const isExplicitlyDenied = campaignConsent?.status === 'denied';
    const isExplicitlyApproved = campaignConsent?.status === 'approved';
    const isVisibilityRestricted = !isExplicitlyApproved;
    // Candidate-derived fit data is available only after explicit campaign consent.
    // Redaction must not merely hide the profile while still leaking ranking signals.
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    let skillScore = 0;

    const academicEligible = req.graduationYears.includes(stu.graduationYear);
    const gradYearMatch = academicEligible ? 100 : 0;
    const cgpaScore = Math.min(100, Math.max(0, (stu.cgpa / 10) * 100));
    const academicScore = Math.round(gradYearMatch * 0.5 + cgpaScore * 0.5);

    if (!isVisibilityRestricted) {
      // Only trusted, non-unverified skills participate in matching.
      // Current Career Passport evidence remains the authoritative server-side projection.
      const studentSkillNames = stu.skills
        .filter((s) => s.badge !== 'Unverified' && !!s.verifiedAt && !!s.verifiedBy)
        .map((s) => s.name.trim().toLowerCase());
      req.requiredSkills.forEach((reqSkill) => {
        const normalized = reqSkill.trim().toLowerCase();
        const found = studentSkillNames.some((sk) => sk === normalized || sk.includes(normalized) || normalized.includes(sk));
        if (found) matchedSkills.push(reqSkill);
        else missingSkills.push(reqSkill);
      });
      const skillCoverageRatio = req.requiredSkills.length > 0 ? matchedSkills.length / req.requiredSkills.length : 1;
      const verifiedSkills = stu.skills.filter(
        (s) => s.badge !== 'Unverified' && !!s.verifiedAt && !!s.verifiedBy
      );
      const avgVerifiedScore = verifiedSkills.length > 0
        ? verifiedSkills.reduce((acc, s) => acc + s.score, 0) / verifiedSkills.length
        : 0;
      skillScore = Math.round(skillCoverageRatio * 60 + (avgVerifiedScore / 100) * 40);
    }

    const locationMatch = req.locations.length === 0 || req.locations.some((loc) =>
      stu.preferences.preferredLocations.some((pl) => {
        const a = pl.trim().toLowerCase();
        const b = loc.trim().toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      })
    ) ? 100 : 0;
    const salaryMatch = req.salaryMaxLPA >= stu.preferences.minSalaryLPA ? 100 : 0;
    const prefScore = Math.round(locationMatch * 0.6 + salaryMatch * 0.4);

    const availabilityMultiplier = stu.availability === 'actively_seeking' ? 1 : stu.availability === 'open_to_offers' ? 0.9 : 0;
    const hardEligible = academicEligible && salaryMatch === 100 && availabilityMultiplier > 0;
    const hasVerifiedSkillEvidence = req.requiredSkills.length === 0 || stu.skills.some((s) => s.badge !== 'Unverified' && !!s.verifiedAt && !!s.verifiedBy);
    const candidateFitScore = !isVisibilityRestricted && hardEligible && hasVerifiedSkillEvidence
      ? Math.min(99, Math.round((skillScore * 0.5 + academicScore * 0.25 + prefScore * 0.25) * availabilityMultiplier))
      : 0;

    const alignmentPoints = isVisibilityRestricted
      ? ['[DATA LOCKED] Student has not granted visibility for this specific campaign.']
      : [
          `Recorded skill proficiency across ${matchedSkills.slice(0, 3).join(', ') || 'no matched required skills'}`,
          `CGPA ${stu.cgpa} from ${stu.institutionName} (${stu.branch})`,
          `Salary/location preference evaluation completed against the published requirement`,
        ];

    return {
      studentId: stu.id,
      student: isVisibilityRestricted ? {
        ...stu,
        email: '[Redacted by Student]',
        projects: [],
        internships: [],
      } : stu,
      candidateFitScore,
      matchedSkills,
      missingSkills,
      alignmentPoints,
      aiRecommendation: isVisibilityRestricted
        ? 'Visibility Restricted Pending Student Consent'
        : !hardEligible
        ? 'Not eligible for this requirement based on mandatory criteria'
        : candidateFitScore >= 90
        ? 'Strong match; subject to human evaluation'
        : 'Potential match; subject to human evaluation',
      visibilityDenied: isVisibilityRestricted,
      visibilityStatus: (isExplicitlyDenied ? 'denied' : isExplicitlyApproved ? 'approved' : 'pending') as 'approved' | 'denied' | 'pending',
      redactedReason: campaignConsent?.reasonForDenial,
    };
  }).sort((a, b) => b.candidateFitScore - a.candidateFitScore);
};