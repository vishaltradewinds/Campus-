import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {build} from 'esbuild';
import express from 'express';
import {createServer} from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createBrowserAuthRouter} from '../server/browserAuthRouter.ts';
import {createCookieAuthorization} from '../server/cookieAuthorization.ts';
assert.equal(process.env.NODE_ENV,'test');
assert.equal(process.env.NEXUSTALENT_STANDALONE_AUTH_TEST,'1');
const origin='https://127.0.0.1:4443';
const real=process.env.NEXUSTALENT_AUTH_PG_CI==='1';
const campusStudentId='ci-browser-campus-student',campusStudentName='Synthetic Campus Candidate';
const actors=(real?['employer','institution','student']:['student','institution','employer']).map(role=>({uid:real?(role==='student'?campusStudentId:'ci-new-'+role):'browser-'+role,email:real?(role==='student'?campusStudentId:'ci-new-'+role)+'@example.test':role+'@example.invalid',name:'Synthetic '+role,role}));
const password='Synthetic-browser-only-123456';
const sessions=new Map();
let service={
 async login(email,passwordInput){const actor=actors.find(x=>x.email===email);if(!actor||passwordInput!==password)return null;const token=randomBytes(32).toString('base64url');sessions.set(token,actor);return token;},
 async logout(token){return sessions.delete(token);}
};
let verify=async token=>{const a=sessions.get(token);return a?{status:'verified',identity:{uid:a.uid,email:a.email,adminClaim:false}}:{status:'denied'};};
const baseEntry="import React from 'react';import {createRoot} from 'react-dom/client';import {StandaloneStakeholderAcceptance} from './src/components/StandaloneStakeholderAcceptance.tsx';";
const entry=real?baseEntry+"import {StandaloneDashboardAcceptance} from './src/components/StandaloneDashboardAcceptance.tsx';createRoot(document.getElementById('root')).render(React.createElement(StandaloneStakeholderAcceptance,{renderDashboard:identity=>React.createElement(StandaloneDashboardAcceptance,{identity})}));":baseEntry+"createRoot(document.getElementById('root')).render(React.createElement(StandaloneStakeholderAcceptance));";
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'browser-acceptance-entry.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',metafile:true,define:{'process.env.NODE_ENV':'\"production\"'}});
assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>/node_modules\/(?:@firebase\/|firebase\/)|src\/lib\/firebase\.ts$/.test(p)),'Legacy Firebase SDK must not enter standalone browser bundle');
const dir=await mkdtemp(join(tmpdir(),'nexus-standalone-'));
let server,browser,backend,owner,login,reader;
let prepared=false,createdCallId,createdCampaignId,createdOpportunityId;
const demandTitle='Synthetic browser recruitment acceptance',responseNote='Synthetic placement cell acceptance',assessmentText='Synthetic response: review the evidence, document assumptions, and validate results.',offerTerms='Synthetic CI offer terms only; no actual employment or payment.';
const journeys=real?[...actors.map(a=>({...a,phase:'initial'})),{...actors.find(a=>a.role==='employer'),phase:'review'},{...actors.find(a=>a.role==='student'),phase:'accept'},{...actors.find(a=>a.role==='employer'),phase:'join'}]:actors;
try{
 if(real){
  assert.equal(process.env.NEXUSTALENT_DATASTORE,'postgres');assert.equal(process.env.NEXUSTALENT_PG_INTEGRATION,'1');
  const {default:pg}=await import('pg');
  function pool(key,username){const value=process.env[key];assert.ok(value);const u=new URL(value);assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'5432');assert.equal(u.pathname,'/nexustalent_ci');assert.equal(u.username,username);assert.equal(u.search,'');assert.equal(u.hash,'');return new pg.Pool({connectionString:value,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});}
  owner=pool('NEXUSTALENT_AUTH_OWNER_CI_URL','postgres');login=pool('NEXUSTALENT_AUTH_LOGIN_CI_URL','nexustalent_login_ci');reader=pool('NEXUSTALENT_AUTH_READER_CI_URL','nexustalent_session_ci');
  delete process.env.NEXUSTALENT_TEST_DATABASE_URL;
  backend=await import('../server/trustedBackend.ts');
  const {createCredentialService,hashPassword}=await import('../server/postgresCredentials.ts');
  const {createPostgresSessionVerifier}=await import('../server/postgresSessionIdentity.ts');
  service=createCredentialService((q,p)=>login.query(q,p));verify=createPostgresSessionVerifier((q,p)=>reader.query(q,p));
  await backend.executeTrustedProfileMutation({actorUid:'ci-evidence-admin',adminClaim:true,requestId:'browser-campus-empanelment-ci',action:'UPDATE_INSTITUTION_EMPANELMENT',payload:{institutionId:'ci-new-institution',status:'empanelled',notes:'Synthetic CI fixture only'}});
  await backend.registerOwnStakeholder(campusStudentId,campusStudentId+'@example.test',{role:'student',name:campusStudentName,registrationType:'empanelled',institutionId:'ci-new-institution',customCollegeName:'',state:'Test',program:'B.Tech',branch:'Engineering',graduationYear:2027,cgpa:8,rollNumber:'SYNTHETIC-001',minSalaryLPA:0});
  await backend.executeTrustedProfileMutation({actorUid:'ci-new-institution',requestId:'browser-campus-verification-ci',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION',payload:{studentId:campusStudentId,status:'verified',notes:'Synthetic CI verification fixture'}});
  prepared=true;
  for(const a of actors){const account=await backend.readOwnAccount(a.uid);assert.equal(account.role,a.role);assert.equal(account.email,a.email);
   await owner.query('INSERT INTO nexustalent_identity.principals(uid,email) VALUES ($1,$2)',[a.uid,a.email]);
   await owner.query('INSERT INTO nexustalent_identity.credentials(uid,login_name,password_hash) VALUES ($1,$2,$3)',[a.uid,a.email,await hashPassword(password)]);
  }
 }
 const key=join(dir,'key.pem'),cert=join(dir,'cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1','-keyout',key,'-out',cert],{stdio:'ignore'});
 const app=express();app.disable('x-powered-by');
 const auth=createCookieAuthorization(verify,origin);
 app.use('/api/auth',createBrowserAuthRouter(service,verify,origin));
 app.get('/api/account/me',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);try{return res.json({account:real?await backend.readOwnAccount(res.locals.identity.uid):actors.find(x=>x.uid===res.locals.identity.uid)});}catch{return res.sendStatus(503);}});
 app.get('/api/workspace',auth,async(req,res)=>{if(Object.keys(req.query).length)return res.sendStatus(400);if(real){try{return res.json(await backend.readStakeholderWorkspace(res.locals.identity.uid,false));}catch{return res.sendStatus(503);}}const a=actors.find(x=>x.uid===res.locals.identity.uid);return res.json({uid:a.uid,role:a.role,status:'ready',profile:{id:a.uid},collections:Object.fromEntries(['employers','institutions','students','requirements','campaigns','calls','opportunities','users'].map(k=>[k,[]]))});});
 if(real){
  const mutation=(allowed,execute)=>[auth,express.json({limit:'64kb'}),async(req,res)=>{
   if(Object.keys(req.query).length||!req.body||Object.keys(req.body).sort().join(',')!=='action,payload,requestId'||!allowed.includes(req.body.action)||typeof req.body.requestId!=='string'||!req.body.payload||typeof req.body.payload!=='object'||Array.isArray(req.body.payload))return res.sendStatus(400);
   try{return res.json(await execute({actorUid:res.locals.identity.uid,adminClaim:false,action:req.body.action,requestId:req.body.requestId,payload:req.body.payload}));}
   catch{return res.status(403).json({error:'Mutation denied'});}
  }];
  app.post('/api/recruitment/transitions',...mutation(['CREATE_REQUIREMENT_CAMPAIGN','SEND_CALLS','RESPOND_CALL','ACTIVATE_STUDENTS','GLOBAL_CONSENT','SUBMIT_CONSENT','UPDATE_CONSENT_SCOPE','ADVANCE_CANDIDATE_STAGE'],backend.executeRecruitmentTransition));
  app.post('/api/profile/mutations',...mutation(['UPDATE_STUDENT_AVAILABILITY'],backend.executeTrustedProfileMutation));
  app.post('/api/candidate-projections',auth,express.json({limit:'4kb'}),async(req,res)=>{const b=req.body;if(Object.keys(req.query).length||!b||Object.keys(b).sort().join(',')!=='campaignId,requestId,studentId,view'||b.view!==true||[b.campaignId,b.requestId,b.studentId].some(v=>typeof v!=='string'||!/^[A-Za-z0-9._:-]{8,128}$/.test(v)))return res.sendStatus(400);try{return res.json(await backend.provisionCandidateProjection({actorUid:res.locals.identity.uid,campaignId:b.campaignId,studentId:b.studentId,requestId:b.requestId,includeEmployerProfile:true}));}catch{return res.sendStatus(403);}});
  app.get('/api/assessment-evidence/:submissionId',auth,async(req,res)=>{if(Object.keys(req.query).length||!/^[a-f0-9]{64}$/.test(req.params.submissionId))return res.sendStatus(400);try{return res.json(await backend.readEmployerAssessment(res.locals.identity.uid,req.params.submissionId));}catch{return res.sendStatus(403);}});
 }
 app.get('/bundle.js',(_req,res)=>res.type('application/javascript').send(bundle.outputFiles[0].text));
 app.get('/',(_req,res)=>res.type('html').send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
 server=createServer({key:await readFile(key),cert:await readFile(cert)},app);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4443,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true});
 for(const actor of journeys){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   const pageErrors=[];page.on('pageerror',e=>{pageErrors.push(e.name+': '+e.message);console.error('Synthetic browser page exception: '+e.name+': '+e.message);});
   await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
   await page.goto(origin);
   await page.getByLabel('Email',{exact:true}).fill(actor.email);
   await page.getByLabel('Password',{exact:true}).fill(password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   async function confirmWorkspace(){
    if(!real){await page.getByRole('region',{name:'Stakeholder workspace'}).getByText('Role: '+actor.role,{exact:true}).waitFor();return;}
    await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
    const result=await context.request.get(origin+'/api/workspace');assert.equal(result.status(),200);const view=await result.json();assert.equal(view.uid,actor.uid);assert.equal(view.role,actor.role);
    assert.equal(typeof view.profile.name,'string');
    try{await page.getByRole('heading',{level:1,name:view.profile.name,exact:true}).waitFor({timeout:12000});}catch(error){console.error('Synthetic dashboard render diagnostic:',JSON.stringify({role:actor.role,headings:await page.locator('h1,h2,h3').allTextContents(),status:await page.getByRole('status').allTextContents(),pageErrors,body:(await page.locator('body').innerText()).slice(0,1500)}));throw error;}
    assert.deepEqual(pageErrors,[]);
   }
   await confirmWorkspace();
   if(real&&actor.role==='student'&&actor.phase==='initial'){
    const select=page.getByLabel('Placement Availability');
    const next=(await select.inputValue())==='open_to_offers'?'actively_seeking':'open_to_offers';
    const [response]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/profile/mutations'&&r.request().method()==='POST'),select.selectOption(next)]);
    assert.equal(response.status(),200);assert.equal((await response.json()).replayed,false);
    assert.equal((await backend.readStakeholderWorkspace(actor.uid,false)).profile.availability,next);
    await page.reload();await confirmWorkspace();assert.equal(await page.getByLabel('Placement Availability').inputValue(),next);
    console.log('PASS browser student availability persisted');
    assert.ok(createdOpportunityId&&createdCampaignId);
    const own=await backend.readStakeholderWorkspace(actor.uid,false);assert.ok(own.collections.opportunities.some(o=>o.id===createdOpportunityId&&o.stage==='invited'));
    await page.locator('#tab-opportunities').click();
    await page.getByRole('button',{name:'Review sharing consent',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Apply to opportunity',exact:true}).count(),0);
    const denial=await context.request.post(origin+'/api/recruitment/transitions',{headers:{Origin:origin},data:{action:'SUBMIT_CONSENT',requestId:'browser-unconsented-application-ci',payload:{opportunityId:createdOpportunityId,consented:true}}});assert.equal(denial.status(),403);
    await page.getByRole('button',{name:'Review sharing consent',exact:true}).click();
    const [approved]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.locator('#approve-consent-'+createdCampaignId).click()]);assert.equal(approved.status(),200);
    await page.getByText('Permissions updated.',{exact:true}).waitFor();
    const grant=(await backend.readStakeholderWorkspace(actor.uid,false)).profile.campaignConsents[createdCampaignId];assert.equal(grant.status,'approved');assert.equal(grant.employerId,'ci-new-employer');for(const key of ['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared'])assert.equal(grant[key],false);
    await page.locator('#tab-opportunities').click();
    const [applied]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.getByRole('button',{name:'Apply to opportunity',exact:true}).click()]);assert.equal(applied.status(),200);assert.equal((await applied.json()).replayed,false);
    assert.equal((await backend.readStakeholderWorkspace(actor.uid,false)).collections.opportunities.find(o=>o.id===createdOpportunityId).stage,'assessment_pending');
    assert.equal((await backend.readStakeholderWorkspace('ci-new-employer',false)).collections.campaigns.find(c=>c.id===createdCampaignId).funnel.applicationsConsented,1);
    await page.reload();await confirmWorkspace();await page.locator('#tab-opportunities').click();await page.getByText(demandTitle,{exact:true}).waitFor();
    console.log('PASS browser student consent and application persisted; unconsented application denied');
    await page.locator('#tab-consent-matrix').click();
    await page.getByRole('button',{name:'DETAILS',exact:true}).click();
    const [scope]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.getByText('Coding Scores',{exact:true}).click()]);assert.equal(scope.status(),200);
    await page.getByText('Permissions updated.',{exact:true}).waitFor();
    const consent=(await backend.readStakeholderWorkspace(actor.uid,false)).profile.campaignConsents[createdCampaignId];assert.equal(consent.skillBenchmarksShared,true);assert.equal(consent.contactInfoShared,false);
    await page.locator('#tab-opportunities').click();await page.getByRole('button',{name:'Take Subject Assessment',exact:true}).click();
    await page.getByPlaceholder('Enter calculations, methodology, formulas, case analysis, or regulatory compliance breakdown...').fill(assessmentText);
    await page.getByLabel(/Allow this employer to read my submitted response/).check();
    const [submitted]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.getByRole('button',{name:'Submit for Human Review',exact:true}).click()]);assert.equal(submitted.status(),200);
    await page.getByText('Assessment submitted. Human review is pending; no score or skill verification has been issued.',{exact:true}).waitFor();
    const assessed=(await backend.readStakeholderWorkspace(actor.uid,false)).collections.opportunities.find(o=>o.id===createdOpportunityId);assert.equal(assessed.stage,'assessment_completed');assert.equal(assessed.assessmentScore,null);assert.equal(assessed.assessmentReviewStatus,'pending_review');assert.ok(assessed.assessmentSubmissionId);
    console.log('PASS browser assessment submitted without fabricated score');
   }
   if(real&&actor.role==='employer'&&actor.phase==='initial'){
    const title=demandTitle;
    await page.locator('#create-demand-btn').click();
    for(const [id,value] of Object.entries({'job-role-title-input':title,'vacancies-count-input':'2','joining-window-input':'June 2027','required-skills-input':'SQL','job-locations-input':'Test City','salary-min-lpa-input':'5','salary-max-lpa-input':'7','ideal-candidate-profile-summary':'Synthetic acceptance only'}))await page.locator('#'+id).fill(value);
    const [response]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.locator('#submit-requirement-btn').click()]);
    assert.equal(response.status(),200);const result=await response.json();assert.equal(result.replayed,false);assert.equal(result.ids.length,2);
    const view=await backend.readStakeholderWorkspace(actor.uid,false);
    assert.ok(view.collections.requirements.some(r=>r.role===title&&r.id===result.ids[0]&&r.vacancies===2));
    assert.ok(view.collections.campaigns.some(c=>c.id===result.ids[1]&&c.requirementId===result.ids[0]));
    await page.locator('#submit-requirement-btn').waitFor({state:'hidden'});
    await page.reload();await confirmWorkspace();
    assert.ok((await backend.readStakeholderWorkspace(actor.uid,false)).collections.requirements.some(r=>r.id===result.ids[0]));
    const selector=page.getByLabel('Select Active Hiring Campaign');if(await selector.count())await selector.selectOption(result.ids[0]);
    await page.getByRole('heading',{level:2,name:title,exact:true}).waitFor();
    console.log('PASS browser recruitment demand and campaign persisted');
    createdCampaignId=result.ids[1];
    const campus=(await backend.readStakeholderWorkspace(actor.uid,false)).collections.institutions.find(i=>i.id==='ci-new-institution');assert.equal(campus?.empanelmentStatus,'empanelled');
    await page.locator('#tab-level1').click();
    const row=page.getByRole('row').filter({hasText:campus.name});await row.getByRole('checkbox').check();
    const [sent]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.locator('#dispatch-call-btn').click()]);
    assert.equal(sent.status(),200);const sentBody=await sent.json();assert.equal(sentBody.replayed,false);
    const sentView=await backend.readStakeholderWorkspace(actor.uid,false);const call=sentView.collections.calls.find(c=>c.campaignId===createdCampaignId&&c.institutionId===campus.id);assert.ok(call);assert.equal(call.status,'pending');createdCallId=call.id;
    await page.getByText('Server confirmed invitations to 1 institutions.',{exact:true}).waitFor();
    console.log('PASS browser employer invitation persisted');
   }
   if(real&&actor.role==='institution'){
    assert.ok(createdCallId&&createdCampaignId);
    const incoming=await backend.readStakeholderWorkspace(actor.uid,false);assert.ok(incoming.collections.calls.some(c=>c.id===createdCallId&&c.status==='pending'));
    await page.getByRole('heading',{name:demandTitle,exact:true}).waitFor();
    await page.getByRole('button',{name:'Accept',exact:true}).click();
    const form=page.locator('form').filter({has:page.getByRole('button',{name:'Submit Response',exact:true})});
    await form.locator('input[type=number]').fill('1');await form.locator('textarea').fill(responseNote);
    const [accepted]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),form.getByRole('button',{name:'Submit Response',exact:true}).click()]);
    assert.equal(accepted.status(),200);assert.equal((await accepted.json()).replayed,false);
    await page.getByRole('button',{name:'Submit Response',exact:true}).waitFor({state:'hidden'});
    const persisted=await backend.readStakeholderWorkspace(actor.uid,false);const call=persisted.collections.calls.find(c=>c.id===createdCallId);assert.equal(call.status,'accepted');assert.equal(call.offeredCandidatesCount,1);assert.equal(call.responseNotes,responseNote);
    const employer=await backend.readStakeholderWorkspace('ci-new-employer',false);assert.equal(employer.collections.campaigns.find(c=>c.id===createdCampaignId).funnel.institutionsAccepted,1);
    await page.reload();await confirmWorkspace();await page.getByText(responseNote,{exact:true}).waitFor();
    console.log('PASS browser institution acceptance persisted and employer funnel reconciled');
    await page.getByRole('button',{name:'PLACEMENT DRIVES',exact:true}).click();
    await page.getByLabel('Select Target Company Invitation').selectOption(createdCallId);
    await page.getByRole('row').filter({hasText:campusStudentName}).getByRole('checkbox').check();
    const [activated]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.getByRole('button',{name:'INVITE STUDENTS (1)',exact:true}).click()]);
    assert.equal(activated.status(),200);assert.equal((await activated.json()).replayed,false);
    await page.getByText('Student invitations confirmed by the server.',{exact:true}).waitFor();
    const activatedView=await backend.readStakeholderWorkspace(actor.uid,false);const opportunity=activatedView.collections.opportunities.find(o=>o.campaignId===createdCampaignId&&o.studentId===campusStudentId);
    assert.ok(opportunity);assert.equal(opportunity.stage,'invited');createdOpportunityId=opportunity.id;
    assert.equal(activatedView.collections.calls.find(c=>c.id===createdCallId).activatedStudentsCount,1);
    console.log('PASS browser institutional student activation persisted');
   }
   if(real&&actor.role==='employer'&&['review','join'].includes(actor.phase)){
    const view=await backend.readStakeholderWorkspace(actor.uid,false);const campaign=view.collections.campaigns.find(c=>c.id===createdCampaignId);assert.ok(campaign);
    const selector=page.getByLabel('Select Active Hiring Campaign');if(await selector.count())await selector.selectOption(campaign.requirementId);
    await page.locator('#tab-level2').click();const candidate=page.getByRole('article').filter({hasText:'Application reference: '+createdOpportunityId.slice(0,12)});
    async function currentStage(stage){const view=await backend.readStakeholderWorkspace(actor.uid,false);const opp=view.collections.opportunities.find(o=>o.id===createdOpportunityId);assert.equal(opp.stage,stage);return opp;}
    async function project(){const [r]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/candidate-projections'&&r.request().method()==='POST'),candidate.getByRole('button',{name:'Check consent & view profile',exact:true}).click()]);assert.equal(r.status(),200);const body=await r.json();assert.equal(body.profile.studentId,campusStudentId);assert.equal(body.profile.consentScope.contactInfoShared,false);assert.equal(body.profile.email,undefined);await candidate.getByRole('button',{name:'Hide profile',exact:true}).waitFor();}
    async function advance(label,stage){const [r]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),candidate.getByRole('button',{name:label,exact:true}).click()]);assert.equal(r.status(),200);assert.equal((await r.json()).replayed,false);await candidate.getByText('Server confirmed recruitment update.',{exact:true}).waitFor();return await currentStage(stage);}
    if(actor.phase==='review'){
     await currentStage('assessment_completed');await project();
     await candidate.getByText('Assessment evidence — human review',{exact:true}).click();
     const [evidence]=await Promise.all([page.waitForResponse(r=>r.url().startsWith(origin+'/api/assessment-evidence/')),candidate.getByRole('button',{name:'Load current authorized response',exact:true}).click()]);assert.equal(evidence.status(),200);assert.equal((await evidence.json()).response,assessmentText);await candidate.getByText(assessmentText,{exact:true}).waitFor();
     await advance('Human-reviewed shortlist','shortlisted');await project();await advance('Start interview stage','interviewing');await project();
     await candidate.getByLabel('Annual salary (LPA)').fill('6');await candidate.getByLabel('Actual offer terms').fill(offerTerms);
     const offered=await advance('Issue offer','offered');assert.ok(offered.offerRecordId);
     const stored=await owner.query('SELECT payload FROM nexustalent.records WHERE document_path=$1',['offers/'+offered.offerRecordId]);assert.equal(stored.rows[0].payload.status,'issued');assert.equal(stored.rows[0].payload.salaryLPA,6);assert.equal(stored.rows[0].payload.terms,offerTerms);
     console.log('PASS browser assessment disclosure, shortlist, interview, and offer issuance');
    }else{
     const accepted=await currentStage('accepted');assert.equal(accepted.joinedAt,undefined);
     assert.equal((await owner.query("SELECT count(*)::int AS n FROM nexustalent.records WHERE collection='successFees' AND payload->>'opportunityId'=$1",[createdOpportunityId])).rows[0].n,0);
     page.once('dialog',d=>d.accept());const joined=await advance('Record actual joining','joined');assert.equal(joined.joinedSalaryLPA,6);assert.ok(joined.joinedAt);
     const stored=await owner.query('SELECT payload FROM nexustalent.records WHERE document_path=$1',['offers/'+joined.offerRecordId]);assert.equal(stored.rows[0].payload.status,'joined');
     const fees=await owner.query("SELECT payload FROM nexustalent.records WHERE collection='successFees' AND payload->>'opportunityId'=$1",[createdOpportunityId]);assert.equal(fees.rowCount,1);assert.equal(fees.rows[0].payload.status,'earned');
     const funnel=(await backend.readStakeholderWorkspace(actor.uid,false)).collections.campaigns.find(c=>c.id===createdCampaignId).funnel;for(const key of ['institutionsInvited','institutionsAccepted','studentsInvited','applicationsConsented','assessmentsCompleted','shortlisted','interviewed','offersMade','offersAccepted','joined'])assert.equal(funnel[key],1,key);
     const student=await backend.readStakeholderWorkspace(campusStudentId,false);assert.equal(student.profile.placementStatus,'placed');assert.equal(student.profile.placedSalaryLPA,6);assert.equal(student.profile.availability,'not_currently_available');
     console.log('PASS browser actual joining, authoritative offer, placement and funnel; synthetic fee ledger only');
    }
   }
   if(real&&actor.role==='student'&&actor.phase==='accept'){
    await page.locator('#tab-opportunities').click();await page.getByRole('button',{name:'Accept Job Offer',exact:true}).waitFor();
    const [r]=await Promise.all([page.waitForResponse(r=>r.url()===origin+'/api/recruitment/transitions'&&r.request().method()==='POST'),page.getByRole('button',{name:'Accept Job Offer',exact:true}).click()]);assert.equal(r.status(),200);assert.equal((await r.json()).replayed,false);
    const view=await backend.readStakeholderWorkspace(actor.uid,false);const opp=view.collections.opportunities.find(o=>o.id===createdOpportunityId);assert.equal(opp.stage,'accepted');assert.equal(opp.joinedAt,undefined);
    assert.notEqual(view.profile.placementStatus,'placed');const offer=await owner.query('SELECT payload FROM nexustalent.records WHERE document_path=$1',['offers/'+opp.offerRecordId]);assert.equal(offer.rows[0].payload.status,'accepted');
    console.log('PASS browser student acceptance distinct from joining');
   }
   const cookies=await context.cookies(origin);const c=cookies.find(x=>x.name==='__Host-nexustalent-session');assert.ok(c&&c.httpOnly&&c.secure&&c.sameSite==='Strict'&&c.path==='/');
   assert.equal(await page.evaluate(()=>document.cookie.includes('__Host-nexustalent-session')),false);
   assert.equal((await context.request.get(origin+'/api/workspace?uid=other')).status(),400);
   await page.reload();await confirmWorkspace();
   await page.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   assert.equal((await context.request.get(origin+'/api/workspace')).status(),401);
   assert.equal((await context.cookies(origin)).some(x=>x.name==='__Host-nexustalent-session'),false);
   console.log('PASS standalone browser journey: '+actor.role);
  }finally{await context.close();}
 }
 if(real){const r=await owner.query('SELECT count(*)::int AS n FROM nexustalent_identity.sessions WHERE uid=ANY($1) AND revoked_at IS NOT NULL',[actors.map(a=>a.uid)]);assert.equal(r.rows[0].n,journeys.length);}else assert.equal(sessions.size,0);
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));try{if(prepared)await owner.query('DELETE FROM nexustalent_identity.principals WHERE uid=ANY($1)',[actors.map(a=>a.uid)]);}finally{await backend?.closePostgresIntegrationStore();await Promise.all([owner?.end(),login?.end(),reader?.end()]);await rm(dir,{recursive:true,force:true});}}
