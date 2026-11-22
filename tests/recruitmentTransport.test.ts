import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecruitmentClient} from '../src/lib/recruitmentTransport';
import {createCookieSessionTransport} from '../src/lib/cookieSessionTransport';
test('recruitment and profile mutations use cookie transport and preserve request IDs',async()=>{
 const calls:Array<{path:string;body:any}>=[];let changed=0;
 const t=createCookieSessionTransport((async(path,init)=>{if(path==='/api/auth/session')return new Response(JSON.stringify({status:'authenticated',principal:{uid:'fixture',email:'fixture@example.invalid'}}));assert.equal(new Headers(init?.headers).has('Authorization'),false);calls.push({path:String(path),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify({replayed:false}));}) as typeof fetch);
 await t.refresh();const c=createRecruitmentClient(t.request,()=>changed++);
 await c.executeTrustedRecruitmentTransition('ADVANCE_CANDIDATE_STAGE',{stage:'ASSESSMENT'},'fixture-request-1');
 await c.executeTrustedProfileMutation('UPDATE_GLOBAL_PRIVACY',{enabled:false},'fixture-request-2');
 assert.equal(changed,2);assert.equal(calls[0].path,'/api/recruitment/transitions');assert.equal(calls[0].body.requestId,'fixture-request-1');assert.equal(calls[1].path,'/api/profile/mutations');
 await assert.rejects(()=>c.executeTrustedRecruitmentTransition('SEND_CALLS',{},'bad'),/Invalid requestId/);
});
test('failed mutation never signals workspace change',async()=>{let changed=0;const c=createRecruitmentClient(async()=>new Response(JSON.stringify({error:'Denied'}),{status:403}),()=>changed++);await assert.rejects(()=>c.executeTrustedProfileMutation('UPDATE_GLOBAL_PRIVACY',{},'fixture-request-3'),/Denied/);assert.equal(changed,0);});

test('invalid or missing successful confirmations never report a mutation or trigger refresh',async()=>{
 for(const raw of ['{}','invalid-json','{"replayed":false,"success":false}']){
  let changed=0;const c=createRecruitmentClient(async()=>new Response(raw),()=>changed++);
  await assert.rejects(()=>c.executeTrustedRecruitmentTransition('SEND_CALLS',{},'fixture-request-4'));
  assert.equal(changed,0);
 }
});
test('session change while decoding mutation response fails closed',async()=>{
 let release!:(value:Uint8Array)=>void;
 const body=new ReadableStream<Uint8Array>({start(controller){release=value=>{controller.enqueue(value);controller.close();};}});
 const t=createCookieSessionTransport((async(path)=>path==='/api/auth/session'?new Response(JSON.stringify({status:'authenticated',principal:{uid:'fixture',email:'fixture@example.invalid'}})):new Response(body)) as typeof fetch);
 await t.refresh();let changed=0;const c=createRecruitmentClient(t.request,()=>changed++);
 const mutation=c.executeTrustedRecruitmentTransition('SEND_CALLS',{},'fixture-request-5');
 await new Promise(r=>setTimeout(r,0));t.invalidate();release(new TextEncoder().encode('{"replayed":false}'));
 await assert.rejects(()=>mutation,/Session changed/);assert.equal(changed,0);
});
