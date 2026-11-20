import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupFirebaseIdentity } from '../server/firebaseIdentity';
const token='header.'+Buffer.from(JSON.stringify({auth_time:100})).toString('base64url')+'.signature';
const fake=(body:unknown,status=200)=> (async()=>new Response(JSON.stringify(body),{status})) as typeof fetch;
const lookup=(body:unknown,status=200)=>lookupFirebaseIdentity({token,apiKey:'fixture',fetcher:fake(body,status)});
test('authentication checks every request and respects account disablement and token revocation',async()=>{
  assert.equal((await lookup({users:[{localId:'u',validSince:'100'}]})).status,'verified');
  assert.equal((await lookup({users:[{localId:'u',disabled:true}]})).status,'denied');
  assert.equal((await lookup({users:[{localId:'u',validSince:'101'}]})).status,'denied');
  assert.equal((await lookup({users:[]})).status,'denied');
});
test('invalid token and service failure are distinct fail-closed outcomes',async()=>{
  assert.deepEqual(await lookup({},400),{status:'denied'});
  assert.deepEqual(await lookup({},401),{status:'denied'});
  assert.deepEqual(await lookup({},429),{status:'unavailable'});
  assert.deepEqual(await lookup({},503),{status:'unavailable'});
  assert.deepEqual(await lookupFirebaseIdentity({token,apiKey:'fixture',fetcher:(async()=>{throw new Error('private details')}) as typeof fetch}),{status:'unavailable'});
});
test('missing or excessive credentials never trigger an upstream request',async()=>{
  const fetcher=(async()=>{throw new Error('unexpected network')}) as typeof fetch;
  for(const value of ['', 'x'.repeat(8193)])assert.deepEqual(await lookupFirebaseIdentity({token:value,apiKey:'fixture',fetcher}),{status:'denied'});
});
