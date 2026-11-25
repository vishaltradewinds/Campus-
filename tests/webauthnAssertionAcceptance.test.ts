import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createWebAuthnAssertionAcceptance} from '../server/webauthnAssertionAcceptance';
const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'},origin='https://localhost:4443',now=1000000;
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const challenge=Buffer.alloc(32,7).toString('base64url'),credentialId=Buffer.alloc(32,8).toString('base64url');
const digest=(x:string|Buffer)=>createHash('sha256').update(x).digest();
const fixture=(patch:Record<string,unknown>={},flags=5,rp='localhost')=>{
 const client=Buffer.from(JSON.stringify({type:'webauthn.get',origin,crossOrigin:false,challenge,...patch}));
 const auth=Buffer.alloc(37);digest(rp).copy(auth);auth[32]=flags;
 return {credentialId,clientDataJSON:client.toString('base64url'),authenticatorData:auth.toString('base64url'),signature:sign('sha256',Buffer.concat([auth,digest(client)]),privateKey).toString('base64url')};
};
const setup=(patch:Record<string,unknown>={})=>{
 let used=false;
 const verifier=createWebAuthnAssertionAcceptance({origin,rpId:'localhost',now:()=>now,consumeChallenge:async(c,id)=>{
  if(used||c!==challenge||id!==credentialId)return null;used=true;
  return {uid:'ci-admin',credentialId,challenge,publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString(),issuedAt:now-1000,expiresAt:now+1000,...patch};
 }},env);
 return verifier;
};
test('real ES256 assertion signature succeeds once with fresh bound challenge',async()=>{
 const verify=setup();const assertion=fixture();
 assert.deepEqual(await verify(assertion),{status:'verified',uid:'ci-admin',authenticatedAt:now});
 assert.deepEqual(await verify(assertion),{status:'denied'});
});
test('origin, challenge, RP hash, UV and assertion type are mandatory',async()=>{
 for(const assertion of [fixture({origin:'https://foreign.invalid'}),fixture({crossOrigin:true}),fixture({type:'webauthn.create'}),fixture({challenge:Buffer.alloc(32,9).toString('base64url')}),fixture({},1),fixture({},0x85),fixture({},0x15),fixture({},5,'foreign.invalid')]){
  assert.equal((await setup()(assertion)).status,'denied');
 }
});
test('invalid signature and expired challenge fail closed',async()=>{
 const a=fixture();a.signature=sign('sha256',Buffer.from('unrelated'),privateKey).toString('base64url');
 assert.equal((await setup()(a)).status,'denied');
 assert.equal((await setup({expiresAt:now})(fixture())).status,'denied');
 assert.equal((await setup({issuedAt:now+1})(fixture())).status,'denied');
});
test('production and arbitrary RP activation prohibited',()=>{
 const deps={origin,rpId:'localhost',consumeChallenge:async()=>null};
 assert.throws(()=>createWebAuthnAssertionAcceptance(deps,{NODE_ENV:'production',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'}),/test-only/);
 assert.throws(()=>createWebAuthnAssertionAcceptance({...deps,rpId:'example.invalid'},env),/Local WebAuthn/);
});
