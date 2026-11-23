import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateRelationships} from '../scripts/validate-import-relationships.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const response='SYNTHETIC ANSWER ONLY — no real student data';
function fixture(){
 const oid=sha('call:stu'),aid=sha('assessment:'+oid),feeId=sha('success-fee:'+oid);
 const hash=sha(response);
 const records=[
  ['employers/emp',{id:'emp'}],
  ['institutions/inst',{id:'inst'}],
  ['students/stu',{id:'stu',institutionId:'inst',campaignConsents:{}}],
  ['campaigns/camp',{id:'camp',employerId:'emp',targetedInstitutionIds:['inst'],callsSent:[{id:'call',institutionId:'inst'}],candidateOpportunities:[]}],
  ['calls/call',{id:'call',campaignId:'camp',employerId:'emp',institutionId:'inst',activatedStudentsCount:1,offeredCandidatesCount:1}],
  ['opportunities/'+oid,{id:oid,callId:'call',campaignId:'camp',studentId:'stu',employerId:'emp',institutionId:'inst',studentName:'Candidate',stage:'joined',joinedSalaryLPA:8,offerRecordId:'offer',assessmentSubmissionId:aid,assessmentTemplateId:'engineering',assessmentEvidenceHash:hash}],
  ['offers/offer',{id:'offer',opportunityId:oid,campaignId:'camp',studentId:'stu',employerId:'emp',institutionId:'inst',status:'joined',currency:'INR',salaryLPA:8}],
  ['assessmentSubmissions/'+aid,{id:aid,opportunityId:oid,campaignId:'camp',studentId:'stu',employerId:'emp',submittedBy:'stu',templateId:'engineering',response,evidenceHash:hash}],
  ['successFees/'+feeId,{id:feeId,opportunityId:oid,campaignId:'camp',studentId:'stu',employerId:'emp',compensationMinor:80000000,feeRateBps:500,feeAmountMinor:4000000,status:'earned',currency:'INR'}]
 ];
 return {oid,aid,feeId,records:records.map(([document_path,payload])=>({document_path,payload}))};
}
const find=(data,root)=>data.records.find(r=>r.document_path.startsWith(root+'/'));
const run=d=>validateRelationships(d.records);

test('complete synthetic joined placement has linked assessment and exactly one earned fee',()=>{
 const d=fixture(),r=run(d);
 assert.equal(r.blocking,0,JSON.stringify(r.findings));
 assert.deepEqual(r.findings,{});
 assert.equal(JSON.stringify(r).includes(response),false);
 assert.equal(JSON.stringify(r).includes(d.oid),false);
});

test('missing or misbound assessment evidence cannot silently pass migration',()=>{
 for(const change of [
  d=>d.records=d.records.filter(r=>!r.document_path.startsWith('assessmentSubmissions/')),
  d=>find(d,'assessmentSubmissions').payload.employerId='wrong',
  d=>find(d,'assessmentSubmissions').payload.studentId='other',
  d=>find(d,'assessmentSubmissions').payload.response='private modified answer',
  d=>find(d,'assessmentSubmissions').payload.evidenceHash='forged',
  d=>find(d,'opportunities').payload.assessmentEvidenceHash='forged',
  d=>find(d,'assessmentSubmissions').payload.templateId='wrong',
  d=>find(d,'assessmentSubmissions').payload.submittedBy='employer'
 ]){
  const d=fixture();change(d);const r=run(d);
  assert.ok(r.findings.ASSESSMENT_SUBMISSION_LINK_MISMATCH||r.findings.ASSESSMENT_SUBMISSION_MISSING,JSON.stringify(r.findings));
  assert.ok(r.blocking>0);
  assert.equal(JSON.stringify(r).includes('private modified answer'),false);
 }
});

test('orphan, forged, incomplete or mispriced joined success fees fail closed',()=>{
 for(const change of [
  d=>d.records=d.records.filter(r=>!r.document_path.startsWith('successFees/')),
  d=>find(d,'successFees').payload.employerId='wrong',
  d=>find(d,'successFees').payload.campaignId='wrong',
  d=>find(d,'successFees').payload.currency='USD',
  d=>find(d,'successFees').payload.feeRateBps=2000,
  d=>find(d,'successFees').payload.feeAmountMinor=3999999,
  d=>find(d,'successFees').payload.compensationMinor=90000000,
  d=>find(d,'successFees').payload.status='paid-without-authority',
  d=>find(d,'successFees').payload.opportunityId='orphan',
  d=>find(d,'opportunities').payload.joinedSalaryLPA=9,
  d=>find(d,'successFees').payload.feeAmountMinor=NaN
 ]){
  const d=fixture();change(d);const r=run(d);
  assert.ok(r.findings.SUCCESS_FEE_LINK_MISMATCH||r.findings.SUCCESS_FEE_AMOUNT_MISMATCH||r.findings.JOINED_SUCCESS_FEE_MISSING,JSON.stringify(r.findings));
  assert.ok(r.blocking>0);
 }
});

test('success-fee paise arithmetic matches production floor rounding, never nearest-unit rounding',()=>{
 const d=fixture();
 find(d,'opportunities').payload.joinedSalaryLPA=0.0000011;
 find(d,'offers').payload.salaryLPA=0.0000011;
 const fee=find(d,'successFees').payload;
 fee.compensationMinor=11;fee.feeAmountMinor=0;
 assert.equal(run(d).blocking,0);
 fee.feeAmountMinor=1;
 assert.equal(run(d).findings.SUCCESS_FEE_AMOUNT_MISMATCH,1);
});

test('fees are not invented for recruitment paths that have not reached joined stage',()=>{
 const d=fixture();
 find(d,'opportunities').payload.stage='accepted';
 find(d,'offers').payload.status='accepted';
 d.records=d.records.filter(r=>!r.document_path.startsWith('successFees/'));
 const result=run(d);
 assert.equal(result.findings.JOINED_SUCCESS_FEE_MISSING,undefined);
 assert.equal(result.findings.SUCCESS_FEE_LINK_MISMATCH,undefined);
 assert.equal(result.findings.SUCCESS_FEE_AMOUNT_MISMATCH,undefined);
 assert.equal(result.blocking,0,JSON.stringify(result.findings));
});
