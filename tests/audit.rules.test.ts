import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

test('client cannot create immutable audit events', async () => {
  const projectId = 'nexustalent-audit-test';
  const app = initializeApp({ projectId, apiKey: 'demo-key', authDomain: `${projectId}.firebaseapp.com` }, `audit-${crypto.randomUUID()}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const email = `audit-${crypto.randomUUID()}@example.test`;
  await createUserWithEmailAndPassword(auth, email, 'TestPassword-123!');
  await assert.rejects(
    () => setDoc(doc(db, 'auditEvents', crypto.randomUUID()), { action: 'CLIENT_FORGED_EVENT', immutable: true }),
    /permission|PERMISSION_DENIED/i,
  );
  await deleteApp(app);
});
