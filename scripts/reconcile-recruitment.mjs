import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const requiredCollections=['students','campaigns','calls','opportunities','offers','candidateProfiles'];
const hash=s=>createHash('sha256').update(s).digest('hex');
/** Read-only review of an already-authorized, normalized offline snapshot. No network, mutations or PII in output. */
export function reconcileRecruitment(dataset){
 const indexes={};
 for(const col of requiredCollections){
   if(!Array.isArray(dataset?.[col]))throw new Error('Missing collection: '+col);
   indexes[col]=new Map();
   for(const doc of dataset[col]){
     if(!doc||typeof doc.id!=='string'||!doc.id||indexes[col].has(doc.id))throw new Error('Missing or duplicate record identifier in '+col);
     indexes[col].set(doc.id,doc);
   }
 }
 const findings={};
 const flag=code=>findings[code]=(findings[code]||0)+1;
 const {students,campaigns,calls,opportunities,offers,candidateProfiles}=indexes;
 const counts=new Map();
 for(const o of opportunities.values()){
   const call=calls.get(o.callId),campaign=campaigns.get(o.campaignId),student=students.get(o.studentId);
   if(!call||!campaign||!student||o.employerId!==campaign.employerId||o.institutionId!==student.institutionId||call.campaignId!==o.campaignId||call.institutionId!==o.institutionId||call.employerId!==o.employerId){
     flag('OPPORTUNITY_LINK_MISMATCH');continue;
   }
   counts.set(call.id,(counts.get(call.id)||0)+1);
   if(o.id!==hash(call.id+':'+o.studentId))flag('NONCANONICAL_OPPORTUNITY_ID');
   if(o.studentName&&o.studentName!=='Candidate')flag('LEGACY_CANDIDATE_NAME');
   if(['offered','accepted','joined'].includes(o.stage)){
     const offer=offers.get(o.offerRecordId);
     const expected=o.stage==='offered'?'issued':o.stage;
     if(!offer||offer.opportunityId!==o.id||offer.studentId!==o.studentId||offer.employerId!==o.employerId||offer.campaignId!==o.campaignId||offer.institutionId!==o.institutionId||offer.status!==expected||offer.currency!=='INR')flag('OFFER_LINK_OR_STATUS_MISMATCH');
   }
 }
 for(const call of calls.values()){
   const campaign=campaigns.get(call.campaignId);
   if(!campaign||call.employerId!==campaign.employerId||!campaign.targetedInstitutionIds?.includes(call.institutionId)||!campaign.callsSent?.some(c=>c.id===call.id&&c.institutionId===call.institutionId))flag('CALL_CAMPAIGN_LINK_MISMATCH');
   const observed=counts.get(call.id)||0;
   if(!Number.isSafeInteger(call.activatedStudentsCount)||call.activatedStudentsCount!==observed)flag('ACTIVATION_LEDGER_MISSING_OR_MISMATCH');
   if(observed>0&&(!Number.isSafeInteger(call.offeredCandidatesCount)||observed>call.offeredCandidatesCount))flag('ACTIVATION_LIMIT_EXCEEDED');
 }
 for(const campaign of campaigns.values()){
   if(campaign.candidateOpportunities?.length)flag('EMBEDDED_CANDIDATE_RECORDS');
   const records=[...calls.values()].filter(c=>c.campaignId===campaign.id);
   if(new Set(records.map(c=>c.institutionId)).size!==records.length)flag('DUPLICATE_INSTITUTION_TARGETS');
 }
 for(const student of students.values()){
   for(const [cid,grant] of Object.entries(student.campaignConsents||{})){
     if(grant?.status!=='approved')continue;
     const o=opportunities.get(grant.opportunityId);
     if(!o||o.studentId!==student.id||o.campaignId!==cid||o.employerId!==grant.employerId||!grant.updatedAt)flag('APPROVED_GRANT_REQUIRES_RECONCILIATION');
   }
 }
 for(const profile of candidateProfiles.values()){
   const student=students.get(profile.studentId),grant=student?.campaignConsents?.[profile.campaignId],o=opportunities.get(profile.opportunityId);
   if(profile.projectionVersion!==3||!o||o.studentId!==profile.studentId||o.campaignId!==profile.campaignId||o.employerId!==profile.employerId||profile.opportunityId!==grant?.opportunityId)flag('PROJECTION_REQUIRES_REBIND');
   // Revoked or outdated snapshots may remain retained but must be unreadable.
   if(grant?.status!=='approved'||grant.updatedAt!==profile.consentUpdatedAt||(profile.academicCorrectedAt||'')!==(student?.academicCorrectedAt||''))flag('STALE_PROJECTION_RETAINED');
 }
 const blocking=Object.entries(findings).filter(([k])=>k!=='STALE_PROJECTION_RETAINED').reduce((a,[,v])=>a+v,0);
 return {mode:'offline-read-only',scope:'six provided collections; completeness and origin must be independently established',records:Object.fromEntries(requiredCollections.map(c=>[c,indexes[c].size])),findings,blocking,decision:blocking?'RECONCILIATION_REQUIRED':'NO_BLOCKERS_DETECTED_IN_PROVIDED_SNAPSHOT',writes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw new Error('Usage: node scripts/reconcile-recruitment.mjs <normalized-snapshot.json>');
 const report=reconcileRecruitment(JSON.parse(await readFile(process.argv[2],'utf8')));
 console.log(JSON.stringify(report,null,2));
 if(report.blocking)process.exitCode=2;
}
