import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconcileRecruitment} from '../scripts/reconcile-recruitment.mjs';
const oid=createHash('sha256').update('call:student').digest('hex');
const fixture=()=>({
 students:[{id:'student',institutionId:'inst',campaignConsents:{camp:{status:'approved',opportunityId:oid,employerId:'emp',updatedAt:'2026-11-20'}}}],
 campaigns:[{id:'camp',employerId:'emp',targetedInstitutionIds:['inst'],callsSent:[{id:'call',institutionId:'inst'}],candidateOpportunities:[]}],
 calls:[{id:'call',campaignId:'camp',institutionId:'inst',employerId:'emp',activatedStudentsCount:1,offeredCandidatesCount:1}],
 opportunities:[{id:oid,callId:'call',studentId:'student',campaignId:'camp',employerId:'emp',institutionId:'inst',studentName:'Candidate',stage:'joined',offerRecordId:'offer',joinedSalaryLPA:10}],
 offers:[{id:'offer',opportunityId:oid,studentId:'student',campaignId:'camp',employerId:'emp',institutionId:'inst',status:'joined',currency:'INR',salaryLPA:10}],
 candidateProfiles:[{id:createHash('sha256').update('emp:camp:student').digest('hex'),institutionId:'inst',consentStatus:'approved',opportunityId:oid,studentId:'student',campaignId:'camp',employerId:'emp',projectionVersion:3,consentScope:{academicDataShared:false,skillBenchmarksShared:false,projectReposShared:false,contactInfoShared:false},consentUpdatedAt:'2026-11-20'}]
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

test('current projection with forged scope metadata or unshared fields blocks reconciliation without leaking PII',()=>{
 const d=fixture(),p=d.candidateProfiles[0];p.consentScope.contactInfoShared=true;
 Object.assign(p,{email:'private@example.test',program:'private-program',verifiedSkills:[{}],projects:[],verifiedEvidence:[{claimType:'skill',claimValue:'private-value'}]});
 const r=reconcileRecruitment(d);
 for(const k of ['CURRENT_PROJECTION_SCOPE_MISMATCH','UNSCOPED_ACADEMIC_PAYLOAD','UNSCOPED_SKILL_PAYLOAD','UNSCOPED_PROJECT_PAYLOAD','UNSCOPED_CONTACT_PAYLOAD','UNSCOPED_EVIDENCE_PAYLOAD'])assert.equal(r.findings[k],1);
 assert.equal(r.blocking,6);assert.equal(JSON.stringify(r).includes('private'),false);
});
test('scoped evidence passes but pre-correction education evidence is blocked',()=>{
 const d=fixture(),s=d.students[0],g=s.campaignConsents.camp,p=d.candidateProfiles[0];
 g.academicDataShared=true;p.consentScope.academicDataShared=true;
 p.program='BTech';p.verifiedEvidence=[{claimType:'education',reviewedAt:'2026-11-19'}];
 assert.equal(reconcileRecruitment(d).blocking,0);
 s.academicCorrectedAt='2026-11-20';p.academicCorrectedAt=s.academicCorrectedAt;s.institutionVerificationStatus='verified';
 assert.equal(reconcileRecruitment(d).findings.UNSCOPED_EVIDENCE_PAYLOAD,1);
 s.institutionVerificationStatus='pending';
 assert.equal(reconcileRecruitment(d).findings.UNSCOPED_ACADEMIC_PAYLOAD,1);
});

test('reverse offer checks flag orphan records, incorrect lifecycle and inconsistent compensation',()=>{
 const d=fixture();
 d.offers.push({...d.offers[0],id:'orphan',salaryLPA:-1});
 d.offers[0].status='issued';
 d.opportunities[0].joinedSalaryLPA=99;
 const r=reconcileRecruitment(d);
 for(const k of ['ORPHAN_OR_MISBOUND_OFFER','OFFER_REVERSE_LIFECYCLE_MISMATCH','INVALID_AUTHORITATIVE_OFFER_COMPENSATION','JOINED_COMPENSATION_MISMATCH'])assert.ok(r.findings[k]>0,k);
 const rejected=fixture();rejected.opportunities[0].stage='rejected';rejected.offers[0].status='accepted';
 assert.equal(reconcileRecruitment(rejected).blocking,0);
});
test('current projection rejects unknown fields, misbound identity and legacy raw projects',()=>{
 const d=fixture(),p=d.candidateProfiles[0];p.id='noncanonical';p.institutionId='foreign';p.phone='private-number';
 d.students[0].campaignConsents.camp.projectReposShared=true;p.consentScope.projectReposShared=true;p.projects=[{title:'private-project'}];
 const r=reconcileRecruitment(d);
 for(const k of ['UNEXPECTED_CURRENT_PROJECTION_FIELDS','CURRENT_PROJECTION_IDENTITY_MISMATCH','LEGACY_PROJECT_PAYLOAD'])assert.equal(r.findings[k],1);
 assert.equal(JSON.stringify(r).includes('private'),false);
});
