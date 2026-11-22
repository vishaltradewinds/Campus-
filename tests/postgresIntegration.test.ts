import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { gatedPostgresStore } from '../server/postgresRecordStore';
assert.equal(process.env.NODE_ENV,'test');
assert.equal(process.env.NEXUSTALENT_DATASTORE,'postgres');
assert.equal(process.env.NEXUSTALENT_PG_INTEGRATION,'1');
const connectionString=process.env.NEXUSTALENT_TEST_DATABASE_URL!;
const target=new URL(connectionString);
assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/nexustalent_ci');assert.equal(target.username,'nexustalent_runtime_ci');
const backend=await import('../server/trustedBackend');
const pool=new pg.Pool({connectionString,max:1});
const store=gatedPostgresStore()!;
test.after(async()=>{await backend.closePostgresIntegrationStore();await store.close();await pool.end();});
test('real PostgreSQL: recruitment transaction, idempotency and role denial',async()=>{
 assert.equal(await backend.checkTrustedRecruitmentRead('ci-employer'),true);
 assert.equal(await backend.checkTrustedRecruitmentRead('missing'),false);
 assert.deepEqual(await backend.readOwnAccount('ci-employer'),{uid:'ci-employer',role:'employer',name:'Synthetic employer',email:'employer@example.test'});
 assert.equal(await backend.readOwnAccount('missing'),null);
 const payload={requirement:{id:'ci-requirement',employerId:'ci-employer',role:'Analyst',vacancies:1,salaryMinLPA:8,salaryMaxLPA:12},campaign:{id:'ci-campaign',requirementId:'ci-requirement',employerId:'ci-employer',funnel:{joined:100},targetedInstitutionIds:['forged']}};
 const input={actorUid:'ci-employer',requestId:'ci-create-0001',action:'CREATE_REQUIREMENT_CAMPAIGN' as const,payload};
 const first=await backend.executeRecruitmentTransition(input);assert.equal(first.replayed,false);
 const replay=await backend.executeRecruitmentTransition(input);assert.equal(replay.replayed,true);assert.equal(replay.auditEventId,first.auditEventId);
 const rows=await pool.query("SELECT document_path,payload FROM nexustalent.records WHERE document_path=ANY($1)",[['requirements/ci-requirement','campaigns/ci-campaign','auditEvents/'+first.auditEventId]]);
 assert.equal(rows.rowCount,3);assert.equal(rows.rows.find(r=>r.document_path==='campaigns/ci-campaign').payload.funnel.joined,0);
 await assert.rejects(()=>backend.executeRecruitmentTransition({...input,actorUid:'ci-student',requestId:'ci-forged-0001'}),/not authorized/);
 const current=await pool.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE collection='auditEvents'");assert.equal(current.rows[0].n,1);
});
test('real PostgreSQL: failed audit insert rolls back the preceding change',async()=>{
 const t=await store.begin();
 await assert.rejects(()=>store.commit(t,[{name:'students/ci-student',data:{id:'ci-student',name:'Should roll back'}},{name:'auditEvents/ci-conflict',data:{ok:true}},{name:'auditEvents/ci-conflict',data:{ok:true}}]),/unavailable/);
 const r=await pool.query("SELECT payload FROM nexustalent.records WHERE document_path='students/ci-student'");
 assert.equal(r.rows[0].payload.name,'Synthetic student');
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE document_path='auditEvents/ci-conflict'")).rows[0].n,0);
});
test('real PostgreSQL: concurrent retry cannot duplicate a recruitment or audit record',async()=>{
 const input={actorUid:'ci-employer',requestId:'ci-concurrent-0001',action:'CREATE_REQUIREMENT_CAMPAIGN' as const,payload:{requirement:{id:'ci-concurrent-req',employerId:'ci-employer',role:'Analyst',vacancies:1,salaryMinLPA:8,salaryMaxLPA:12},campaign:{id:'ci-concurrent-campaign',requirementId:'ci-concurrent-req',employerId:'ci-employer'}}};
 const results=await Promise.allSettled([backend.executeRecruitmentTransition(input),backend.executeRecruitmentTransition(input)]);
 assert.equal(results.filter(x=>x.status==='fulfilled'&&!x.value.replayed).length,1);
 for(const result of results)if(result.status==='rejected')assert.ok(result.reason instanceof backend.DatastoreUnavailable);
 const replay=await backend.executeRecruitmentTransition(input);assert.equal(replay.replayed,true);
 const rows=await pool.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE document_path=ANY($1)",[['requirements/ci-concurrent-req','campaigns/ci-concurrent-campaign','auditEvents/'+replay.auditEventId]]);
 assert.equal(rows.rows[0].n,3);
});
test('real PostgreSQL: all three stakeholder registrations are atomic, role-limited and replay-safe',async()=>{
 const employer={role:'employer',name:'New recruiter',companyName:'Synthetic new employer',industry:'Test',headquarters:'',businessRegNumber:'',websiteUrl:''};
 const institution={role:'institution',name:'Synthetic new institution',code:'CI',type:'Autonomous College',state:'Test',city:'Test',accreditation:'',placementOfficerName:'Test',phone:'',totalStudentSupply:0};
 const student={role:'student',name:'New candidate',registrationType:'independent',institutionId:'',customCollegeName:'Test college',state:'Test',program:'Test',branch:'Test',graduationYear:2027,cgpa:8,rollNumber:'',minSalaryLPA:0};
 for(const [uid,profile,root] of [['ci-new-employer',employer,'employers'],['ci-new-institution',institution,'institutions'],['ci-new-student',student,'students']] as const){
  const email=uid+'@example.test';
  assert.deepEqual(await backend.registerOwnStakeholder(uid,email,profile),{replayed:false});
  assert.deepEqual(await backend.registerOwnStakeholder(uid,email,profile),{replayed:true});
  const rows=await pool.query("SELECT document_path,payload FROM nexustalent.records WHERE document_path=ANY($1)",[['users/'+uid,root+'/'+uid]]);
  assert.equal(rows.rowCount,2);
  assert.equal(rows.rows.find(r=>r.document_path==='users/'+uid).payload.email,email);
  assert.equal(rows.rows.find(r=>r.document_path===root+'/'+uid).payload.id,uid);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE collection='auditEvents' AND payload->>'action'='REGISTER_STAKEHOLDER' AND payload->>'actorUid'=$1",[uid])).rows[0].n,1);
 }
 await assert.rejects(()=>backend.registerOwnStakeholder('ci-new-student','ci-new-student@example.test',employer),/No record was overwritten/);
});
test('real PostgreSQL: registration directory and own profile preserve scope',async()=>{
 const t=await store.begin();
 await store.commit(t,[{name:'institutions/ci-verified-campus',data:{id:'ci-verified-campus',name:'CI Verified Campus',code:'VC',empanelmentStatus:'empanelled',privateField:'not exposed'}},{name:'institutions/ci-pending-campus',data:{id:'ci-pending-campus',name:'CI Pending Campus',code:'PC',empanelmentStatus:'pending_empanelment'}}]);
 assert.deepEqual(await backend.listRegistrationInstitutions(),[{id:'ci-verified-campus',name:'CI Verified Campus',code:'VC'}]);
 const own=await backend.readStakeholderWorkspace('ci-student');
 assert.equal(own.role,'student');assert.equal(own.profile?.id,'ci-student');
 await assert.rejects(()=>backend.readStakeholderWorkspace('unregistered'),/Workspace access denied/);
});
test('real PostgreSQL: dashboard record filters match role, including array membership',async()=>{
 const t=await store.begin();
 await store.commit(t,[{name:'users/ci-inst-scope',data:{uid:'ci-inst-scope',role:'institution'}},{name:'institutions/ci-inst-scope',data:{id:'ci-inst-scope',empanelmentStatus:'pending_empanelment'}},{name:'students/ci-scope-student',data:{id:'ci-scope-student',institutionId:'ci-inst-scope'}},{name:'campaigns/ci-scope-campaign',data:{id:'ci-scope-campaign',employerId:'ci-employer',targetedInstitutionIds:['ci-inst-scope']}},{name:'opportunities/ci-scope-opportunity',data:{id:'ci-scope-opportunity',employerId:'ci-employer',institutionId:'ci-inst-scope',studentId:'ci-scope-student'}},{name:'opportunities/ci-other-opportunity',data:{id:'ci-other-opportunity',employerId:'other',institutionId:'other',studentId:'other'}}]);
 const view=await backend.readStakeholderWorkspace('ci-inst-scope');
 assert.deepEqual(view.collections.students.map(r=>r.id),['ci-scope-student']);
 assert.deepEqual(view.collections.campaigns.map(r=>r.id),['ci-scope-campaign']);
 assert.deepEqual(view.collections.opportunities.map(r=>r.id),['ci-scope-opportunity']);
 assert.deepEqual(view.collections.users,[]);
 const emp=await backend.readStakeholderWorkspace('ci-employer');
 assert.ok(emp.collections.opportunities.some(r=>r.id==='ci-scope-opportunity'));
 assert.ok(!emp.collections.opportunities.some(r=>r.id==='ci-other-opportunity'));
 assert.deepEqual(emp.collections.students,[]);
});
test('real PostgreSQL: career evidence reads are restricted to student and claimed administrator',async()=>{
 const t=await store.begin();
 await store.commit(t,[{name:'users/ci-evidence-admin',data:{uid:'ci-evidence-admin',role:'super_admin'}},{name:'careerEvidence/ci-owned-evidence',data:{id:'ci-owned-evidence',studentId:'ci-student',status:'verified'}},{name:'careerEvidence/ci-unrelated-evidence',data:{id:'ci-unrelated-evidence',studentId:'unrelated',status:'submitted'}}]);
 assert.deepEqual((await backend.readCareerEvidenceQueue('ci-student')).map(r=>r.id),['ci-owned-evidence']);
 await assert.rejects(()=>backend.readCareerEvidenceQueue('ci-employer'),/Workspace access denied/);
 await assert.rejects(()=>backend.readCareerEvidenceQueue('ci-evidence-admin'),/Workspace access denied/);
 assert.deepEqual((await backend.readCareerEvidenceQueue('ci-evidence-admin',true)).map(r=>r.id),['ci-unrelated-evidence']);
});
test('real PostgreSQL: scoped employer SEND_CALLS transaction and replay preserve campaign integrity',async()=>{
 const input={actorUid:'ci-employer',requestId:'ci-send-scoped-01',action:'SEND_CALLS' as const,payload:{campaignId:'ci-campaign',calls:[{id:'ci-call-scoped',campaignId:'ci-campaign',employerId:'ci-employer',institutionId:'ci-verified-campus',vacanciesRequested:1,deadline:'2099-01-01'}]}};
 const result=await backend.executeRecruitmentTransition(input);assert.equal(result.replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(input)).replayed,true);
 const rows=await pool.query("SELECT document_path,payload FROM nexustalent.records WHERE document_path=ANY($1)",[['campaigns/ci-campaign','calls/ci-call-scoped','auditEvents/'+result.auditEventId]]);
 assert.equal(rows.rowCount,3);
 const campaign=rows.rows.find(r=>r.document_path==='campaigns/ci-campaign').payload;
 assert.equal(campaign.funnel.institutionsInvited,1);assert.equal(campaign.funnel.joined,0);
 assert.equal(rows.rows.find(r=>r.document_path==='calls/ci-call-scoped').payload.status,'pending');
 await assert.rejects(()=>backend.executeRecruitmentTransition({...input,actorUid:'ci-student',requestId:'ci-send-denied-01'}),/not authorized/);
});

