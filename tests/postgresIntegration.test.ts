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
// The trusted API must initialize and operate without the broad fixture credential.
delete process.env.NEXUSTALENT_TEST_DATABASE_URL;
const backend=await import('../server/trustedBackend');
process.env.NEXUSTALENT_TEST_DATABASE_URL=connectionString;
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
 await assert.rejects(()=>step('ci-employer','offered','ci-offer-missing-terms',{offer:{salaryLPA:8}}),/employer-authored offer terms/);
 await assert.rejects(()=>step('ci-employer','offered','ci-offer-http-link',{offer:{salaryLPA:8,terms:'Synthetic offer',offerLetterUrl:'http://example.test/offer'}}),/Invalid HTTPS offer letter URL/);
 const afterRejectedOffer=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+opportunityId])).rows[0].payload;
 assert.equal(afterRejectedOffer.stage,'interviewing');
 await step('ci-employer','offered','ci-offer-issue',{offer:{salaryLPA:8,terms:'Synthetic offer'}});
 await assert.rejects(()=>step('ci-student','accepted','ci-offer-foreign'));
 const first=await step(actorUid,'accepted','ci-offer-accept',{interviewFeedback:'forged',offer:{salaryLPA:99,offerLetterUrl:'forged'}});
 assert.equal(first.replayed,false);assert.equal((await step(actorUid,'accepted','ci-offer-accept')).replayed,true);
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+opportunityId])).rows[0].payload;
 const offer=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['offers/'+o.offerRecordId])).rows[0].payload;
 assert.equal(o.stage,'accepted');assert.equal(o.offerSummary,undefined);const summary=(await backend.readStakeholderWorkspace(actorUid,false)).collections.opportunities.find(x=>x.id===opportunityId)?.offerSummary;assert.equal(summary.id,offer.id);assert.equal(summary.salaryLPA,8);assert.equal(summary.terms,'Synthetic offer');assert.equal(o.interviewFeedback,undefined);assert.equal(offer.salaryLPA,8);assert.equal(offer.status,'accepted');assert.equal(offer.acceptedBy,actorUid);
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

test('real PostgreSQL: verification binds admin claim and institution ownership',async()=>{
 const base={actorUid:'ci-evidence-admin',requestId:'verify-employer-001',action:'UPDATE_EMPLOYER_VERIFICATION' as const,payload:{employerId:'ci-new-employer',status:'verified',notes:'Synthetic review evidence'}};
 await assert.rejects(()=>backend.executeTrustedProfileMutation(base),/Super admin authorization/);
 await assert.rejects(()=>backend.executeTrustedProfileMutation({...base,adminClaim:true,requestId:'verify-no-evidence-001',payload:{...base.payload,notes:''}}),/Actual verification evidence note is required/);
 assert.equal((await backend.executeTrustedProfileMutation({...base,adminClaim:true})).replayed,false);
 assert.equal((await backend.executeTrustedProfileMutation({...base,adminClaim:true})).replayed,true);
 const institutional={actorUid:'ci-verified-campus',requestId:'verify-inst-001',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION' as const,payload:{studentId:'ci-activation-stu',status:'verified',notes:'Synthetic evidence'}};
 await assert.rejects(()=>backend.executeTrustedProfileMutation({...institutional,payload:{...institutional.payload,studentId:'ci-activation-other'}}),/not authorized/);
 await backend.executeTrustedProfileMutation(institutional);
 const s=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path='students/ci-activation-stu'")).rows[0].payload;
 assert.equal(s.institutionVerificationStatus,'verified');assert.equal(s.verificationNotes,'Synthetic evidence');
});

test('real PostgreSQL: academic correction preserves placement and revokes obsolete consent',async()=>{
 const sid='ci-activation-stu';
 const request={actorUid:sid,requestId:'academic-request-001',action:'REQUEST_ACADEMIC_CORRECTION' as const,payload:{proposed:{graduationYear:2029},reason:'Synthetic transcript correction'}};
 const submitted=await backend.executeTrustedProfileMutation(request);
 assert.equal(submitted.replayed,false);
 const review={actorUid:'ci-verified-campus',requestId:'academic-review-001',action:'REVIEW_ACADEMIC_CORRECTION' as const,payload:{studentId:sid,correctionId:submitted.auditEventId,decision:'approved',note:'Synthetic transcript reviewed'}};
 await assert.rejects(()=>backend.executeTrustedProfileMutation({...review,actorUid:'ci-new-institution'}),/not authorized/);
 await backend.executeTrustedProfileMutation(review);
 const s=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+sid])).rows[0].payload;
 assert.equal(s.graduationYear,2029);assert.equal(s.placementStatus,'placed');assert.equal(s.platformVerificationStatus,'pending');assert.equal(s.campaignConsents['ci-campaign'].status,'denied');assert.equal(s.campaignConsents['ci-campaign'].academicDataShared,false);
 assert.equal(s.academicCorrection.status,'approved');
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['opportunities/'+s.campaignConsents['ci-campaign'].opportunityId])).rows[0].payload;
 assert.equal(o.stage,'joined');
});

