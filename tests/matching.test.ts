import { parseMatchInsightsJson } from "../src/lib/matchInsights";
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
  campaignConsents: {
    'camp-1': {
      campaignId: 'camp-1',
      employerId: 'emp-1',
      employerName: 'Verified Employer',
      role: 'Software Engineer',
      status: 'approved',
      academicDataShared: true,
      skillBenchmarksShared: true,
      projectReposShared: true,
      contactInfoShared: true,
      updatedAt: new Date(0).toISOString(),
    },
  },
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

test('unverified skills do not contribute to an approved candidate match', () => {
  const req = requirement;
  const candidate = student({
    skills: [{ name: 'TypeScript', category: 'technical', score: 100, percentile: 99, badge: 'Unverified', verifiedAt: '', verifiedBy: '' }],
    campaignConsents: { 'camp-1': {
      campaignId: 'camp-1', employerId: 'emp-1', employerName: 'Employer', role: 'Engineer',
      status: 'approved', academicDataShared: true, skillBenchmarksShared: true,
      projectReposShared: true, contactInfoShared: true, updatedAt: new Date().toISOString()
    }}
  });
  const match = getStudentMatchesForRequirement(req, [candidate], [campaign]);
  assert.deepEqual(match[0].matchedSkills, []);
  assert.equal(match[0].candidateFitScore, 0);
});
 
test('pending campaign consent does not expose candidate contact or projects', () => {
  const pending = student({
    campaignConsents: {
      'camp-1': {
        campaignId: 'camp-1', employerId: 'emp-1', employerName: 'Verified Employer', role: 'Software Engineer',
        status: 'pending', academicDataShared: false, skillBenchmarksShared: false, projectReposShared: false,
        contactInfoShared: false, updatedAt: new Date(0).toISOString(),
      },
    },
    projects: [{ id: 'p1', title: 'Private', description: 'Private', technologies: ['React'] }],
  });
  const [match] = getStudentMatchesForRequirement(requirement, [pending], [campaign]);
  assert.equal(match.visibilityStatus, 'pending');
  assert.equal(match.visibilityDenied, true);
  assert.equal(match.student.email, '[Redacted by Student]');
  assert.deepEqual(match.student.projects, []);
  assert.deepEqual(match.matchedSkills, []);
  assert.deepEqual(match.missingSkills, []);
  assert.equal(match.candidateFitScore, 0);
  assert.match(match.aiRecommendation, /Pending Student Consent/);
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
  assert.deepEqual(match.matchedSkills, []);
  assert.deepEqual(match.missingSkills, []);
  assert.equal(match.candidateFitScore, 0);
});


test("match insights parser accepts valid bounded decision-support output", () => {
  const result = parseMatchInsightsJson(JSON.stringify({ score: 78, topMatchingStrengths: ["Required skill evidence"], areasForRampUp: ["Role-specific training"], recommendation: "Human review is required before any decision." }));
  assert.ok(result);
  assert.equal(result.score, 78);
});

test("match insights parser rejects malformed, out-of-range, and incomplete provider output", () => {
  assert.equal(parseMatchInsightsJson("{not-json"), null);
  assert.equal(parseMatchInsightsJson(JSON.stringify({ score: 101, topMatchingStrengths: [], areasForRampUp: [], recommendation: "Review" })), null);
  assert.equal(parseMatchInsightsJson(JSON.stringify({ score: 55 })), null);
});
