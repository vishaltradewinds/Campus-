import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminAcceptanceVerifier,type AdminProof,type AdminAccount} from '../server/adminAcceptanceVerifier';
const now=1000000,env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'};
const proof:AdminProof={uid:'admin-ci',audience:'nexustalent-admin',method:'webauthn',userVerified:true,authenticatedAt:now-1000,expiresAt:now+1000};
const account:AdminAccount={uid:'admin-ci',email:'admin@example.invalid',role:'super_admin',enabled:true,adminAuthorized:true};
const build=(p:unknown=proof,a:unknown=account)=>createAdminAcceptanceVerifier({
 now:()=>now,
 verifyAdminProof:async()=>({status:'verified',proof:p as AdminProof}),
 lookupAdminAccount:async()=>({status:'verified',account:a as AdminAccount})
},env);
test('administrator acceptance cannot activate outside explicit test mode',()=>{
 const deps={verifyAdminProof:async()=>({status:'denied' as const}),lookupAdminAccount:async()=>({status:'denied' as const})};
 for(const e of [{NODE_ENV:'production',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'},{NODE_ENV:'test'},{}])assert.throws(()=>createAdminAcceptanceVerifier(deps,e),/test-only/);
});
test('fresh verified admin-specific proof and independent account authorization are both required',async()=>{
 assert.deepEqual(await build()('synthetic-proof'),{status:'verified',identity:{uid:'admin-ci',email:'admin@example.invalid',adminClaim:true}});
 for(const patch of [{audience:'stakeholder'},{method:'password'},{userVerified:false},{uid:''},{uid:'admin/other'},{authenticatedAt:now+1},{authenticatedAt:now-300001},{expiresAt:now},{expiresAt:now+300001}]){
  assert.deepEqual(await build({...proof,...patch})('synthetic-proof'),{status:'denied'});
 }
 for(const patch of [{uid:'other'},{role:'student'},{enabled:false},{adminAuthorized:false},{email:''}]){
  assert.deepEqual(await build(proof,{...account,...patch})('synthetic-proof'),{status:'denied'});
 }
});
test('unverified proof cannot trigger account lookup or establish administrator authority',async()=>{
 for(const status of ['denied','unavailable'] as const){
  const verify=createAdminAcceptanceVerifier({now:()=>now,verifyAdminProof:async()=>({status}),lookupAdminAccount:async()=>{throw Error('must not query');}},env);
  assert.deepEqual(await verify('ordinary-session'),{status});
 }
});
test('account dependency outage and expiry during lookup fail closed',async()=>{
 const deps={verifyAdminProof:async()=>({status:'verified' as const,proof})};
 assert.deepEqual(await createAdminAcceptanceVerifier({...deps,now:()=>now,lookupAdminAccount:async()=>{throw Error('private');}},env)('synthetic-proof'),{status:'unavailable'});
 let clock=now;
 const verify=createAdminAcceptanceVerifier({...deps,now:()=>clock,lookupAdminAccount:async()=>{clock=proof.expiresAt;return {status:'verified',account};}},env);
 assert.deepEqual(await verify('synthetic-proof'),{status:'denied'});
});
