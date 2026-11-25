import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createBrowserAuthRouter} from '../server/browserAuthRouter';
import {createCookieAuthorization,sessionCookieName,validOrdinaryPrincipal} from '../server/cookieAuthorization';
const env={NODE_ENV:'test',NEXUSTALENT_STANDALONE_AUTH_TEST:'1'},origin='https://127.0.0.1:4443';
const cookie=sessionCookieName+'='+Buffer.alloc(32,7).toString('base64url');
test('cookie middleware rejects production activation',()=>{assert.throws(()=>createCookieAuthorization(async()=>({status:'denied'}),origin,{NODE_ENV:'production'}),/test-only/);});
test('stakeholder API authorization denies mixed credentials, foreign origin, revoked or privileged sessions',async()=>{
 let mode='verified';
 const app=express();const auth=createCookieAuthorization(async()=>mode==='verified'||mode==='admin'?{status:'verified',identity:{uid:'fixture',adminClaim:mode==='admin'}}:mode==='denied'?{status:'denied'}:{status:'unavailable'},origin,env);
 app.all('/api/workspace',auth,(_q,r)=>r.json({uid:r.locals.identity.uid,legacyCredential:!!r.locals.firebaseIdToken}));
 const server=app.listen(0,'127.0.0.1');try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');const url='http://127.0.0.1:'+a.port+'/api/workspace';
 assert.equal((await fetch(url)).status,401);
 assert.equal((await fetch(url,{headers:{cookie,authorization:'Bearer fixture'}})).status,400);
 assert.equal((await fetch(url,{method:'POST',headers:{cookie}})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers:{cookie,origin:'https://foreign.invalid'}})).status,403);
 assert.deepEqual(await (await fetch(url,{method:'POST',headers:{cookie,origin}})).json(),{uid:'fixture',legacyCredential:false});
 mode='admin';assert.equal((await fetch(url,{headers:{cookie}})).status,403);
 mode='denied';const denied=await fetch(url,{headers:{cookie}});assert.equal(denied.status,401);assert.match(denied.headers.get('set-cookie')||'',/__Host-nexustalent-session=;/);
 mode='unavailable';const unavailable=await fetch(url,{headers:{cookie}});assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('set-cookie'),null);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});


test('ordinary identity requires an explicit false admin claim and valid UID',()=>{
 for(const p of [null,{}, {uid:'fixture'}, {uid:'fixture',adminClaim:null}, {uid:'fixture',adminClaim:0}, {uid:'fixture',adminClaim:true}, {uid:'',adminClaim:false}, {uid:'a/b',adminClaim:false}, {uid:' fixture',adminClaim:false}, {uid:'a'+String.fromCharCode(0)+'b',adminClaim:false}, {uid:'a'.repeat(201),adminClaim:false}])assert.equal(validOrdinaryPrincipal(p),false);
 assert.equal(validOrdinaryPrincipal({uid:'fixture',adminClaim:false}),true);
});
test('browser session and protected routes reject spoofed forwarding headers before identity lookup',async()=>{
 let calls=0,mode='missing';
 const app=express();
 const verify=async()=>{calls++;return {status:'verified' as const,identity:{uid:'fixture',email:'fixture@example.invalid',...(mode==='ordinary'?{adminClaim:false}:{})} as any};};
 app.use('/auth',createBrowserAuthRouter({login:async()=>null,logout:async()=>false},verify,origin,env));
 app.get('/private',createCookieAuthorization(verify,origin,env),(_q,r)=>r.sendStatus(204));
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');
  const base='http://127.0.0.1:'+a.port;
  for(const path of ['/auth/session','/private']){
   for(const header of ['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-forwarded-port','x-real-ip']){
    const response=await fetch(base+path,{headers:{cookie,[header]:'synthetic'}});assert.equal(response.status,403,header);
   }
   assert.equal((await fetch(base+path,{headers:{cookie,origin:'https://foreign.invalid'}})).status,403);
  }
  assert.equal(calls,0);
  assert.equal((await fetch(base+'/private',{headers:{cookie}})).status,403);
  assert.equal((await fetch(base+'/auth/session',{headers:{cookie}})).status,401);
  mode='ordinary';
  assert.equal((await fetch(base+'/private',{headers:{cookie}})).status,204);
  assert.equal((await fetch(base+'/auth/session',{headers:{cookie}})).status,200);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
