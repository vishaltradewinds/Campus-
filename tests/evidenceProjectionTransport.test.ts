import test from 'node:test';
import assert from 'node:assert/strict';
import {createCookieSessionTransport} from '../src/lib/cookieSessionTransport';
import {requestCandidateProjection} from '../src/lib/candidateProjectionTransport';
import {requestCareerEvidence} from '../src/lib/evidenceTransport';
test('candidate projection and career evidence use cookie session without explicit credentials',async()=>{
 const calls:string[]=[];const t=createCookieSessionTransport((async(path,init)=>{if(path==='/api/auth/session')return new Response(JSON.stringify({status:'authenticated',principal:{uid:'fixture',email:'fixture@example.invalid'}}));assert.equal(new Headers(init?.headers).has('authorization'),false);calls.push(String(path));if(path==='/api/candidate-projections'){assert.equal(JSON.parse(String(init?.body)).view,true);return new Response(JSON.stringify({projectionId:'projection-fixture',replayed:false}));}return new Response(JSON.stringify({evidence:[{id:'evidence-fixture'}]}));}) as typeof fetch);
 await t.refresh();assert.equal((await requestCandidateProjection(t.request,{campaignId:'campaign-fixture',studentId:'student-fixture',requestId:'request-fixture'})).projectionId,'projection-fixture');assert.equal((await requestCareerEvidence(t.request,t.current))[0].id,'evidence-fixture');assert.deepEqual(calls,['/api/candidate-projections','/api/career-evidence']);
});
test('invalid projection and stale evidence response fail closed',async()=>{
 await assert.rejects(()=>requestCandidateProjection(async()=>new Response('{}'),{campaignId:'c',studentId:'s',requestId:'r'}),/Invalid projection/);
 let principal:{uid:string}|null={uid:'fixture'};await assert.rejects(()=>requestCareerEvidence(async()=>{principal={uid:'fixture'};return new Response(JSON.stringify({evidence:[]}));},()=>principal),/Invalid evidence/);
});
