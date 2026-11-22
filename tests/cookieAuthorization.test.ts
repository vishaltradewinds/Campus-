import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createCookieAuthorization,sessionCookieName} from '../server/cookieAuthorization';
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
 mode='denied';assert.equal((await fetch(url,{headers:{cookie}})).status,401);
 mode='unavailable';assert.equal((await fetch(url,{headers:{cookie}})).status,503);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
