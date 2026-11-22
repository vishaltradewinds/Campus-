import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createBrowserAuthRouter} from '../server/browserAuthRouter';
const env={NODE_ENV:'test',NEXUSTALENT_STANDALONE_AUTH_TEST:'1'};
const origin='https://127.0.0.1:4443',token=Buffer.alloc(32,7).toString('base64url');
test('production cannot mount the browser rehearsal',()=>{assert.throws(()=>createBrowserAuthRouter({login:async()=>null,logout:async()=>false},async()=>({status:'denied'}),origin,{NODE_ENV:'production'}),/test-only/);});
test('cookie lifecycle excludes token and role from response; rejects foreign origins',async()=>{
 let revoked=false;
 const app=express();app.use('/auth',createBrowserAuthRouter({login:async()=>token,logout:async()=>{revoked=true;return true;}},async()=>revoked?{status:'denied'}:{status:'verified',identity:{uid:'fixture',email:'fixture@example.invalid',adminClaim:false}},origin,env));
 const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');const base='http://127.0.0.1:'+a.port+'/auth';
 const signIn=(o?:string)=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',...(o?{origin:o}:{})},body:JSON.stringify({login:'fixture',password:'synthetic-password'})});
 assert.equal((await signIn()).status,403);assert.equal((await signIn('https://example.invalid')).status,403);
 const login=await signIn(origin);assert.equal(login.status,204);assert.equal(await login.text(),'');
 const set=login.headers.get('set-cookie')!;for(const attr of ['HttpOnly','Secure','SameSite=Strict','Path=/','__Host-nexustalent-session='])assert.ok(set.includes(attr));assert.ok(!set.includes('Domain='));
 const cookie=set.split(';')[0];assert.equal((await fetch(base+'/session')).status,401);
 const session=await fetch(base+'/session',{headers:{cookie}});assert.equal(session.status,200);assert.deepEqual(await session.json(),{status:'authenticated',principal:{uid:'fixture',email:'fixture@example.invalid'}});
 assert.equal((await fetch(base+'/session',{headers:{cookie:cookie+'; '+cookie}})).status,401);
 assert.equal((await fetch(base+'/logout',{method:'POST',headers:{cookie,origin:'https://example.invalid'}})).status,403);
 const logout=await fetch(base+'/logout',{method:'POST',headers:{cookie,origin}});assert.equal(logout.status,204);assert.ok(logout.headers.get('set-cookie')?.includes('Expires='));
 assert.equal((await fetch(base+'/session',{headers:{cookie}})).status,401);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});

test('invitation enrollment requires same-origin, one-use grant and no existing cookie',async()=>{
 let redeemed=false,calls=0;
 const app=express();app.use('/auth',createBrowserAuthRouter({login:async()=>null,logout:async()=>false,enroll:async(code,password)=>{calls++;if(code!==token||password!=='synthetic-password'||redeemed)return false;redeemed=true;return true;}},async()=>({status:'denied'}),origin,env));
 const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');const url='http://127.0.0.1:'+a.port+'/auth/enroll';
 const post=(body:unknown,headers:Record<string,string>={origin})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 const valid={token,password:'synthetic-password'};
 assert.equal((await post(valid,{})).status,403);
 assert.equal((await post(valid,{origin:'https://example.invalid'})).status,403);
 assert.equal((await post({...valid,role:'super_admin'})).status,400);
 assert.equal((await post({...valid,password:'short'})).status,400);
 assert.equal((await post(valid,{origin,cookie:'__Host-nexustalent-session='+token})).status,409);
 assert.equal(calls,0);
 const success=await post(valid);assert.equal(success.status,204);assert.equal(success.headers.get('set-cookie'),null);assert.equal(await success.text(),'');
 assert.equal((await post(valid)).status,403);assert.equal(calls,2);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});

test('server-denied session is cleared, unavailable session is not',async()=>{
 let unavailable=true;
 const app=express();app.use('/auth',createBrowserAuthRouter({login:async()=>token,logout:async()=>false},async()=>unavailable?{status:'unavailable'}:{status:'denied'},origin,env));
 const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');const base='http://127.0.0.1:'+a.port+'/auth';const cookie='__Host-nexustalent-session='+token;
 const outage=await fetch(base+'/session',{headers:{cookie}});assert.equal(outage.status,503);assert.equal(outage.headers.get('set-cookie'),null);
 unavailable=false;const denied=await fetch(base+'/session',{headers:{cookie}});assert.equal(denied.status,401);assert.match(denied.headers.get('set-cookie')||'',/__Host-nexustalent-session=;/);
 const fresh=await fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({login:'fixture',password:'synthetic-password'})});assert.equal(fresh.status,204);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
