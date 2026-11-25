import test from 'node:test';
import assert from 'node:assert/strict';
import {createClientIdentityAccess,type ClientPrincipal} from '../src/lib/clientIdentity';
test('requires current authenticated principal',async()=>{const source:{currentUser:ClientPrincipal|null}={currentUser:null};const access=createClientIdentityAccess(source);await assert.rejects(()=>access.requireToken(),/required/);source.currentUser={uid:'u',getIdToken:async()=> 'fixture'};assert.equal(await access.requireToken(),'fixture');});
test('rejects identity change during asynchronous request preparation',async()=>{const source:{currentUser:ClientPrincipal|null}={currentUser:null};source.currentUser={uid:'u',getIdToken:async()=>{source.currentUser=null;return 'stale';}};await assert.rejects(()=>createClientIdentityAccess(source).requireToken(),/changed/);});
test('rejects empty provider response',async()=>{await assert.rejects(()=>createClientIdentityAccess({currentUser:{uid:'u',getIdToken:async()=>''}}).requireToken(),/changed/);});
