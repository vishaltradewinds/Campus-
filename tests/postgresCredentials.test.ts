import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashPassword,verifyPassword,createCredentialService} from '../server/postgresCredentials';
const password='synthetic-password-long';
test('salted credential hashing and wrong password denial',async()=>{const a=await hashPassword(password),b=await hashPassword(password);assert.notEqual(a,b);assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('wrong-password-long',a),false);assert.equal(await verifyPassword(password,'broken'),false);await assert.rejects(()=>hashPassword('short'));});
test('session issuance uses bound digest and only succeeds after password validation',async()=>{const hash=await hashPassword(password);let args:string[]=[];const service=createCredentialService(async(sql,p)=>{if(sql.includes('login_credential'))return {rows:[{uid:'u',password_hash:hash}]};args=p;return {rows:[{issued:true}]};});assert.equal(await service.login('x@example.invalid','wrong-password-long'),null);assert.deepEqual(args,[]);const token=await service.login('x@example.invalid',password);assert.ok(token);assert.equal(args[2],createHash('sha256').update(token!).digest('hex'));assert.notEqual(args[2],token);});
test('missing credential and changed credential fail closed',async()=>{const hash=await hashPassword(password);assert.equal(await createCredentialService(async()=>({rows:[]})).login('x@example.invalid',password),null);assert.equal(await createCredentialService(async(sql)=>({rows:sql.includes('login_credential')?[{uid:'u',password_hash:hash}]:[{issued:false}]})).login('x@example.invalid',password),null);});
test('logout verifies canonical token and passes digest only',async()=>{const token=Buffer.alloc(32,9).toString('base64url');const service=createCredentialService(async(sql,p)=>{assert.ok(sql.includes('revoke_session'));assert.deepEqual(p,[createHash('sha256').update(token).digest('hex')]);return {rows:[{revoked:true}]};});assert.equal(await service.logout('bad'),false);assert.equal(await service.logout(token),true);});

test('credential datastore outage is unavailable, not invalid credentials',async()=>{const service=createCredentialService(async()=>{throw Error('private connection string');});await assert.rejects(()=>service.login('fixture@example.invalid',password),/^Error: Authentication service unavailable$/);});

test('authenticated password rotation uses old-password proof, scoped SQL and fresh salted hash only',async()=>{
 const token=Buffer.alloc(32,11).toString('base64url');
 const next='synthetic-new-password-long';
 const old=await hashPassword(password);
 let updates=0;
 const service=createCredentialService(async(sql,params)=>{
  if(sql.includes('credential_for_session')){
   assert.deepEqual(params,[createHash('sha256').update(token).digest('hex')]);
   return {rows:[{uid:'ordinary-fixture',password_hash:old}]};
  }
  if(sql.includes('change_credential')){
   updates++;
   assert.equal(params.length,3);
   assert.equal(params[0],createHash('sha256').update(token).digest('hex'));
   assert.equal(params[1],old);
   assert.equal(await verifyPassword(next,params[2]),true);
   assert.equal(await verifyPassword(password,params[2]),false);
   return {rows:[{changed:true}]};
  }
  throw Error('Unexpected SQL');
 });
 assert.equal(await service.changePassword('invalid',password,next),false);
 assert.equal(await service.changePassword(token,password,'short'),false);
 assert.equal(await service.changePassword(token,password,password),false);
 assert.equal(await service.changePassword(token,'incorrect-password-long',next),false);
 assert.equal(updates,0);
 assert.equal(await service.changePassword(token,password,next),true);
 assert.equal(updates,1);
});
test('credential change refuses missing session, changed hash and datastore outage',async()=>{
 const token=Buffer.alloc(32,12).toString('base64url');
 const old=await hashPassword(password);
 assert.equal(await createCredentialService(async()=>({rows:[]})).changePassword(token,password,'synthetic-new-password'),false);
 assert.equal(await createCredentialService(async(sql)=>({rows:sql.includes('credential_for_session')?[{uid:'u',password_hash:old}]:[{changed:false}]})).changePassword(token,password,'synthetic-new-password'),false);
 const service=createCredentialService(async()=>{throw Error('secret connection string');});
 await assert.rejects(()=>service.changePassword(token,password,'synthetic-new-password'),/^Error: Credential change unavailable$/);
});
