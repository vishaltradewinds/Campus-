import {createHash} from 'node:crypto';
import {requiredCollections,reconcileRecruitment} from './reconcile-recruitment.mjs';
export function validateRelationships(records){
 const indexes=new Map();
 for(const {document_path,payload} of records){
  const [col,id]=document_path.split('/');
  if(!indexes.has(col))indexes.set(col,new Map());
  indexes.get(col).set(id,payload);
 }
 const get=(col,id)=>typeof id==='string'&&id.length>0?indexes.get(col)?.get(id):undefined;
 const findings={};
 const flag=k=>findings[k]=(findings[k]||0)+1;
 for(const [id,s] of indexes.get('students')||[]){
  // Independent candidates may not have an institutional affiliation.
  if(s.institutionId&& !get('institutions',s.institutionId))flag('STUDENT_INSTITUTION_MISSING');
 }
 for(const [,c] of indexes.get('campaigns')||[]){
  if(!get('employers',c.employerId))flag('CAMPAIGN_EMPLOYER_MISSING');
  if(!Array.isArray(c.targetedInstitutionIds)||c.targetedInstitutionIds.some(id=>!get('institutions',id)))flag('CAMPAIGN_TARGET_MISSING');
 }
 for(const [,c] of indexes.get('calls')||[]){
  if(!get('institutions',c.institutionId)||!get('employers',c.employerId))flag('CALL_STAKEHOLDER_MISSING');
 }
 for(const [id,s] of indexes.get('assessmentSubmissions')||[]){
  const opportunity=get('opportunities',s.opportunityId);
  // Assessment responses are private; only opaque finding counts leave this validator.
  const submittedHash=typeof s.response==='string'?createHash('sha256').update(s.response,'utf8').digest('hex'):null;
  if(!opportunity||s.id!==id||opportunity.assessmentSubmissionId!==id||
     s.campaignId!==opportunity.campaignId||s.employerId!==opportunity.employerId||
     s.studentId!==opportunity.studentId||s.submittedBy!==opportunity.studentId||
     s.templateId!==opportunity.assessmentTemplateId||
     !submittedHash||s.evidenceHash!==submittedHash||
     opportunity.assessmentEvidenceHash!==submittedHash)flag('ASSESSMENT_SUBMISSION_LINK_MISMATCH');
 }
 for(const [id,o] of indexes.get('opportunities')||[]){
  if(o.assessmentSubmissionId&&!get('assessmentSubmissions',o.assessmentSubmissionId))flag('ASSESSMENT_SUBMISSION_MISSING');
  if(o.stage==='joined'){
   const expectedId=createHash('sha256').update('success-fee:'+id,'utf8').digest('hex');
   if(!get('successFees',expectedId))flag('JOINED_SUCCESS_FEE_MISSING');
  }
 }
 for(const [id,f] of indexes.get('successFees')||[]){
  const opportunity=get('opportunities',f.opportunityId);
  const canonicalId=typeof f.opportunityId==='string'?createHash('sha256').update('success-fee:'+f.opportunityId,'utf8').digest('hex'):null;
  if(!opportunity||opportunity.stage!=='joined'||f.id!==id||id!==canonicalId||
     f.campaignId!==opportunity.campaignId||f.employerId!==opportunity.employerId||
     f.studentId!==opportunity.studentId||f.status!=='earned'||f.currency!=='INR')
    flag('SUCCESS_FEE_LINK_MISMATCH');
  const compensation=opportunity&&typeof opportunity.joinedSalaryLPA==='number'&&
     Number.isFinite(opportunity.joinedSalaryLPA)&&opportunity.joinedSalaryLPA>=0?
     Math.round(opportunity.joinedSalaryLPA*10000000):NaN;
  // Mirror commercial quoteSuccessFee: integer minor-units, truncation toward zero.
  const expectedFee=Number.isSafeInteger(compensation)?Number((BigInt(compensation)*500n)/10000n):NaN;
  if(!Number.isSafeInteger(compensation)||!Number.isSafeInteger(f.compensationMinor)||
     f.compensationMinor!==compensation||f.feeRateBps!==500||
     !Number.isSafeInteger(f.feeAmountMinor)||f.feeAmountMinor!==expectedFee)
    flag('SUCCESS_FEE_AMOUNT_MISMATCH');
 }
 const dataset=Object.fromEntries(requiredCollections.map(col=>[col,[...(indexes.get(col)||[])].map(([id,payload])=>{
  if(payload.id!==id)flag('RECRUITMENT_PATH_ID_MISMATCH');
  return {...payload,id};
 })]));
 let recruitmentBlocking=0;
 try{recruitmentBlocking=reconcileRecruitment(dataset).blocking;}catch{flag('INVALID_RECRUITMENT_STRUCTURE');}
 return {findings,recruitmentBlocking,blocking:Object.values(findings).reduce((a,b)=>a+b,0)+recruitmentBlocking};
}
