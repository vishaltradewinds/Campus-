import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFirebaseTarget } from '../scripts/check-firebase-target.mjs';
const config={projectId:'synthetic-project',firestoreDatabaseId:'synthetic-db',apiKey:'synthetic-key'};
const env={FIREBASE_PROJECT_ID:'synthetic-project',FIREBASE_DATABASE_ID:'synthetic-db',FIREBASE_WEB_API_KEY:'synthetic-key'};
test('matching synthetic configuration passes consistency check',()=>assert.deepEqual(checkFirebaseTarget(config,env),[]));
test('different project, database or key fails without echoing values',()=>{
  const failures=checkFirebaseTarget(config,{FIREBASE_PROJECT_ID:'wrong-project',FIREBASE_DATABASE_ID:'wrong-db',FIREBASE_WEB_API_KEY:'wrong-key'});
  assert.equal(failures.length,3);
  assert.ok(failures.every(message=>!message.includes('wrong-')));
});
test('release target rejects emulator flags and expiring static token',()=>{
  const failures=checkFirebaseTarget(config,{...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',GOOGLE_OAUTH_ACCESS_TOKEN:'private-test-token'});
  assert.equal(failures.length,2);
  assert.ok(failures.every(message=>!message.includes('private-test-token')));
});