test('real PostgreSQL: institutional response and activation use owned call scope',async()=>{
 const t=await store.begin();
 await store.commit(t,[{name:'users/ci-verified-campus',data:{uid:'ci-verified-campus',role:'institution'}},{name:'students/ci-activation-stu',data:{id:'ci-activation-stu',institutionId:'ci-verified-campus',institutionVerificationStatus:'verified'}},{name:'students/ci-activation-other',data:{id:'ci-activation-other',institutionId:'foreign',institutionVerificationStatus:'verified'}}]);
 const response={actorUid:'ci-verified-campus',requestId:'ci-respond-0001',action:'RESPOND_CALL' as const,payload:{callId:'ci-call-scoped',status:'accepted',offeredCandidatesCount:1}};
 assert.equal((await backend.executeRecruitmentTransition(response)).replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(response)).replayed,true);
 const activation={actorUid:'ci-verified-campus',requestId:'ci-activate-0001',action:'ACTIVATE_STUDENTS' as const,payload:{callId:'ci-call-scoped',studentIds:['ci-activation-stu']}};
 await assert.rejects(()=>backend.executeRecruitmentTransition({...activation,requestId:'ci-activate-foreign',payload:{...activation.payload,studentIds:['ci-activation-other']}}));
 const result=await backend.executeRecruitmentTransition(activation);assert.equal(result.replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(activation)).replayed,true);
 const rows=await pool.query("SELECT document_path,payload FROM nexustalent.records WHERE document_path=ANY($1)",[[ 'calls/ci-call-scoped','campaigns/ci-campaign','opportunities/'+result.ids[0]]]);
 assert.equal(rows.rowCount,3);
 assert.equal(rows.rows.find(r=>r.document_path==='calls/ci-call-scoped').payload.activatedStudentsCount,1);
 assert.equal(rows.rows.find(r=>r.document_path==='campaigns/ci-campaign').payload.funnel.studentsInvited,1);
 assert.equal(rows.rows.find(r=>r.document_path.startsWith('opportunities/')).payload.studentName,'Candidate');
});

