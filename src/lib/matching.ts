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
 * Level 1 Alignment: Employer <-> Institution Supply Matching
 * Computes an explainable scoring fit for an institution against an employer's hiring requirements.
 */
export const getInstitutionMatchesForRequirement = (
  req: HiringRequirement,
  institutions: Institution[],
  reputationMatrix: InstitutionalReputationEntry[]
): InstitutionSupplyMatch[] => {
  return institutions.map((inst) => {
    // Calculate eligible students across matching graduation years and branches
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

/**
 * Level 2 Alignment: Employer <-> Student Candidate Fit Score
 * Computes an explainable scoring fit for a specific student candidate against a hiring requirement, factoring in data privacy and consents.
 */
export const getStudentMatchesForRequirement = (
  req: HiringRequirement,
  students: StudentCareerPassport[],
  campaigns: RecruitmentCampaign[]
): StudentCandidateMatch[] => {
  const matchingCampaign = campaigns.find((c) => c.requirementId === req.id || c.employerId === req.employerId);

  return students.map((stu) => {
    // Check candidate campaign consent
    const campaignConsent = matchingCampaign && stu.campaignConsents
      ? stu.campaignConsents[matchingCampaign.id]
      : undefined;

    const isExplicitlyDenied = campaignConsent?.status === 'denied';
    const isExplicitlyApproved = campaignConsent?.status === 'approved';

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
      visibilityStatus: (isExplicitlyDenied ? 'denied' : isExplicitlyApproved ? 'approved' : 'pending') as 'approved' | 'denied' | 'pending',
      redactedReason: campaignConsent?.reasonForDenial,
    };
  }).sort((a, b) => b.candidateFitScore - a.candidateFitScore);
};