test('real PostgreSQL: career evidence submission, provenance review and dispute',async()=>{
 const sid='ci-activation-stu',admin='ci-evidence-admin';
 const input={actorUid:sid,studentId:sid,requestId:'evidence-submit-ci',evidenceId:'ci-evidence-submission',claimType:'skill' as const,claimKey:'SQL',claimValue:'Synthetic',sourceType:'student_submission' as const};
 assert.equal((await backend.submitCareerEvidence(input)).replayed,false);
 assert.equal((await backend.submitCareerEvidence(input)).replayed,true);
 await assert.rejects(()=>backend.submitCareerEvidence({...input,claimValue:'Modified'}),/identifier reuse/);
 const tx=await store.begin();await store.commit(tx,[{name:'careerEvidence/ci-authoritative-evidence',data:{id:'ci-authoritative-evidence',studentId:sid,status:'under_review',sourceType:'institution',sourceId:'ci-verified-campus',lineageHash:'seed'}}]);
 const review={actorUid:admin,requestId:'evidence-review-ci',action:'REVIEW_CAREER_EVIDENCE' as const,payload:{evidenceId:'ci-authoritative-evidence',status:'verified'}};
 await assert.rejects(()=>backend.executeTrustedProfileMutation(review),/Super admin authorization/);
 await backend.executeTrustedProfileMutation({...review,adminClaim:true});
 const dispute={actorUid:sid,requestId:'evidence-dispute-ci',action:'DISPUTE_CAREER_EVIDENCE' as const,payload:{evidenceId:'ci-authoritative-evidence',reason:'Synthetic review discrepancy'}};
 await assert.rejects(()=>backend.executeTrustedProfileMutation({...dispute,actorUid:'ci-student'}),/not authorized/);
 await backend.executeTrustedProfileMutation(dispute);
 await backend.executeTrustedProfileMutation({actorUid:admin,adminClaim:true,requestId:'evidence-resolve-ci',action:'RESOLVE_CAREER_EVIDENCE_DISPUTE',payload:{evidenceId:'ci-authoritative-evidence',outcome:'reopen',resolution:'Synthetic dispute reviewed'}});
 const row=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path='careerEvidence/ci-authoritative-evidence'")).rows[0].payload;
 assert.equal(row.status,'under_review');assert.equal(row.disputeStatus,'resolved');assert.equal(row.sourceId,'ci-verified-campus');
});

test('real PostgreSQL: disclosure scope rejects revoked consent and restores only authorized fields',async()=>{
 const sid='ci-activation-stu',cid='ci-campaign';
 const input={actorUid:'ci-employer',studentId:sid,campaignId:cid,requestId:'projection-revoked-ci',includeEmployerProfile:true};
 await assert.rejects(()=>backend.provisionCandidateProjection(input));
 await backend.executeRecruitmentTransition({actorUid:sid,requestId:'projection-consent-ci',action:'GLOBAL_CONSENT',payload:{approved:true,campaignIds:[cid]}});
 const first=await backend.provisionCandidateProjection({...input,requestId:'projection-approved-ci'});
 assert.equal(first.replayed,false);assert.equal(first.profile?.email,undefined);assert.equal(first.profile?.program,undefined);
 const replay=await backend.provisionCandidateProjection({...input,requestId:'projection-approved-ci'});assert.equal(replay.replayed,true);assert.equal(replay.profile,undefined);
 await backend.provisionCandidateProjection({...input,requestId:'projection-refresh-ci'});
 await assert.rejects(()=>backend.provisionCandidateProjection({...input,actorUid:'ci-new-employer',requestId:'projection-foreign-ci'}));
 const o=(await pool.query("SELECT payload FROM nexustalent.records WHERE collection='opportunities' AND payload->>'studentId'=$1 AND payload->>'campaignId'=$2",[sid,cid])).rows[0].payload;
 await assert.rejects(()=>backend.readEmployerAssessment('ci-employer',o.assessmentSubmissionId));
});