test('real PostgreSQL: student consent grant, scope change, application and revocation',async()=>{
 const t=await store.begin();
 await store.commit(t,[{name:'users/ci-activation-stu',data:{uid:'ci-activation-stu',role:'student'}}]);
 const actorUid='ci-activation-stu',campaignId='ci-campaign';
 const base={actorUid,requestId:'ci-consent-global',action:'GLOBAL_CONSENT' as const,payload:{approved:true,campaignIds:[campaignId]}};
 assert.equal((await backend.executeRecruitmentTransition(base)).replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(base)).replayed,true);
 const student=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+actorUid])).rows[0].payload;
 const grant=student.campaignConsents[campaignId];assert.equal(grant.status,'approved');assert.equal(grant.contactInfoShared,false);
 await backend.executeRecruitmentTransition({actorUid,requestId:'ci-consent-scope',action:'UPDATE_CONSENT_SCOPE',payload:{campaignId,scopeKey:'academicDataShared',value:true}});
 await backend.executeRecruitmentTransition({actorUid,requestId:'ci-consent-submit',action:'SUBMIT_CONSENT',payload:{opportunityId:grant.opportunityId,consented:true}});
 const opportunity=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+grant.opportunityId])).rows[0].payload;
 assert.equal(opportunity.stage,'assessment_pending');
 await backend.executeRecruitmentTransition({...base,requestId:'ci-consent-revoke',payload:{approved:false,campaignIds:[campaignId]}});
 await assert.rejects(()=>backend.executeRecruitmentTransition({actorUid,requestId:'ci-consent-denied',action:'SUBMIT_CONSENT',payload:{opportunityId:grant.opportunityId,consented:true}}),/consent is required/);
});

