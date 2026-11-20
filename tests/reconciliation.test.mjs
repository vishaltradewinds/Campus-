import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconcileRecruitment} from '../scripts/reconcile-recruitment.mjs';
const oid=createHash('sha256').update('call:student').digest('hex');
const fixture=()=>({
 students:[{id:'student',institutionId:'inst',campaignConsents:{camp:{status:'approved',opportunityId:oid,employerId:'emp',updatedAt:'2026-11-20'}}}],
 campaigns:[{id:'camp',employerId:'emp',targetedInstitutionIds:['inst'],callsSent:[{id:'call',institutionId:'inst'}],candidateOpportunities:[]}],
 calls:[{id:'call',campaignId:'camp',institutionId:'inst',employerId:'emp',activatedStudentsCount:1,offeredCandidatesCount:1}],
 opportunities:[{id:oid,callId:'call',studentId:'student',campaignId:'camp',employerId:'emp',institutionId:'inst',studentName:'Candidate',stage:'joined',offerRecordId:'offer'}],
 offers:[{id:'offer',opportunityId:oid,studentId:'student',campaignId:'camp',employerId:'emp',institutionId:'inst',status:'joined',currency:'INR'}],
 candidateProfiles:[{id:'profile',opportunityId:oid,studentId:'student',campaignId:'camp',employerId:'emp',projectionVersion:3,consentUpdatedAt:'2026-11-20'}]
});
test('coherent snapshot passes; analyzer never mutates input or outputs record identities',()=>{
 const data=fixture(),before=JSON.stringify(data);const report=reconcileRecruitment(data);
 assert.equal(report.blocking,0);assert.equal(report.writes,0);assert.equal(JSON.stringify(data),before);
 assert.equal(report.decision,'NO_BLOCKERS_DETECTED_IN_PROVIDED_SNAPSHOT');
 assert.equal(JSON.stringify(report).includes(oid),false);
});
test('legacy activation ledger, forged grant, embedded names and missing offer are identified',()=>{
 const d=fixture();delete d.calls[0].activatedStudentsCount;
 d.students[0].campaignConsents.camp.opportunityId='forged';
 d.campaigns[0].candidateOpportunities=[{studentName:'private-name'}];
 d.opportunities[0].studentName='private-name';d.offers=[];
 const r=reconcileRecruitment(d);
 for(const k of ['ACTIVATION_LEDGER_MISSING_OR_MISMATCH','APPROVED_GRANT_REQUIRES_RECONCILIATION','EMBEDDED_CANDIDATE_RECORDS','LEGACY_CANDIDATE_NAME','OFFER_LINK_OR_STATUS_MISMATCH','PROJECTION_REQUIRES_REBIND'])assert.equal(r.findings[k],1);
 assert.equal(r.decision,'RECONCILIATION_REQUIRED');assert.equal(JSON.stringify(r).includes('private-name'),false);
});
test('revoked stale snapshot is classified separately; incomplete or duplicated input fails closed',()=>{
 const d=fixture();d.students[0].campaignConsents.camp.status='denied';
 assert.equal(reconcileRecruitment(d).findings.STALE_PROJECTION_RETAINED,1);
 assert.equal(reconcileRecruitment(d).blocking,0);
 const incomplete=fixture();delete incomplete.calls;assert.throws(()=>reconcileRecruitment(incomplete),/Missing collection/);
 const dup=fixture();dup.calls.push(dup.calls[0]);assert.throws(()=>reconcileRecruitment(dup),/duplicate record/);
});
