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


test('candidate projection reads require current approved consent', async () => {
  const employer = roleContext('employer-1', 'employer');
  await seed({
    'students/student-1': {
      id: 'student-1',
      campaignConsents: { 'campaign-1': { status: 'denied' } },
    },
    'candidateProfiles/profile-1': {
      studentId: 'student-1',
      employerId: 'employer-1',
      campaignId: 'campaign-1',
    },
  });
  await assertFails(getDoc(doc(employer.firestore(), 'candidateProfiles', 'profile-1')));
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'students', 'student-1'), {
      id: 'student-1',
      campaignConsents: { 'campaign-1': { status: 'approved' } },
    });
  });
  await assertSucceeds(getDoc(doc(employer.firestore(), 'candidateProfiles', 'profile-1')));
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