test('real PostgreSQL: ordinary profile mutations and privileged role hold',async()=>{
 const sid='ci-activation-stu';
 await backend.executeTrustedProfileMutation({actorUid:sid,action:'UPDATE_GLOBAL_PRIVACY',requestId:'profile-privacy-ci',payload:{settings:{allowUnsolicitedPings:true}}});
 await backend.executeTrustedProfileMutation({actorUid:sid,action:'UPDATE_STUDENT_AVAILABILITY',requestId:'profile-availability-ci',payload:{availability:'open_to_offers'}});
 await backend.executeTrustedProfileMutation({actorUid:'ci-verified-campus',action:'PUBLISH_INSTITUTION_AVAILABILITY',requestId:'profile-publish-ci',payload:{institutionId:'ci-verified-campus',count:20,batchYear:2029,branch:'Engineering',description:'Synthetic availability'}});
 await backend.executeTrustedProfileMutation({actorUid:'ci-evidence-admin',adminClaim:true,action:'ADD_VERIFIED_SKILL',requestId:'profile-skill-ci',payload:{studentId:sid,skill:{name:'SQL',category:'technical',score:80,badge:'Verified'}}});
 await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'ci-evidence-admin',adminClaim:true,action:'PROVISION_USER_ROLE',requestId:'profile-role-ci',payload:{targetUid:sid,targetRole:'super_admin'}}),/Invalid user role/);
 const st=(await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['students/'+sid])).rows[0].payload;
 assert.equal(st.globalDataPrivacy.allowUnsolicitedPings,true);assert.equal(st.availability,'open_to_offers');assert.equal(st.skills[0].verifiedBy,'ci-evidence-admin');
});

// Actual PostgreSQL identities and restricted stakeholder backend in one HTTP journey.
test('real PostgreSQL: cookie-authenticated stakeholder account and workspace boundaries',async()=>{
 const env=process.env;assert.equal(env.NEXUSTALENT_AUTH_PG_CI,'1');
 const {default:express}=await import('express');
 const {createBrowserAuthRouter}=await import('../server/browserAuthRouter');
 const {createCookieAuthorization}=await import('../server/cookieAuthorization');
 const {createCredentialService,hashPassword}=await import('../server/postgresCredentials');
 const {createPostgresSessionVerifier}=await import('../server/postgresSessionIdentity');
 function authPool(key:string,username:string){
  const raw=env[key];assert.ok(raw);const u=new URL(raw);
  assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'5432');assert.equal(u.pathname,'/nexustalent_ci');assert.equal(u.username,username);assert.equal(u.search,'');assert.equal(u.hash,'');
  return new pg.Pool({connectionString:raw,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
 }
 const owner=authPool('NEXUSTALENT_AUTH_OWNER_CI_URL','postgres'),login=authPool('NEXUSTALENT_AUTH_LOGIN_CI_URL','nexustalent_login_ci'),reader=authPool('NEXUSTALENT_AUTH_READER_CI_URL','nexustalent_session_ci');
 const origin='https://127.0.0.1:4443',password='synthetic-stakeholder-browser-ci';
 const service=createCredentialService((q,p)=>login.query(q,p)),verify=createPostgresSessionVerifier((q,p)=>reader.query(q,p));
 const app=express();const auth=createCookieAuthorization(verify,origin);
 app.use('/api/auth',createBrowserAuthRouter(service,verify,origin));
 app.get('/api/account/me',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);return res.json({account:await backend.readOwnAccount(res.locals.identity.uid)});});
 app.get('/api/workspace',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);return res.json(await backend.readStakeholderWorkspace(res.locals.identity.uid,false));});
 const actors=[['ci-new-student','student'],['ci-new-institution','institution'],['ci-new-employer','employer']] as const;
 let server:ReturnType<typeof app.listen>|undefined;
 try{
  for(const [uid] of actors){const email=uid+'@example.test';await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES ($1,$2)',[uid,email]);await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ($1,$2,$3)',[uid,email,await hashPassword(password)]);}
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
  assert.equal((await fetch(base+'/api/workspace')).status,401);
  for(const [uid,role] of actors){
   const loginResponse=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({login:uid+'@example.test',password})});
   assert.equal(loginResponse.status,204);const set=loginResponse.headers.get('set-cookie');assert.ok(set);const cookie=set.split(';')[0];const headers={cookie};
   const account=await fetch(base+'/api/account/me',{headers});assert.equal(account.status,200);const a=await account.json();assert.equal(a.account.uid,uid);assert.equal(a.account.role,role);
   const workspace=await fetch(base+'/api/workspace',{headers});assert.equal(workspace.status,200);const w=await workspace.json();assert.equal(w.uid,uid);assert.equal(w.role,role);assert.equal(w.profile.id,uid);
   assert.equal((await fetch(base+'/api/workspace?uid=ci-employer',{headers})).status,400);
   assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie,origin}})).status,204);
   assert.equal((await fetch(base+'/api/workspace',{headers})).status,401);
  }
 }finally{if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));try{await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=ANY($1)',[actors.map(x=>x[0])]);}finally{await Promise.all([owner.end(),login.end(),reader.end()]);}}
});