test('real PostgreSQL: assessment submission uses exact student opportunity and immutable evidence',async()=>{
 const actorUid='ci-activation-stu';
 const student=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+actorUid])).rows[0].payload;
 const opportunityId=student.campaignConsents['ci-campaign'].opportunityId;
 const input={actorUid,requestId:'ci-assess-scoped-01',action:'ADVANCE_CANDIDATE_STAGE' as const,payload:{opportunityId,nextStage:'assessment_completed',meta:{assessmentResponse:'Synthetic assessment',assessmentTemplateId:'ci-template',shareAssessmentResponse:false,interviewFeedback:'forged'}}};
 await assert.rejects(()=>backend.executeRecruitmentTransition({...input,actorUid:'ci-student',requestId:'ci-assess-foreign-01'}));
 const first=await backend.executeRecruitmentTransition(input);assert.equal(first.replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(input)).replayed,true);
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+opportunityId])).rows[0].payload;
 assert.equal(o.stage,'assessment_completed');assert.equal(o.assessmentScore,null);assert.equal(o.interviewFeedback,undefined);
 const a=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['assessmentSubmissions/'+o.assessmentSubmissionId])).rows[0].payload;
 assert.equal(a.evidenceHash,o.assessmentEvidenceHash);assert.equal(a.shareWithEmployer,false);assert.equal(a.status,'pending_review');
 await assert.rejects(()=>backend.readEmployerAssessment('ci-employer',a.id),/Workspace access denied/);
});

