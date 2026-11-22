import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountClient} from '../src/lib/accountClient';
import {createCookieSessionTransport} from '../src/lib/cookieSessionTransport';
test('account and workspace use verified cookie transport without explicit credentials',async()=>{
 const uid='student-fixture',email='student@example.invalid';
 const calls:string[]=[];
 const t=createCookieSessionTransport((async(path,opts)=>{calls.push(String(path));assert.equal(new Headers(opts?.headers).has('authorization'),false);assert.equal(opts?.credentials,'same-origin');const result=path==='/api/auth/session'?{status:'authenticated',principal:{uid,email}}:path==='/api/account/me'?{account:{uid,email,name:'Student',role:'student'}}:path==='/api/account/register'?{replayed:false}:path==='/api/account/registration-institutions'?{institutions:[]}:{uid,role:'student',status:'ready',profile:null,collections:Object.fromEntries(['employers','institutions','students','requirements','campaigns','calls','opportunities','users'].map(k=>[k,[]]))};return new Response(JSON.stringify(result));}) as typeof fetch);
 await t.refresh();const a=createAccountClient(uid,t.request);
 assert.equal((await a.fetchOwnAccount())?.uid,uid);
 await a.registerOwnAccount({role:'student'});assert.deepEqual(await a.fetchRegistrationInstitutions(),[]);assert.equal((await a.fetchStakeholderWorkspace('student')).role,'student');
 assert.equal(calls.length,5);
});
test('account client rejects mismatched principal and role',async()=>{
 const a=createAccountClient('expected',async()=>new Response(JSON.stringify({account:{uid:'other',role:'student',name:'Other',email:'other@example.invalid'}})));
 await assert.rejects(()=>a.fetchOwnAccount(),/Invalid account response/);
 const b=createAccountClient('expected',async()=>new Response(JSON.stringify({uid:'expected',role:'employer',status:'ready',profile:null,collections:{}})));
 await assert.rejects(()=>b.fetchStakeholderWorkspace('student'),/Invalid workspace response/);
});
