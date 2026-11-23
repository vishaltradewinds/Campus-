import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStandaloneRuntime} from '../server/standaloneRuntime';
const env={NODE_ENV:'test',NEXUSTALENT_STANDALONE_AUTH_TEST:'1',NEXUSTALENT_DATASTORE:'postgres',NEXUSTALENT_PG_INTEGRATION:'1'};
test('standalone health is process-only, static scope is bounded, missing build fails startup',async t=>{
 const dist=await mkdtemp(join(tmpdir(),'nexus-runtime-'));t.after(()=>rm(dist,{recursive:true,force:true}));
 let identityCalls=0;
 const input={dist,origin:'https://127.0.0.1:4443',service:{login:async()=>null,logout:async()=>false},verify:async()=>{identityCalls++;return {status:'denied' as const};},mount:()=>{}};
 assert.throws(()=>createStandaloneRuntime(input,env),/build incomplete/);
 await mkdir(join(dist,'assets'));await writeFile(join(dist,'standalone.html'),'<html>fixture</html>');await writeFile(join(dist,'assets/main.js'),'console.log("fixture")');await writeFile(join(dist,'unrelated.json'),'{}');
 assert.throws(()=>createStandaloneRuntime(input,{...env,NODE_ENV:'production'}),/test-only/);
 const server=createStandaloneRuntime(input,env).listen(0,'127.0.0.1');
 try{await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');const base='http://127.0.0.1:'+a.port;
 const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal(health.headers.get('cache-control'),'no-store');assert.deepEqual(await health.json(),{status:'ok',scope:'process_only',deploymentReady:false});assert.equal(identityCalls,0);
 for(const p of ['/','/standalone.html']){const r=await fetch(base+p);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');}
 assert.equal((await fetch(base+'/assets/main.js')).status,200);for(const p of ['/assets/missing.js','/unrelated.json','/.vite/manifest.json','/unknown','/api/unknown'])assert.equal((await fetch(base+p)).status,404,p);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});

test('virtual acceptance windows enforce real request ceilings and reset only when clock advances',async t=>{
 const dist=await mkdtemp(join(tmpdir(),'nexus-clock-'));t.after(()=>rm(dist,{recursive:true,force:true}));
 await mkdir(join(dist,'assets'));await writeFile(join(dist,'standalone.html'),'<html>fixture</html>');
 let time=1000,invocations=0;
 const app=createStandaloneRuntime({
  origin:'https://127.0.0.1:4443',dist,
  service:{login:async()=>{invocations++;return null;},logout:async()=>false},
  verify:async()=>({status:'denied' as const}),
  acceptanceNow:()=>time,
  mount:(expressApp,limit)=>{expressApp.get('/api/bounded-window',limit,(_req,res)=>res.sendStatus(204));}
 },env);
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise<void>(r=>server.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');
  const base='http://127.0.0.1:'+address.port;
  for(let i=0;i<20;i++)assert.equal((await fetch(base+'/api/bounded-window')).status,204);
  assert.equal((await fetch(base+'/api/bounded-window')).status,429);
  for(let i=0;i<30;i++)assert.equal((await fetch(base+'/api/auth/session')).status,401);
  assert.equal((await fetch(base+'/api/auth/session')).status,429);
  time+=61000;
  assert.equal((await fetch(base+'/api/bounded-window')).status,204);
  assert.equal((await fetch(base+'/api/auth/session')).status,401);
  for(let i=0;i<5;i++){
   const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://127.0.0.1:4443','content-type':'application/json'},body:JSON.stringify({login:'synthetic@example.invalid',password:'synthetic-pass-long'})});
   assert.equal(r.status,401);
  }
  assert.equal(invocations,5);
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://127.0.0.1:4443','content-type':'application/json'},body:JSON.stringify({login:'synthetic@example.invalid',password:'synthetic-pass-long'})})).status,429);
  time+=61000;
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://127.0.0.1:4443','content-type':'application/json'},body:JSON.stringify({login:'synthetic@example.invalid',password:'synthetic-pass-long'})})).status,401);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
