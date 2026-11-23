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

test('invitation redemption does not authenticate or expose session credentials',async()=>{
 let calls=0;
 const c=createCookieIdentityLifecycle((async(path,init)=>{calls++;assert.equal(path,'/api/auth/enroll');assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');assert.equal(new Headers(init?.headers).has('authorization'),false);assert.deepEqual(JSON.parse(String(init?.body)),{token:'synthetic-token',password:'synthetic-password'});return new Response(null,{status:calls===1?204:403});}) as typeof fetch);
 assert.equal(await c.enroll('synthetic-token','synthetic-password'),true);assert.equal(c.current().status,'anonymous');
 await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);
 assert.equal(await c.enroll('synthetic-token','synthetic-password'),false);assert.equal(c.current().status,'anonymous');assert.equal(calls,2);
});
test('enrollment outage remains unavailable rather than reporting success',async()=>{
 const c=createCookieIdentityLifecycle((async()=>new Response(null,{status:503})) as typeof fetch);
 await assert.rejects(()=>c.enroll('synthetic-token','synthetic-password'),/Enrollment unavailable/);
 assert.equal(c.current().status,'unavailable');
 await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);
});

test('password change revokes the client session; wrong current password preserves verified access',async()=>{
 let authenticated=true,attempts=0;
 const fetcher=(async(path,init)=>{
  assert.equal(init?.credentials,'same-origin');
  if(path==='/api/auth/session')return authenticated?new Response(JSON.stringify({status:'authenticated',principal})):new Response(null,{status:401});
  if(path==='/api/auth/password'){
   attempts++;
   assert.equal(init?.method,'POST');
   assert.equal(new Headers(init.headers).has('authorization'),false);
   const b=JSON.parse(String(init.body));
   assert.equal(b.newPassword,'synthetic-new-password');
   if(b.currentPassword!=='synthetic-old-password')return new Response(null,{status:403});
   authenticated=false;return new Response(null,{status:204});
  }
  if(path==='/api/workspace')return new Response(JSON.stringify({ok:true}));
  return new Response(null,{status:404});
 }) as typeof fetch;
 const c=createCookieIdentityLifecycle(fetcher);
 await c.restore();
 assert.equal(await c.changePassword('incorrect-long-password','synthetic-new-password'),false);
 assert.equal(c.current().status,'authenticated');
 assert.deepEqual(await (await c.request('/api/workspace')).json(),{ok:true});
 assert.equal(await c.changePassword('synthetic-old-password','synthetic-new-password'),true);
 assert.equal(c.current().status,'anonymous');
 await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);
 assert.equal(attempts,2);
});
test('password-change outage fails closed without falsely reporting a revoked session',async()=>{
 const c=createCookieIdentityLifecycle((async(path)=>{
  if(path==='/api/auth/session')return new Response(JSON.stringify({status:'authenticated',principal}));
  return new Response(null,{status:503});
 }) as typeof fetch);
 await c.restore();
 await assert.rejects(()=>c.changePassword('synthetic-old-password','synthetic-new-password'),/Credential change unavailable/);
 assert.equal(c.current().status,'unavailable');
 await assert.rejects(()=>c.request('/api/workspace'),/Authentication required/);
});
