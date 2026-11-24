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

test('stale JSON body and cloned response cannot cross session generation',async()=>{
 let release!:(value:Uint8Array)=>void;
 const body=new ReadableStream<Uint8Array>({start(controller){release=value=>{controller.enqueue(value);controller.close();};}});
 const t=createCookieSessionTransport((async(p)=>p==='/api/auth/session'?state():new Response(body)) as typeof fetch);
 await t.refresh();const response=await t.request('/api/workspace');const clone=response.clone();
 const reading=response.json();t.invalidate();release(new TextEncoder().encode('{"private":"synthetic"}'));
 await assert.rejects(()=>reading,/Session changed/);await assert.rejects(()=>clone.json(),/Session changed/);
 assert.throws(()=>response.clone(),/Session changed/);
});
test('cookie transport preserves explicit caller cancellation',async()=>{
 const t=createCookieSessionTransport((async(p,o)=>{if(p==='/api/auth/session')return state();assert.equal(o?.signal?.aborted,true);throw Error('Cancelled');}) as typeof fetch);
 await t.refresh();const controller=new AbortController();controller.abort();
 await assert.rejects(()=>t.request('/api/workspace',{signal:controller.signal}),/Cancelled/);
});

test('pagination GET requests preserve cookie security and reject query-scope injection',async()=>{
 const calls:string[]=[];
 const transport=createCookieSessionTransport((async(p,opts)=>{if(p==='/api/auth/session')return state();calls.push(String(p));assert.equal(opts?.credentials,'same-origin');assert.equal(opts?.redirect,'error');return new Response('{}');}) as typeof fetch);
 await transport.refresh();
 for(const p of ['/api/account/registration-institutions?page=1','/api/account/registration-institutions?page=1&after=ci-campus','/api/workspace/page?collection=opportunities&after=ci-opp'])await transport.request(p);
 assert.equal(calls.length,3);
 for(const p of ['/api/workspace?uid=other','/api/auth/session?page=1','/api/account/registration-institutions?page=1&uid=other','/api/account/registration-institutions?page=1&page=2','/api/account/registration-institutions?page=1&after=bad%2Fcursor','/api/workspace/page?collection=users&role=super_admin','/api/workspace/page?collection=users&collection=students','/api/workspace/page?collection=unknown','/api/workspace/page?collection=students#fragment','/api/workspace/page?collection=students&after=%00'])await assert.rejects(()=>transport.request(p),/Invalid API path/);
 await assert.rejects(()=>transport.request('/api/workspace/page?collection=students',{method:'POST'}),/Invalid API path/);
 assert.equal(calls.length,3);
});
