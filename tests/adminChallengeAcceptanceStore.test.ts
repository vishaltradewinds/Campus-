import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createAdminChallengeAcceptanceStore} from '../server/adminChallengeAcceptanceStore';
import {createWebAuthnAssertionAcceptance} from '../server/webauthnAssertionAcceptance';
const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'};
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const credential=(n:number)=>({uid:'admin-'+n,credentialId:Buffer.alloc(32,n).toString('base64url'),publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()});
const credentials=[credential(1),credential(2)];
test('challenge store is isolated, bounded and rejects non-fixture credentials',()=>{
 assert.throws(()=>createAdminChallengeAcceptanceStore({credentials},{NODE_ENV:'production'}),/test-only/);
 const store=createAdminChallengeAcceptanceStore({credentials,maxPending:1},env);
 assert.equal(store.issue('unknown'),null);
 assert.ok(store.issue(credentials[0].credentialId));
 assert.equal(store.issue(credentials[1].credentialId),null);
});
test('supersession, credential binding and concurrent consumption are fail closed',async()=>{
 const store=createAdminChallengeAcceptanceStore({credentials},env);
 const a=store.issue(credentials[0].credentialId)!;const b=store.issue(credentials[0].credentialId)!;
 assert.notEqual(a.challenge,b.challenge);
 assert.equal(await store.consumeChallenge(a.challenge,a.credentialId),null);
 assert.equal(await store.consumeChallenge(b.challenge,credentials[1].credentialId),null);
 const results=await Promise.all(Array.from({length:10},()=>store.consumeChallenge(b.challenge,b.credentialId)));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(results.find(Boolean)?.uid,credentials[0].uid);
});
test('expiry and revocation invalidate unused challenges',async()=>{
 let now=1000;const store=createAdminChallengeAcceptanceStore({credentials,now:()=>now},env);
 const a=store.issue(credentials[0].credentialId)!;now=a.expiresAt;
 assert.equal(await store.consumeChallenge(a.challenge,a.credentialId),null);
 const b=store.issue(credentials[1].credentialId)!;store.revokeCredential(b.credentialId);
 assert.equal(await store.consumeChallenge(b.challenge,b.credentialId),null);
 assert.equal(store.issue(b.credentialId),null);
});
test('issued challenge verifies a real signature through the assertion verifier exactly once',async()=>{
 const now=1000,origin='https://localhost:4443';
 const store=createAdminChallengeAcceptanceStore({credentials,now:()=>now},env);
 const c=store.issue(credentials[0].credentialId)!;
 const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest();
 const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:c.challenge,origin,crossOrigin:false}));
 const auth=Buffer.alloc(37);sha('localhost').copy(auth);auth[32]=5;
 const assertion={credentialId:c.credentialId,clientDataJSON:client.toString('base64url'),authenticatorData:auth.toString('base64url'),signature:sign('sha256',Buffer.concat([auth,sha(client)]),privateKey).toString('base64url')};
 const verify=createWebAuthnAssertionAcceptance({origin,rpId:'localhost',now:()=>now,consumeChallenge:store.consumeChallenge},env);
 assert.deepEqual(await verify(assertion),{status:'verified',uid:credentials[0].uid,authenticatedAt:now});
 assert.deepEqual(await verify(assertion),{status:'denied'});
});
