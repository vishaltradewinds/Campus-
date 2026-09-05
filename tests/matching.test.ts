import test from 'node:test';
import assert from 'node:assert/strict';
import { getStudentMatchesForRequirement } from '../src/lib/matching';
import type { HiringRequirement, RecruitmentCampaign, StudentCareerPassport } from '../src/types';

const requirement: HiringRequirement = {
  id: 'req-1',
  employerId: 'emp-1',
  employerName: 'Verified Employer',
  role: 'Software Engineer',
  vacancies: 2,
  education: ['B.Tech'],
  graduationYears: [2027],
  branches: ['Computer Science'],
  requiredSkills: ['TypeScript', 'React'],
  experienceLevel: 'Entry',
  locations: ['Indore'],
  salaryMinLPA: 6,
  salaryMaxLPA: 10,
  joiningWindow: '30 days',
  assessmentRequirements: [],
  selectionProcess: ['Interview'],
  candidateProfileSummary: 'Software engineering role',
  createdAt: new Date(0).toISOString(),
  status: 'active',
};

const student = (overrides: Partial<StudentCareerPassport> = {}): StudentCareerPassport => ({
  id: 'stu-1',
  name: 'Candidate',
  avatar: '',
  email: 'candidate@example.com',
  isEmpanelledCampus: false,
  institutionId: 'inst-1',
  institutionName: 'Institution',
  institutionCode: 'INST',
  institutionVerificationStatus: 'verified',
  platformVerificationStatus: 'verified',
  state: 'Madhya Pradesh',
  program: 'B.Tech',
  branch: 'Computer Science',
  graduationYear: 2027,
  cgpa: 8,
  skills: [
    { name: 'TypeScript', category: 'technical', score: 90, percentile: 90, badge: 'Gold', verifiedAt: new Date(0).toISOString(), verifiedBy: 'assessment' },
    { name: 'React', category: 'technical', score: 85, percentile: 85, badge: 'Gold', verifiedAt: new Date(0).toISOString(), verifiedBy: 'assessment' },
  ],
  projects: [],
  internships: [],
  assessments: [],
  preferences: { targetRoles: ['Software Engineer'], preferredLocations: ['Indore'], minSalaryLPA: 6, employmentTypes: ['Full-Time'] },
  availability: 'actively_seeking',
  placementStatus: 'unplaced',
  ...overrides,
});

const campaign: RecruitmentCampaign = {
  id: 'camp-1',
  requirementId: 'req-1',
  requirement,
  title: 'Software Engineer Hiring',
  employerId: 'emp-1',
  employerName: 'Verified Employer',
  createdAt: new Date(0).toISOString(),
  status: 'active',
  funnel: { requiredVacancies: 2, institutionsInvited: 1, institutionsAccepted: 1, studentsInvited: 1, applicationsConsented: 0, assessmentsCompleted: 0, shortlisted: 0, interviewed: 0, offersMade: 0, offersAccepted: 0, joined: 0 },
  targetedInstitutionIds: ['inst-1'],
  callsSent: [],
  candidateOpportunities: [],
};

test('returns an eligible candidate with a bounded score and stable studentId', () => {
  const [match] = getStudentMatchesForRequirement(requirement, [student()], [campaign]);
  assert.equal(match.studentId, 'stu-1');
  assert.ok(match.candidateFitScore > 0 && match.candidateFitScore <= 99);
  assert.deepEqual(match.matchedSkills, ['TypeScript', 'React']);
});

test('hard eligibility returns zero for an incompatible graduation year', () => {
  const [match] = getStudentMatchesForRequirement(requirement, [student({ graduationYear: 2026 })], [campaign]);
  assert.equal(match.candidateFitScore, 0);
});

test('denied campaign consent does not expose contact or project data through the match', () => {
  const denied = student({
    campaignConsents: {
      'camp-1': {
        campaignId: 'camp-1', employerId: 'emp-1', employerName: 'Verified Employer', role: 'Software Engineer',
        status: 'denied', academicDataShared: false, skillBenchmarksShared: false, projectReposShared: false,
        contactInfoShared: false, updatedAt: new Date(0).toISOString(), reasonForDenial: 'Not interested',
      },
    },
    projects: [{ id: 'p1', title: 'Private', description: 'Private', technologies: ['React'] }],
  });
  const [match] = getStudentMatchesForRequirement(requirement, [denied], [campaign]);
  assert.equal(match.visibilityStatus, 'denied');
  assert.equal(match.visibilityDenied, true);
  assert.equal(match.student.email, '[Redacted by Student]');
  assert.deepEqual(match.student.projects, []);
});
