import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, updateDoc, where } from 'firebase/firestore';

const projectId = 'nexustalent-rules-test';
const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [firestoreHost, firestorePort] = host.split(':');
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [authHostname, authPort] = authHost.split(':');

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;

async function createRoleUser(role: 'student' | 'institution' | 'employer') {
  const email = `${role}-${crypto.randomUUID()}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, 'TestPassword-123!');
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    email,
    role,
    name: `${role} test user`,
  });
  return credential.user;
}

before(async () => {
  app = initializeApp({ projectId, apiKey: 'demo-key', authDomain: `${projectId}.firebaseapp.com` }, `rules-${crypto.randomUUID()}`);
  auth = getAuth(app);
  db = getFirestore(app);
  connectAuthEmulator(auth, `http://${authHostname}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
});

test('employer global discovery query is restricted to verified employers', async () => {
  const employer = await createRoleUser('employer');
  await setDoc(doc(db, 'employers', employer.uid), {
    id: employer.uid,
    name: 'Owner Employer',
    verificationStatus: 'pending',
  });
  await setDoc(doc(db, 'employers', 'verified-employer'), {
    id: 'verified-employer',
    name: 'Verified Employer',
    verificationStatus: 'verified',
  });

  const verified = await getDocs(query(doc(db, 'employers').parent, where('verificationStatus', '==', 'verified')));
  assert.equal(verified.size, 1);
  assert.equal(verified.docs[0].id, 'verified-employer');

  await assert.rejects(
    () => getDocs(query(doc(db, 'employers').parent)),
    /permission|PERMISSION_DENIED/i,
  );
});

test('student cannot alter platform verification fields', async () => {
  const student = await createRoleUser('student');
  await setDoc(doc(db, 'students', student.uid), {
    id: student.uid,
    name: 'Student',
    institutionId: 'inst-1',
    platformVerificationStatus: 'pending',
    institutionVerificationStatus: 'pending',
    availability: 'actively_seeking',
  });

  await updateDoc(doc(db, 'students', student.uid), { availability: 'not_currently_available' });
  await assert.rejects(
    () => updateDoc(doc(db, 'students', student.uid), { platformVerificationStatus: 'verified' }),
    /permission|PERMISSION_DENIED/i,
  );
});

test('candidate projections are not client-writable', async () => {
  const student = await createRoleUser('student');
  await assert.rejects(
    () => setDoc(doc(db, 'candidateProfiles', `profile-${student.uid}`), {
      studentId: student.uid,
      employerId: 'employer-1',
      email: 'should-not-write@example.test',
    }),
    /permission|PERMISSION_DENIED/i,
  );
});

test('institution query can read only its own students and targeted campaigns', async () => {
  const institution = await createRoleUser('institution');
  await setDoc(doc(db, 'institutions', institution.uid), {
    id: institution.uid,
    name: 'Institution',
    empanelmentStatus: 'empanelled',
  });
  await setDoc(doc(db, 'students', 'student-owned'), {
    id: 'student-owned',
    name: 'Owned Student',
    institutionId: institution.uid,
  });
  await setDoc(doc(db, 'students', 'student-other'), {
    id: 'student-other',
    name: 'Other Student',
    institutionId: 'other-institution',
  });
  await setDoc(doc(db, 'campaigns', 'campaign-targeted'), {
    id: 'campaign-targeted',
    employerId: 'employer-1',
    targetedInstitutionIds: [institution.uid],
  });
  await setDoc(doc(db, 'campaigns', 'campaign-other'), {
    id: 'campaign-other',
    employerId: 'employer-2',
    targetedInstitutionIds: ['other-institution'],
  });

  const students = await getDocs(query(doc(db, 'students').parent, where('institutionId', '==', institution.uid)));
  assert.deepEqual(students.docs.map(d => d.id), ['student-owned']);

  const campaigns = await getDocs(query(doc(db, 'campaigns').parent, where('targetedInstitutionIds', 'array-contains', institution.uid)));
  assert.deepEqual(campaigns.docs.map(d => d.id), ['campaign-targeted']);
});

test('institution cannot read an unrelated campaign by unscoped query', async () => {
  const institution = await createRoleUser('institution');
  await setDoc(doc(db, 'institutions', institution.uid), {
    id: institution.uid,
    name: 'Institution',
    empanelmentStatus: 'empanelled',
  });
  await setDoc(doc(db, 'campaigns', 'unrelated'), {
    id: 'unrelated',
    employerId: 'employer-1',
    targetedInstitutionIds: ['other-institution'],
  });

  await assert.rejects(
    () => getDoc(doc(db, 'campaigns', 'unrelated')),
    /permission|PERMISSION_DENIED/i,
  );
});

after(async () => {
  await deleteApp(app);
});
