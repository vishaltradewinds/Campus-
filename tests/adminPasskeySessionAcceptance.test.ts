import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createAdminPasskeySessionAcceptance} from '../server/adminPasskeySessionAcceptance';
const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'},origin='https://localhost:4443';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const uid='ci-admin',credentialId=Buffer.alloc(32,7).toString('base64url');
const credentials=[{uid,credentialId,publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()}];
const account={uid,email:'admin@example.invalid',role:'super_admin' as const,enabled:true as const,adminAuthorized:true as const};
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest();
function signed(challenge:string){
 const client=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin,crossOrigin:false}));
 const auth=Buffer.alloc(37);sha('localhost').copy(auth);auth[32]=5;
 return {credentialId,clientDataJSON:client.toString('base64url'),authenticatorData:auth.toString('base64url'),signature:sign('sha256',Buffer.concat([auth,sha(client)]),privateKey).toString('base64url')};
}
test('real signature yields an isolated opaque admin session and rejects assertion replay',async()=>{
 const s=createAdminPasskeySessionAcceptance({credentials,origin,lookupAdminAccount:async()=>({status:'verified',account})},env);
 const c=s.issueChallenge(credentialId)!;const assertion=signed(c.challenge);
 const login=await s.authenticate(assertion);assert.equal(login.status,'verified');
 if(login.status!=='verified'||!('token' in login))throw Error('No verified session');
 assert.match(login.token,/^[A-Za-z0-9_-]{43}$/);
 assert.equal((await s.authenticate(assertion)).status,'denied');
 assert.deepEqual(await s.verify(login.token),{status:'verified',identity:{uid,email:account.email,adminClaim:true}});
 assert.equal((await s.verify('ordinary-session')).status,'denied');
 s.revokeSession(login.token);assert.equal((await s.verify(login.token)).status,'denied');
});
test('session expiry, explicit principal revocation and account denial are irreversible',async()=>{
 let now=1000,enabled=true;
 const s=createAdminPasskeySessionAcceptance({credentials,origin,now:()=>now,lookupAdminAccount:async()=>enabled?{status:'verified',account}:{status:'denied'}},env);
 const login=async()=>{const result=await s.authenticate(signed(s.issueChallenge(credentialId)!.challenge));if(result.status!=='verified'||!('token' in result))throw Error('Session missing');return result;};
 const a=await login();enabled=false;assert.equal((await s.verify(a.token)).status,'denied');enabled=true;assert.equal((await s.verify(a.token)).status,'denied');
 const b=await login();s.revokePrincipal(uid);assert.equal((await s.verify(b.token)).status,'denied');
 const c=await login();now=c.expiresAt;assert.equal((await s.verify(c.token)).status,'denied');
 const d=await login();s.revokeCredential(credentialId);assert.equal((await s.verify(d.token)).status,'denied');assert.equal(s.issueChallenge(credentialId),null);
});
test('revocation during account lookup prevents session issuance',async()=>{
 let revoke=()=>{};
 const s=createAdminPasskeySessionAcceptance({credentials,origin,lookupAdminAccount:async()=>{revoke();return {status:'verified',account};}},env);
 revoke=()=>s.revokePrincipal(uid);
 assert.equal((await s.authenticate(signed(s.issueChallenge(credentialId)!.challenge))).status,'denied');
});

test('principal invalidation also consumes every outstanding challenge before reinstatement',async()=>{
 const s=createAdminPasskeySessionAcceptance({credentials,origin,lookupAdminAccount:async()=>({status:'verified',account})},env);
 const stale=s.issueChallenge(credentialId)!;s.revokePrincipal(uid);
 assert.equal((await s.authenticate(signed(stale.challenge))).status,'denied');
 const fresh=s.issueChallenge(credentialId)!;assert.equal((await s.authenticate(signed(fresh.challenge))).status,'verified');
});
test('account denial invalidates pending challenges as well as every existing admin session',async()=>{
 let enabled=true;
 const s=createAdminPasskeySessionAcceptance({credentials,origin,lookupAdminAccount:async()=>enabled?{status:'verified',account}:{status:'denied'}},env);
 const login=await s.authenticate(signed(s.issueChallenge(credentialId)!.challenge));
 if(login.status!=='verified'||!('token' in login))throw Error('Session missing');
 const stale=s.issueChallenge(credentialId)!;enabled=false;
 assert.equal((await s.verify(login.token)).status,'denied');enabled=true;
 assert.equal((await s.authenticate(signed(stale.challenge))).status,'denied');
});
