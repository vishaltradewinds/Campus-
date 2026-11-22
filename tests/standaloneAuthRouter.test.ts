import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createStandaloneAuthRouter} from '../server/standaloneAuthRouter';
const env={NODE_ENV:'test',NEXUSTALENT_STANDALONE_AUTH_TEST:'1'};
const token=Buffer.alloc(32,7).toString('base64url');
const service={login:async(l:string,p:string)=>p==='correct-password'?token:null,logout:async(t:string)=>t===token};
async function withServer(s:typeof service,run:(base:string)=>Promise<void>){
 const app=express();app.use('/auth',createStandaloneAuthRouter(s,env));const server=app.listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();if(!a||typeof a==='string')throw Error();await run('http://127.0.0.1:'+a.port+'/auth');}
 finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
}
const login=(base:string,password:string,extra={})=>fetch(base+'/login',{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify({login:'u@example.invalid',password})});
test('cannot mount outside explicit isolated test mode',()=>{for(const e of [{NODE_ENV:'production',NEXUSTALENT_STANDALONE_AUTH_TEST:'1'},{NODE_ENV:'test'}])assert.throws(()=>createStandaloneAuthRouter(service,e),/test-only/);});
test('HTTP login and logout; no caching or cross-origin browser activation',async()=>withServer(service,async base=>{
 let r=await login(base,'wrong');assert.equal(r.status,401);
 r=await login(base,'correct-password',{origin:'https://example.invalid'});assert.equal(r.status,403);
 r=await login(base,'correct-password');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{token});
 r=await fetch(base+'/logout',{method:'POST',headers:{authorization:'Bearer '+token}});assert.equal(r.status,204);
 r=await fetch(base+'/logout',{method:'POST'});assert.equal(r.status,401);
}));
test('account rate limit and failed revocation',async()=>withServer({...service,logout:async()=>false},async base=>{
 for(let i=0;i<5;i++)assert.equal((await login(base,'wrong')).status,401);
 assert.equal((await login(base,'correct-password')).status,429);
 assert.equal((await fetch(base+'/logout',{method:'POST',headers:{authorization:'Bearer '+token}})).status,503);
}));
