import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityVerifier} from '../server/identityProvider';
const token=(sub:string,role:string)=>'header.'+Buffer.from(JSON.stringify({sub,role,auth_time:100})).toString('base64url')+'.signature';
const verifier=(status=200,uid='u')=>createIdentityVerifier({apiKey:'fixture',fetcher:(async()=>new Response(JSON.stringify({users:[{localId:uid,validSince:'100'}]}),{status})) as typeof fetch});
test('provider selection fails closed without fallback',()=>{assert.throws(()=>createIdentityVerifier({provider:'neon',apiKey:''}),/not enabled/);});
test('admin authority is bound to provider-verified identity',async()=>{assert.deepEqual(await verifier()(token('u','super_admin')),{status:'verified',identity:{uid:'u',email:undefined,adminClaim:true}});for(const t of [token('other','super_admin'),token('u','student')]){const r=await verifier()(t);assert.equal(r.status,'verified');if(r.status==='verified')assert.equal(r.identity.adminClaim,false);}});
test('denied or unavailable provider never grants principal',async()=>{assert.deepEqual(await verifier(401)(token('u','super_admin')),{status:'denied'});assert.deepEqual(await verifier(503)(token('u','super_admin')),{status:'unavailable'});});
