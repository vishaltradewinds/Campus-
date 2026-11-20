import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment, type RulesTestContext } from '@firebase/rules-unit-testing';
import { doc, getDocs, getDoc, collection, query, setDoc, updateDoc, where } from 'firebase/firestore';

const projectId = 'nexustalent-rules-test';
let testEnv: RulesTestEnvironment;

async function seed(data: Record<string, Record<string, unknown>>) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [path, value] of Object.entries(data)) {
      const [collectionName, documentId] = path.split('/');
      await setDoc(doc(db, collectionName, documentId), value);
    }
  });
}

function roleContext(uid: string, role: 'student' | 'institution' | 'employer' | 'super_admin'): RulesTestContext {
  return testEnv.authenticatedContext(uid, { role });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

test('employer global discovery query is restricted to verified employers', async () => {
  const employer = roleContext('employer-1', 'employer');
  await seed({
    'employers/employer-1': { id: 'employer-1', name: 'Owner Employer', verificationStatus: 'pending' },
    'employers/verified-employer': { id: 'verified-employer', name: 'Verified Employer', verificationStatus: 'verified' },
  });

  const db = employer.firestore();
  const verified = await assertSucceeds(getDocs(query(collection(db, 'employers'), where('verificationStatus', '==', 'verified'))));
  assert.equal(verified.size, 1);
  assert.equal(verified.docs[0].id, 'verified-employer');
  await assertFails(getDocs(query(collection(db, 'employers'))));
});

test('student cannot alter platform verification fields', async () => {
  const student = roleContext('student-1', 'student');
  await seed({
    'students/student-1': {
      id: 'student-1', name: 'Student', institutionId: 'inst-1',
      platformVerificationStatus: 'pending', institutionVerificationStatus: 'pending', availability: 'actively_seeking',
    },
  });

  const db = student.firestore();
  await assertSucceeds(updateDoc(doc(db, 'students', 'student-1'), { availability: 'not_currently_available' }));
  await assertFails(updateDoc(doc(db, 'students', 'student-1'), { platformVerificationStatus: 'verified' }));
});

test('candidate projections are not client-writable', async () => {
  const student = roleContext('student-2', 'student');
  const db = student.firestore();
  await assertFails(setDoc(doc(db, 'candidateProfiles', 'profile-student-2'), {
    studentId: 'student-2', employerId: 'employer-1', email: 'should-not-write@example.test',
  }));
});

test('institution query can read only its own students and targeted campaigns', async () => {
  const institution = roleContext('institution-1', 'institution');
  await seed({
    'institutions/institution-1': { id: 'institution-1', name: 'Institution', empanelmentStatus: 'empanelled' },
    'students/student-owned': { id: 'student-owned', name: 'Owned Student', institutionId: 'institution-1' },
    'students/student-other': { id: 'student-other', name: 'Other Student', institutionId: 'other-institution' },
    'campaigns/campaign-targeted': { id: 'campaign-targeted', employerId: 'employer-1', targetedInstitutionIds: ['institution-1'] },
    'campaigns/campaign-other': { id: 'campaign-other', employerId: 'employer-2', targetedInstitutionIds: ['other-institution'] },
  });

  const db = institution.firestore();
  const students = await assertSucceeds(getDocs(query(collection(db, 'students'), where('institutionId', '==', 'institution-1'))));
  assert.deepEqual(students.docs.map(d => d.id), ['student-owned']);

  const campaigns = await assertSucceeds(getDocs(query(collection(db, 'campaigns'), where('targetedInstitutionIds', 'array-contains', 'institution-1'))));
  assert.deepEqual(campaigns.docs.map(d => d.id), ['campaign-targeted']);
});

test('institution cannot read an unrelated campaign by direct lookup', async () => {
  const institution = roleContext('institution-2', 'institution');
  await seed({
    'institutions/institution-2': { id: 'institution-2', name: 'Institution', empanelmentStatus: 'empanelled' },
    'campaigns/unrelated': { id: 'unrelated', employerId: 'employer-1', targetedInstitutionIds: ['other-institution'] },
  });

  await assertFails(getDoc(doc(institution.firestore(), 'campaigns', 'unrelated')));
});

after(async () => {
  await testEnv.cleanup();
});


test('candidate projection requires matching current employer consent, scope and version', async () => {
  const employer = roleContext('emp-consent', 'employer');
  const student = roleContext('stu-consent', 'student');
  const profileRef = doc(employer.firestore(), 'candidateProfiles', 'profile-consent');
  const scope = { academicDataShared: true, skillBenchmarksShared: false, projectReposShared: false, contactInfoShared: true };
  const consent = { opportunityId:'opp-consent',status: 'approved', employerId: 'emp-consent', updatedAt: '2026-11-20T00:00:00.000Z', ...scope };
  const snapshot = { opportunityId:'opp-consent',studentId: 'stu-consent', employerId: 'emp-consent', campaignId: 'camp-consent', projectionVersion: 3, consentUpdatedAt: consent.updatedAt, consentScope: scope, email: 'synthetic@example.test' };
  async function writeConsent(grant: Record<string, unknown>) {
    await seed({ 'students/stu-consent': { id: 'stu-consent', campaignConsents: { 'camp-consent': grant } } });
  }
  await writeConsent({ ...consent, status: 'denied' });
  await seed({ 'candidateProfiles/profile-consent': snapshot,'opportunities/opp-consent':{studentId:'stu-consent',employerId:'emp-consent',campaignId:'camp-consent'} });
  await assertFails(getDoc(profileRef));
  await writeConsent(consent);
  await assertSucceeds(getDoc(profileRef));
  await writeConsent({...consent,opportunityId:'other-invitation'});
  await assertFails(getDoc(profileRef));
  await writeConsent(consent);
  await assertFails(updateDoc(doc(student.firestore(), 'students', 'stu-consent'), { campaignConsents: {} }));
  // Even a same-timestamp scope change must invalidate the old snapshot.
  await writeConsent({ ...consent, contactInfoShared: false });
  await assertFails(getDoc(profileRef));
  const reduced = { ...consent, contactInfoShared: false, updatedAt: '2026-11-20T00:01:00.000Z' };
  await writeConsent(reduced);
  await assertFails(getDoc(profileRef));
  const { email, ...withoutEmail } = snapshot;
  await seed({ 'candidateProfiles/profile-consent': { ...withoutEmail, consentUpdatedAt: reduced.updatedAt, consentScope: { ...scope, contactInfoShared: false } } });
  const current = await assertSucceeds(getDoc(profileRef));
  assert.equal(current.data()?.email, undefined);
  await seed({'students/stu-consent':{id:'stu-consent',academicCorrectedAt:'2026-11-20T00:02:00.000Z',institutionVerificationStatus:'pending',platformVerificationStatus:'pending',campaignConsents:{'camp-consent':reduced}}});
  await assertFails(getDoc(profileRef));
  await seed({'candidateProfiles/profile-consent':{...withoutEmail,program:'Corrected degree',academicCorrectedAt:'2026-11-20T00:02:00.000Z',consentUpdatedAt:reduced.updatedAt,consentScope:{...scope,contactInfoShared:false}}});
  await assertFails(getDoc(profileRef));
  await seed({'students/stu-consent':{id:'stu-consent',academicCorrectedAt:'2026-11-20T00:02:00.000Z',institutionVerificationStatus:'verified',campaignConsents:{'camp-consent':reduced}}});
  await assertSucceeds(getDoc(profileRef));
  await writeConsent(reduced);
  await seed({'candidateProfiles/profile-consent':{...withoutEmail,consentUpdatedAt:reduced.updatedAt,consentScope:{...scope,contactInfoShared:false}}});
  await writeConsent({ ...reduced, status: 'denied' });
  await assertFails(getDoc(profileRef));
  await writeConsent({ ...reduced, employerId: 'different-employer' });
  await assertFails(getDoc(profileRef));
  await writeConsent(reduced);
  await seed({ 'candidateProfiles/profile-consent': { ...snapshot, projectionVersion: 2 } });
  await assertFails(getDoc(profileRef));
});

test('clients cannot directly mutate recruitment workflow collections', async () => {
  const employer = roleContext('employer-1', 'employer');
  const db = employer.firestore();
  await assertFails(setDoc(doc(db, 'requirements', 'req-1'), { id: 'req-1', employerId: 'employer-1' }));
  await assertFails(setDoc(doc(db, 'campaigns', 'camp-1'), { id: 'camp-1', employerId: 'employer-1' }));
  await assertFails(setDoc(doc(db, 'calls', 'call-1'), { id: 'call-1', employerId: 'employer-1', institutionId: 'inst-1' }));
  await assertFails(setDoc(doc(db, 'opportunities', 'opp-1'), { id: 'opp-1', employerId: 'employer-1', studentId: 'student-1' }));
});


test('Career Passport evidence is readable only by its student or super admin and is never client-writable', async () => {
  const student = roleContext('student-evidence', 'student');
  const otherStudent = roleContext('student-other', 'student');
  await seed({
    'careerEvidence/evidence-1': { id: 'evidence-1', studentId: 'student-evidence', status: 'submitted', claimType: 'education' },
  });
  await assertSucceeds(getDoc(doc(student.firestore(), 'careerEvidence', 'evidence-1')));
  await assertFails(getDoc(doc(otherStudent.firestore(), 'careerEvidence', 'evidence-1')));
  await assertFails(setDoc(doc(student.firestore(), 'careerEvidence', 'evidence-2'), { studentId: 'student-evidence', status: 'verified' }));
  await assertFails(updateDoc(doc(student.firestore(), 'careerEvidence', 'evidence-1'), { status: 'verified' }));
});

test('first-time registrations cannot self-verify or forge consent', async () => {
  const employer = roleContext('new-employer', 'employer').firestore();
  const institution = roleContext('new-institution', 'institution').firestore();
  const student = roleContext('new-student', 'student').firestore();
  const ep = doc(employer, 'employers', 'new-employer');
  const ip = doc(institution, 'institutions', 'new-institution');
  const sp = doc(student, 'students', 'new-student');
  const studentProfile = { id: 'new-student', institutionId: 'new-institution', platformVerificationStatus: 'pending', institutionVerificationStatus: 'pending', placementStatus: 'in_process' };
  await assertFails(setDoc(ep, { id: 'new-employer', verificationStatus: 'verified', verified: true }));
  await assertFails(setDoc(ip, { id: 'new-institution', empanelmentStatus: 'empanelled' }));
  await assertFails(setDoc(sp, { ...studentProfile, platformVerificationStatus: 'verified' }));
  await assertFails(setDoc(sp, { ...studentProfile, campaignConsents: { camp: { status: 'approved' } } }));
  await assertFails(setDoc(sp, { ...studentProfile, evidenceIds: ['forged'] }));
  for(const field of ['skills','projects','internships','assessments'])await assertFails(setDoc(sp,{...studentProfile,[field]:[{verifiedAt:'today',badge:'Gold',verifiedScore:100}]}));
  await assertFails(setDoc(sp,{...studentProfile,independentCredentials:{idProofNumber:'synthetic-secret'}}));
  await assertFails(setDoc(sp,{...studentProfile,globalDataPrivacy:{allowUnsolicitedPings:true}}));

  await assertSucceeds(setDoc(ep, { id: 'new-employer', verificationStatus: 'pending', verified: false }));
  await assertSucceeds(setDoc(ip, { id: 'new-institution', empanelmentStatus: 'pending_empanelment' }));
  await assertSucceeds(setDoc(sp, studentProfile));
  for(const [field,value] of Object.entries({skills:[{name:'Forged',badge:'Gold'}],projects:[{verifiedScore:100}],assessments:[{score:100}],internships:[{verified:true}],graduationYear:2027,cgpa:10,program:'Forged programme',branch:'Forged branch',email:'forged@example.test',rollNumber:'forged',globalDataPrivacy:{shareVerifiedBadgesGlobally:true}}))await assertFails(updateDoc(sp,{[field]:value}));
  await assertSucceeds(updateDoc(sp,{availability:'actively_seeking'}));

});

test('assessment response is private and employer access requires current explicit skill scope', async () => {
  const own = roleContext('assessment-student', 'student').firestore();
  const other = roleContext('assessment-other', 'student').firestore();
  const employer = roleContext('assessment-employer', 'employer').firestore();
  const outsider = roleContext('assessment-outsider', 'employer').firestore();
  const grant = { status: 'approved', employerId: 'assessment-employer', skillBenchmarksShared: true };
  const studentPath = 'students/assessment-student';
  const record = { studentId: 'assessment-student', employerId: 'assessment-employer', campaignId: 'assessment-camp', response: 'synthetic answer', shareWithEmployer: true, status: 'pending_review' };
  await seed({ 'assessmentSubmissions/assessment-1': record, [studentPath]: { campaignConsents: { 'assessment-camp': grant } } });
  await assertSucceeds(getDoc(doc(own, 'assessmentSubmissions', 'assessment-1')));
  await assertFails(getDoc(doc(other, 'assessmentSubmissions', 'assessment-1')));
  await assertSucceeds(getDoc(doc(employer, 'assessmentSubmissions', 'assessment-1')));
  await seed({ 'assessmentSubmissions/private-assessment': { ...record, shareWithEmployer: false } });
  await assertFails(getDoc(doc(employer, 'assessmentSubmissions', 'private-assessment')));
  await assertFails(getDoc(doc(outsider, 'assessmentSubmissions', 'assessment-1')));
  await assertFails(setDoc(doc(own, 'assessmentSubmissions', 'forged'), record));
  await assertFails(updateDoc(doc(employer, 'assessmentSubmissions', 'assessment-1'), { status: 'verified' }));
  await seed({ [studentPath]: { campaignConsents: { 'assessment-camp': { ...grant, skillBenchmarksShared: false } } } });
  await assertFails(getDoc(doc(employer, 'assessmentSubmissions', 'assessment-1')));
  await seed({ [studentPath]: { campaignConsents: { 'assessment-camp': { ...grant, status: 'denied' } } } });
  await assertFails(getDoc(doc(employer, 'assessmentSubmissions', 'assessment-1')));
});

test('institution affiliation cannot be reassigned by student and verification must use trusted API', async()=>{
  await seed({'students/student-affiliation':{id:'student-affiliation',institutionId:'inst-affiliation',institutionVerificationStatus:'verified'}});
  const student=roleContext('student-affiliation','student').firestore();
  const institution=roleContext('inst-affiliation','institution').firestore();
  await assertFails(updateDoc(doc(student,'students','student-affiliation'),{institutionId:'other-institution'}));
  await assertFails(updateDoc(doc(student,'students','student-affiliation'),{candidateType:'independent_direct'}));
  await assertFails(updateDoc(doc(institution,'students','student-affiliation'),{institutionVerificationStatus:'rejected',verificationNotes:'bypass'}));
  await assertSucceeds(getDoc(doc(institution,'students','student-affiliation')));
});

test('ordinary Firebase token without custom role claim resolves stored role safely', async()=>{
  await seed({
    'users/no-custom-claim':{uid:'no-custom-claim',role:'employer'},
    'requirements/claimless-owned':{id:'claimless-owned',employerId:'no-custom-claim'},
    'requirements/claimless-other':{id:'claimless-other',employerId:'another-employer'},
  });
  const db=testEnv.authenticatedContext('no-custom-claim').firestore();
  await assertSucceeds(getDoc(doc(db,'requirements','claimless-owned')));
  await assertFails(getDoc(doc(db,'requirements','claimless-other')));
});
