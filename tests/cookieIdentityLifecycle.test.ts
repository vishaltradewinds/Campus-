import test from 'node:test';
import assert from 'node:assert/strict';
import {createCookieIdentityLifecycle} from '../src/lib/cookieIdentityLifecycle';
const principal={uid:'fixture',email:'fixture@example.invalid'};
test('restores, signs in and revokes cookie session without JS credentials',async()=>{
 let authenticated=false;const calls:string[]=[];
 const c=createCookieIdentityLifecycle((async(path,init)=>{calls.push(String(path));assert.equal(init?.credentials,'same-origin');assert.equal(new Headers(init?.headers).has('authorization'),false);if(path==='/api/auth/login'){authenticated=true;return new Response(null,{status:204});}if(path==='/api/auth/logout'){authenticated=false;return new Response(null,{status:204});}if(path==='/api/auth/session')return authenticated?new Response(JSON.stringify({status:'authenticated',principal})):new Response(null,{status:401});return new Response('{}');}) as typeof fetch);
 const states:string[]=[];const unsubscribe=c.subscribe(s=>states.push(s.status));
 assert.equal(await c.restore(),null);assert.deepEqual(await c.signIn('fixture','synthetic-password'),principal);await c.request('/api/workspace');await c.signOut();assert.equal(c.current().status,'anonymous');await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);unsubscribe();assert.deepEqual(states,['anonymous','busy','anonymous','busy','authenticated','busy','anonymous']);assert.equal(calls.length,5);
});
test('unconfirmed logout is unavailable and blocks protected requests',async()=>{
 const c=createCookieIdentityLifecycle((async(p)=>p==='/api/auth/session'?new Response(JSON.stringify({status:'authenticated',principal})):new Response(null,{status:503})) as typeof fetch);
 await c.restore();await assert.rejects(()=>c.signOut(),/Logout not confirmed/);assert.equal(c.current().status,'unavailable');await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);
});
test('expired session clears frontend identity',async()=>{
 const c=createCookieIdentityLifecycle((async(p)=>p==='/api/auth/session'?new Response(JSON.stringify({status:'authenticated',principal})):new Response(null,{status:401})) as typeof fetch);
 await c.restore();await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);assert.equal(c.current().status,'anonymous');
});
