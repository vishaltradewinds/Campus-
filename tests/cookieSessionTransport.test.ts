import test from 'node:test';
import assert from 'node:assert/strict';
import {createCookieSessionTransport} from '../src/lib/cookieSessionTransport';
const principal={uid:'fixture',email:'fixture@example.invalid'};
const state=()=>new Response(JSON.stringify({status:'authenticated',principal}));
test('cookie transport requires verified session and restricts API destination',async()=>{
 const calls:Array<[unknown,RequestInit|undefined]>=[];
 const t=createCookieSessionTransport((async(p,o)=>{calls.push([p,o]);return p==='/api/auth/session'?state():new Response('{}');}) as typeof fetch);
 await assert.rejects(()=>t.request('/api/workspace'),/Authentication required/);
 assert.deepEqual(await t.refresh(),principal);
 for(const path of ['https://external.invalid/api/workspace','//external.invalid/api/workspace','/api/../admin','/api/auth/logout'])await assert.rejects(()=>t.request(path),/Invalid API path/);
 await assert.rejects(()=>t.request('/api/workspace',{headers:{Authorization:'Bearer fixture'}}),/Explicit credentials/);
 await t.request('/api/workspace',{credentials:'include',redirect:'follow'});
 assert.equal(calls.length,2);assert.equal(calls[1][1]?.credentials,'same-origin');assert.equal(calls[1][1]?.redirect,'error');
});
test('unauthorized API response invalidates session',async()=>{const t=createCookieSessionTransport((async(p)=>p==='/api/auth/session'?state():new Response(null,{status:401})) as typeof fetch);await t.refresh();await assert.rejects(()=>t.request('/api/workspace'),/Authentication required/);assert.equal(t.current(),null);});
test('invalidation rejects an in-flight response',async()=>{let release:(r:Response)=>void=()=>{};const t=createCookieSessionTransport((async(p)=>p==='/api/auth/session'?state():new Promise<Response>(r=>{release=r;})) as typeof fetch);await t.refresh();const pending=t.request('/api/workspace');t.invalidate();release(new Response('{}'));await assert.rejects(()=>pending,/Session changed/);assert.equal(t.current(),null);});
