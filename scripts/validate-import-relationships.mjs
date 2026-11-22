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
 const dataset=Object.fromEntries(requiredCollections.map(col=>[col,[...(indexes.get(col)||[])].map(([id,payload])=>{
  if(payload.id!==id)flag('RECRUITMENT_PATH_ID_MISMATCH');
  return {...payload,id};
 })]));
 let recruitmentBlocking=0;
 try{recruitmentBlocking=reconcileRecruitment(dataset).blocking;}catch{flag('INVALID_RECRUITMENT_STRUCTURE');}
 return {findings,recruitmentBlocking,blocking:Object.values(findings).reduce((a,b)=>a+b,0)+recruitmentBlocking};
}
