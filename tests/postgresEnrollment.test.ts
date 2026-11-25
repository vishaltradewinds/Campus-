import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEnrollmentService} from '../server/postgresEnrollment';
import {verifyPassword} from '../server/postgresCredentials';
const token=Buffer.alloc(32,9).toString('base64url'),password='synthetic-long-password';
test('enrollment sends digest and salted password hash only',async()=>{const enroll=createEnrollmentService(async(sql,p)=>{assert.ok(sql.includes('$1,$2'));assert.equal(p[0],createHash('sha256').update(token).digest('hex'));assert.equal(await verifyPassword(password,p[1]),true);return {rows:[{enrolled:true}]};});assert.equal(await enroll(token,password),true);});
test('invalid tokens and passwords never query',async()=>{let n=0;const enroll=createEnrollmentService(async()=>{n++;return {rows:[]};});assert.equal(await enroll('bad',password),false);assert.equal(await enroll(token,'short'),false);assert.equal(n,0);});
test('database refusal and outage fail closed',async()=>{assert.equal(await createEnrollmentService(async()=>({rows:[{enrolled:false}]}))(token,password),false);await assert.rejects(()=>createEnrollmentService(async()=>{throw Error('private');})(token,password),/^Error: Enrollment service unavailable$/);});
