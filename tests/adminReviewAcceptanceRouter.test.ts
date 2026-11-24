import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createAdminReviewAcceptanceRouter} from '../server/adminReviewAcceptanceRouter';

const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'};
const origin='https://127.0.0.1:4443';
const body={action:'UPDATE_EMPLOYER_VERIFICATION',requestId:'review-ci-001',payload:{employerId:'employer-ci',status:'verified',notes:'Synthetic evidence'}};
test('administrator review adapter is unmountable in production',()=>{
 const deps={origin,verify:async()=>({status:'denied' as const}),review:async()=>{throw Error('unexpected');}};
 assert.throws(()=>createAdminReviewAcceptanceRouter(deps,{NODE_ENV:'production',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'}),/test-only/);
 assert.throws(()=>createAdminReviewAcceptanceRouter({...deps,origin:'https://example.invalid'},env),/Loopback/);
});
test('isolated reviews reject ordinary sessions, foreign origins, forged identities and unsupported actions',async()=>{
 let calls=0,mode='admin';
 const app=express();
 app.use('/admin',createAdminReviewAcceptanceRouter({origin,verify:async(token)=>{
  if(token!=='synthetic-admin-proof')return {status:'denied'};
  if(mode==='outage')return {status:'unavailable'};
  return {status:'verified',identity:{uid:'admin-ci',adminClaim:mode==='admin'}};
 },review:async input=>{
  calls++;
  assert.equal(input.actorUid,'admin-ci');assert.equal(input.adminClaim,true);
  assert.deepEqual(input.payload,body.payload);
  if(mode==='write-failure')throw Error('private');
  return {replayed:false,auditEventId:'a'.repeat(64),ids:['employer-ci']};
 }},env));
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise<void>(r=>server.once('listening',r));
  const a=server.address();assert.ok(a&&typeof a!=='string');
  const url='http://127.0.0.1:'+a.port+'/admin/reviews';
  const headers={origin,authorization:'Bearer synthetic-admin-proof','content-type':'application/json'};
  const post=(value:unknown=body,h:Record<string,string>=headers)=>fetch(url,{method:'POST',headers:h,body:JSON.stringify(value)});
  assert.equal((await post(body,{...headers,origin:'https://foreign.invalid'})).status,403);
  assert.equal((await post(body,{...headers,cookie:'__Host-nexustalent-session=ordinary'})).status,400);
  assert.equal((await post(body,{...headers,authorization:'Bearer ordinary-session'})).status,401);
  mode='ordinary';assert.equal((await post()).status,403);
  mode='outage';assert.equal((await post()).status,503);
  mode='admin';
  for(const invalid of [{...body,actorUid:'forged'},{...body,adminClaim:true},{...body,action:'PROVISION_USER_ROLE'},{...body,payload:{...body.payload,notes:' '}},{...body,payload:{...body.payload,verifiedByAdmin:true}}])assert.equal((await post(invalid)).status,400);
  assert.equal(calls,0);
  const success=await post();assert.equal(success.status,201);assert.deepEqual(await success.json(),{replayed:false,auditEventId:'a'.repeat(64),ids:['employer-ci']});
  assert.equal(calls,1);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
test('failed administrator review never reports success',async()=>{
 const app=express();
 app.use('/admin',createAdminReviewAcceptanceRouter({origin,verify:async()=>({status:'verified',identity:{uid:'admin-ci',adminClaim:true}}),review:async()=>{throw Error('private datastore details');}},env));
 const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');
  const response=await fetch('http://127.0.0.1:'+a.port+'/admin/reviews',{method:'POST',headers:{origin,authorization:'Bearer synthetic-admin-proof','content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Review not confirmed'});
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