// Real restricted PostgreSQL transactions through the isolated admin HTTP
// boundary with cryptographically signed assertion and short-lived session.
// CI keys and owner identity fixtures remain synthetic; not live attestation.
test('real PostgreSQL: isolated administrator review authorization, evidence and audit',async()=>{
 assert.equal(process.env.NEXUSTALENT_AUTH_PG_CI,'1');
 const raw=process.env.NEXUSTALENT_AUTH_OWNER_CI_URL;assert.ok(raw);
 const u=new URL(raw);
 assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');
 assert.equal(u.port,'5432');assert.equal(u.pathname,'/nexustalent_ci');assert.equal(u.username,'postgres');
 assert.equal(u.search,'');assert.equal(u.hash,'');
 const owner=new pg.Pool({connectionString:raw,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
 const {default:express}=await import('express');
 const {createAdminPasskeySessionAcceptance}=await import('../server/adminPasskeySessionAcceptance');
 const {generateKeyPairSync,randomBytes,createHash,sign}=await import('node:crypto');
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const credentialId=randomBytes(32).toString('base64url');
 const {createAdminReviewAcceptanceRouter}=await import('../server/adminReviewAcceptanceRouter');
 const env={NODE_ENV:'test',NEXUSTALENT_ADMIN_ACCEPTANCE_TEST:'1'};
 const uid='ci-isolated-admin',email='isolated-admin@example.invalid',origin='https://localhost:4443';
 const app=express();
 const sessions=createAdminPasskeySessionAcceptance({
  origin,credentials:[{uid,credentialId,publicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString()}],
  // Owner pool is used solely for the isolated identity fixture's read and
  // disable operations. The trusted business mutation uses its restricted role.
  lookupAdminAccount:async requested=>{
   const account=await backend.readOwnAccount(requested);
   const result=await owner.query('SELECT uid,email,disabled,admin_authorized FROM nexustalent_identity.principals WHERE uid=$1',[requested]);
   const p=result.rows[0];
   if(!account||account.role!=='super_admin'||!p||p.uid!==account.uid||p.email!==account.email||p.disabled||!p.admin_authorized)return {status:'denied'};
   return {status:'verified',account:{uid:p.uid,email:p.email,role:'super_admin',enabled:true,adminAuthorized:true}};
  }
 },env);
 app.use('/admin',createAdminReviewAcceptanceRouter({origin,verify:sessions.verify,review:input=>backend.executeTrustedProfileMutation(input)},env));
 let server:ReturnType<typeof app.listen>|undefined;
 try{
  const t=await store.begin();
  await store.commit(t,[
   {name:'users/'+uid,data:{uid,email,name:'Synthetic isolated administrator',role:'super_admin'}},
   {name:'employers/ci-admin-review-employer',data:{id:'ci-admin-review-employer',verificationStatus:'pending'}},
   {name:'institutions/ci-admin-review-institution',data:{id:'ci-admin-review-institution',name:'Synthetic Admin Review Campus',code:'CI-ARC',empanelmentStatus:'pending'}},
   {name:'institutions/ci-admin-review-incomplete',data:{id:'ci-admin-review-incomplete',empanelmentStatus:'pending'}},
   {name:'students/ci-admin-review-student',data:{id:'ci-admin-review-student',platformVerificationStatus:'pending'}}
  ]);
  await owner.query('INSERT INTO nexustalent_identity.principals(uid,email,admin_authorized) VALUES($1,$2,true)',[uid,email]);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server!.once('listening',r));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const url='http://127.0.0.1:'+address.port+'/admin/reviews';
  const challenge=sessions.issueChallenge(credentialId);assert.ok(challenge);
  const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest();
  const client=Buffer.from(JSON.stringify({type:'webauthn.get',origin,crossOrigin:false,challenge:challenge.challenge}));
  const auth=Buffer.alloc(37);sha('localhost').copy(auth);auth[32]=5;
  const assertion={credentialId,clientDataJSON:client.toString('base64url'),authenticatorData:auth.toString('base64url'),signature:sign('sha256',Buffer.concat([auth,sha(client)]),privateKey).toString('base64url')};
  const login=await sessions.authenticate(assertion);assert.equal(login.status,'verified');
  if(login.status!=='verified'||!('token' in login)||typeof login.token!=='string')throw Error('Signed administrator session missing');
  assert.equal((await sessions.authenticate(assertion)).status,'denied');
  const headers={origin,authorization:'Bearer '+login.token,'content-type':'application/json'};
  const post=(body:unknown,h:Record<string,string>=headers)=>fetch(url,{method:'POST',headers:h,body:JSON.stringify(body)});
  const reviews=[
   {action:'UPDATE_EMPLOYER_VERIFICATION',requestId:'isolated-review-employer',payload:{employerId:'ci-admin-review-employer',status:'verified',notes:'Synthetic review evidence'}},
   {action:'UPDATE_INSTITUTION_EMPANELMENT',requestId:'isolated-review-institution',payload:{institutionId:'ci-admin-review-institution',status:'empanelled',tier:'Tier-2 Verified',notes:'Synthetic review evidence'}},
   {action:'UPDATE_STUDENT_PLATFORM_VERIFICATION',requestId:'isolated-review-student',payload:{studentId:'ci-admin-review-student',status:'verified',notes:'Synthetic review evidence'}}
  ];
  assert.equal((await post(reviews[0],{...headers,authorization:'Bearer ordinary-session'})).status,401);
  assert.equal((await post({...reviews[0],payload:{...reviews[0].payload,notes:' '}})).status,400);
  const malformed=await post({...reviews[1],requestId:'isolated-review-incomplete',payload:{...reviews[1].payload,institutionId:'ci-admin-review-incomplete'}});assert.equal(malformed.status,503);
  const incomplete=await pool.query("SELECT payload FROM nexustalent.records WHERE document_path='institutions/ci-admin-review-incomplete'");assert.equal(incomplete.rows[0].payload.empanelmentStatus,'pending');
  for(const review of reviews){
   const response=await post(review);assert.equal(response.status,201);
   const result=await response.json();assert.equal(result.replayed,false);
   const retry=await post(review);assert.equal(retry.status,200);assert.equal((await retry.json()).auditEventId,result.auditEventId);
   const altered=await post({...review,payload:{...review.payload,notes:'Different evidence'}});assert.equal(altered.status,409);
   const audit=await pool.query("SELECT payload FROM nexustalent.records WHERE document_path=$1",['auditEvents/'+result.auditEventId]);
   assert.equal(audit.rowCount,1);assert.equal(audit.rows[0].payload.actorUid,uid);assert.equal(audit.rows[0].payload.action,review.action);assert.match(audit.rows[0].payload.verificationDigest,/^[0-9a-f]{64}$/);
  }
  const rows=await pool.query("SELECT document_path,payload FROM nexustalent.records WHERE document_path=ANY($1)",[['employers/ci-admin-review-employer','institutions/ci-admin-review-institution','students/ci-admin-review-student']]);
  assert.equal(rows.rowCount,3);
  assert.equal(rows.rows.find(r=>r.document_path.startsWith('employers/')).payload.verificationStatus,'verified');
  assert.equal(rows.rows.find(r=>r.document_path.startsWith('institutions/')).payload.tier,'Tier-2 Verified');
  assert.equal(rows.rows.find(r=>r.document_path.startsWith('students/')).payload.platformVerificationStatus,'verified');
  await owner.query('UPDATE nexustalent_identity.principals SET disabled=true WHERE uid=$1',[uid]);
  assert.equal((await post({...reviews[0],requestId:'isolated-review-disabled',payload:{...reviews[0].payload,status:'rejected'}})).status,401);
  await owner.query('UPDATE nexustalent_identity.principals SET disabled=false WHERE uid=$1',[uid]);
  assert.equal((await sessions.verify(login.token)).status,'denied');
  const unchanged=await pool.query("SELECT payload FROM nexustalent.records WHERE document_path='employers/ci-admin-review-employer'");
  assert.equal(unchanged.rows[0].payload.verificationStatus,'verified');
 }finally{
  if(server)await new Promise<void>((r,j)=>server!.close(e=>e?j(e):r()));
  try{await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=$1',[uid]);}finally{await owner.end();}
 }
});