test('real PostgreSQL: employer progression, offer issuance and student acceptance are scoped',async()=>{
 const actorUid='ci-activation-stu',campaignId='ci-campaign';
 const student=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+actorUid])).rows[0].payload;
 const opportunityId=student.campaignConsents[campaignId].opportunityId;
 const step=(uid:string,nextStage:string,requestId:string,meta:any={})=>backend.executeRecruitmentTransition({actorUid:uid,requestId,action:'ADVANCE_CANDIDATE_STAGE',payload:{opportunityId,nextStage,meta}});
 await assert.rejects(()=>step('ci-employer','shortlisted','ci-offer-revoked'));
 await backend.executeRecruitmentTransition({actorUid,requestId:'ci-offer-consent',action:'GLOBAL_CONSENT',payload:{approved:true,campaignIds:[campaignId]}});
 await step('ci-employer','shortlisted','ci-offer-shortlist');
 await step('ci-employer','interviewing','ci-offer-interview');
 await step('ci-employer','offered','ci-offer-issue',{offer:{salaryLPA:8,terms:'Synthetic offer'}});
 await assert.rejects(()=>step('ci-student','accepted','ci-offer-foreign'));
 const first=await step(actorUid,'accepted','ci-offer-accept',{interviewFeedback:'forged',offer:{salaryLPA:99,offerLetterUrl:'forged'}});
 assert.equal(first.replayed,false);assert.equal((await step(actorUid,'accepted','ci-offer-accept')).replayed,true);
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+opportunityId])).rows[0].payload;
 const offer=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['offers/'+o.offerRecordId])).rows[0].payload;
 assert.equal(o.stage,'accepted');assert.equal(o.interviewFeedback,undefined);assert.equal(offer.salaryLPA,8);assert.equal(offer.status,'accepted');assert.equal(offer.acceptedBy,actorUid);
});

test('real PostgreSQL: joining creates one placement and exact earned fee from accepted salary',async()=>{
 const sid='ci-activation-stu';
 const student=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+sid])).rows[0].payload;
 const opportunityId=student.campaignConsents['ci-campaign'].opportunityId;
 const input={actorUid:'ci-employer',requestId:'ci-joining-scoped',action:'ADVANCE_CANDIDATE_STAGE' as const,payload:{opportunityId,nextStage:'joined',meta:{offer:{salaryLPA:999}}}};
 await assert.rejects(()=>backend.executeRecruitmentTransition({...input,actorUid:'ci-student',requestId:'ci-joining-foreign'}));
 assert.equal((await backend.executeRecruitmentTransition(input)).replayed,false);
 assert.equal((await backend.executeRecruitmentTransition(input)).replayed,true);
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+opportunityId])).rows[0].payload;
 const st=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+sid])).rows[0].payload;
 const fees=await pool.query("SELECT payload FROM nexustalent.records WHERE collection='successFees' AND payload->>'opportunityId'=$1",[opportunityId]);
 assert.equal(o.stage,'joined');assert.equal(o.joinedSalaryLPA,8);assert.equal(st.placementStatus,'placed');assert.equal(st.placedSalaryLPA,8);
 assert.equal(fees.rowCount,1);assert.equal(fees.rows[0].payload.compensationMinor,80000000);assert.equal(fees.rows[0].payload.feeAmountMinor,4000000);assert.equal(fees.rows[0].payload.status,'earned');
});

test('real PostgreSQL: commercial estimate uses scoped read and no commercial mutation grants',async()=>{
 const quote=await backend.authorizeCommercialCampaign('ci-employer','ci-campaign');
 assert.equal(quote.campaignId,'ci-campaign');assert.equal(quote.institutions,1);
 await assert.rejects(()=>backend.authorizeCommercialCampaign('ci-new-employer','ci-campaign'),/not authorized/);
 await assert.rejects(()=>backend.authorizeCommercialCampaign('ci-employer','missing-campaign'),/not authorized/);
 await assert.rejects(()=>backend.authorizeCommercialCampaign('ci-student','ci-campaign'),/Only an employer/);
 const result=await pool.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE collection IN ('invoices','campaignCharges','billingEvents','subscriptions','commercialAccounts')");
 assert.equal(result.rows[0].n,0);
});
