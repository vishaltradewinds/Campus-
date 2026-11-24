import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPostgresSessionVerifier} from '../server/postgresSessionIdentity';
const token=Buffer.alloc(32,7).toString('base64url');
test('uses bound digest not raw session secret',async()=>{const verify=createPostgresSessionVerifier(async(sql,params)=>{assert.ok(sql.includes('$1'));assert.deepEqual(params,[createHash('sha256').update(token,'ascii').digest('hex')]);return {rows:[{uid:'u',email:'u@example.invalid',admin_claim:false}]};});assert.deepEqual(await verify(token),{status:'verified',identity:{uid:'u',email:'u@example.invalid',adminClaim:false}});});
test('invalid tokens never query',async()=>{const verify=createPostgresSessionVerifier(async()=>{throw Error('unexpected');});for(const t of ['', 'abc',token+'=',token.slice(0,-1)+'B'])assert.deepEqual(await verify(t),{status:'denied'});});
test('missing, broken or ambiguous lookup fails closed',async()=>{for(const [rows,status] of [[[],'denied'],[[{uid:'u'}],'unavailable'],[[{},{}],'unavailable']] as const){const verify=createPostgresSessionVerifier(async()=>({rows:[...rows]}));assert.equal((await verify(token)).status,status);}assert.equal((await createPostgresSessionVerifier(async()=>{throw Error('private');})(token)).status,'unavailable');});

test('ordinary session verifier cannot elevate a principal from a database admin claim',async()=>{const verify=createPostgresSessionVerifier(async()=>({rows:[{uid:'ordinary',email:'ordinary@example.invalid',admin_claim:true}]}));assert.deepEqual(await verify(token),{status:'denied'});});
