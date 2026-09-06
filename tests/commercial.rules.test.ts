import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'nexustalent-commercial-rules-test';
let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'commercialAccounts', 'acct-employer-1'), { ownerUid: 'employer-1', type: 'employer' });
    await setDoc(doc(db, 'commercialAccounts', 'acct-employer-2'), { ownerUid: 'employer-2', type: 'employer' });
    await setDoc(doc(db, 'subscriptions', 'sub-1'), { ownerUid: 'employer-1', accountId: 'acct-employer-1', status: 'active' });
    await setDoc(doc(db, 'campaignCharges', 'charge-1'), { employerId: 'employer-1', campaignId: 'campaign-1', status: 'paid' });
    await setDoc(doc(db, 'invoices', 'invoice-1'), { ownerUid: 'employer-1', accountId: 'acct-employer-1', status: 'paid' });
    await setDoc(doc(db, 'billingEvents', 'event-1'), { ownerUid: 'employer-1', accountId: 'acct-employer-1', immutable: true });
  });
});

test('commercial owner can read own records but cannot create billing state', async () => {
  const db = testEnv.authenticatedContext('employer-1', { role: 'employer' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'commercialAccounts', 'acct-employer-1')));
  await assertSucceeds(getDoc(doc(db, 'subscriptions', 'sub-1')));
  await assertSucceeds(getDoc(doc(db, 'campaignCharges', 'charge-1')));
  await assertSucceeds(getDoc(doc(db, 'invoices', 'invoice-1')));
  await assertSucceeds(getDoc(doc(db, 'billingEvents', 'event-1')));
  await assertFails(setDoc(doc(db, 'subscriptions', 'forged'), { ownerUid: 'employer-1', status: 'active' }));
  await assertFails(setDoc(doc(db, 'campaignCharges', 'forged'), { employerId: 'employer-1', status: 'paid' }));
});

test('commercial records are isolated between employers', async () => {
  const db = testEnv.authenticatedContext('employer-2', { role: 'employer' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'commercialAccounts', 'acct-employer-2')));
  await assertFails(getDoc(doc(db, 'commercialAccounts', 'acct-employer-1')));
  await assertFails(getDoc(doc(db, 'subscriptions', 'sub-1')));
  await assertFails(getDoc(doc(db, 'campaignCharges', 'charge-1')));
});

after(async () => {
  await testEnv.cleanup();
});
