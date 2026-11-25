import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelationships} from '../scripts/validate-import-relationships.mjs';
const row=(document_path,payload)=>({document_path,payload});
test('valid affiliation and independent candidate',()=>{const r=validateRelationships([row('institutions/c',{id:'c'}),row('students/s',{id:'s',institutionId:'c'}),row('students/i',{id:'i'})]);assert.equal(r.blocking,0);});
test('orphan affiliation blocks without exposing identifiers',()=>{const r=validateRelationships([row('students/private',{id:'private',institutionId:'missing'})]);assert.equal(r.findings.STUDENT_INSTITUTION_MISSING,1);assert.ok(!JSON.stringify(r).includes('private'));});
test('campaign and call missing stakeholders block',()=>{const r=validateRelationships([row('campaigns/c',{id:'c',employerId:'e',targetedInstitutionIds:['i']}),row('calls/x',{id:'x',campaignId:'c',employerId:'e',institutionId:'i'})]);assert.equal(r.findings.CAMPAIGN_EMPLOYER_MISSING,1);assert.equal(r.findings.CAMPAIGN_TARGET_MISSING,1);assert.equal(r.findings.CALL_STAKEHOLDER_MISSING,1);assert.ok(r.recruitmentBlocking>0);});
test('path mismatch and orphan offer blocked',()=>{const r=validateRelationships([row('offers/x',{id:'other',opportunityId:'missing'})]);assert.equal(r.findings.RECRUITMENT_PATH_ID_MISMATCH,1);assert.ok(r.recruitmentBlocking>0);});
