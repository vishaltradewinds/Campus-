import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const project = 'demo-nexustalent-acceptance';
const app = 'http://127.0.0.1:4179';
const authURL = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const dbURL = 'http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents';
assert.equal(process.env.NEXUSTALENT_EMULATOR_TEST,'1');
assert.equal(process.env.FIREBASE_PROJECT_ID,project);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
const password = 'Synthetic-only-123456!';
async function json(url, init = {}, expected = 200) {
  const response = await fetch(url,init);
  const data = await response.json();
  assert.ok(Array.isArray(expected) ? expected.includes(response.status) : response.status === expected, JSON.stringify({url,status:response.status,data}));
  return data;
}
function value(v) {
  if (v === null) return {nullValue:null};
  if (typeof v === 'string') return {stringValue:v};
  if (typeof v === 'boolean') return {booleanValue:v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v};
  if (Array.isArray(v)) return {arrayValue:{values:v.map(value)}};
  return {mapValue:{fields:fields(v)}};
}
const fields = o => Object.fromEntries(Object.entries(o).map(([k,v])=>[k,value(v)]));
const headers = token => ({Authorization:'Bearer '+token,'Content-Type':'application/json'});
async function seed(path,data) { await json(dbURL+'/'+path,{method:'PATCH',headers:headers('owner'),body:JSON.stringify({fields:fields(data)})}); }
async function account(role,name,suffix='') {
  const email=role+suffix+'@example.test';
  const r=await json(authURL+'/accounts:signUp?key=demo-key',{method:'POST',headers:headers(''),body:JSON.stringify({email,password,returnSecureToken:true})});
  const uid=r.localId;
  await seed('users/'+uid,{uid,email,role,name});
  return {uid,email,name,token:r.idToken,role};
}
const employer=await account('employer','Synthetic Employer');
const college=await account('institution','Synthetic College');
const student=await account('student','Synthetic Student');
const outsider=await account('employer','Synthetic Outsider','2');
await seed('employers/'+employer.uid,{id:employer.uid,name:employer.name,logo:'E',industry:'Test',headquarters:'Test',verified:true,verificationStatus:'verified',openRequirementsCount:0,totalHiresCount:0,reputationScore:0});
await seed('employers/'+outsider.uid,{id:outsider.uid,name:outsider.name,logo:'E',industry:'Test',headquarters:'Test',verified:true,verificationStatus:'verified',openRequirementsCount:0,totalHiresCount:0,reputationScore:0});
await seed('institutions/'+college.uid,{id:college.uid,name:college.name,code:'TEST',type:'Autonomous College',state:'Test',city:'Test',empanelmentStatus:'empanelled',placementOfficerName:'Test officer',placementOfficerEmail:college.email,placementOfficerPhone:'',totalStudentSupply:1,responseRatePercent:0,historicalOfferRatePercent:0,historicalJoiningRatePercent:0,overallRating:0,specializations:[],batches:[]});
await seed('students/'+student.uid,{id:student.uid,name:student.name,email:student.email,avatar:'',candidateType:'empanelled_campus',isEmpanelledCampus:true,institutionId:college.uid,institutionName:college.name,institutionCode:'TEST',program:'Test',branch:'Test',graduationYear:2027,cgpa:8,state:'Test',institutionVerificationStatus:'verified',platformVerificationStatus:'pending',skills:[],projects:[],internships:[],assessments:[],preferences:{targetRoles:[],preferredLocations:[],minSalaryLPA:0,employmentTypes:['Full-Time']},availability:'actively_seeking',placementStatus:'in_process',campaignConsents:{}});
const req={id:'test-requirement',employerId:employer.uid,employerName:employer.name,role:'Synthetic Analyst',vacancies:1,education:[],graduationYears:[2027],branches:[],requiredSkills:[],experienceLevel:'Entry',locations:['Test city'],salaryMinLPA:8,salaryMaxLPA:12,joiningWindow:'Later',assessmentRequirements:[],selectionProcess:[],candidateProfileSummary:'Synthetic',createdAt:new Date().toISOString(),status:'active'};
const campaign={id:'test-campaign',requirementId:req.id,requirement:req,title:'Synthetic campaign',employerId:employer.uid,employerName:employer.name,createdAt:req.createdAt,status:'active',funnel:{requiredVacancies:1,institutionsInvited:0,institutionsAccepted:0,studentsInvited:0,applicationsConsented:0,assessmentsCompleted:0,shortlisted:0,interviewed:0,offersMade:0,offersAccepted:0,joined:0},targetedInstitutionIds:[],callsSent:[],candidateOpportunities:[]};
let seq=0;
async function step(actor,action,payload,expected=[200,201]) {
  return json(app+'/api/recruitment/transitions',{method:'POST',headers:headers(actor.token),body:JSON.stringify({action,requestId:'acceptance-'+String(++seq).padStart(5,'0'),payload})},expected);
}
await step(employer,'CREATE_REQUIREMENT_CAMPAIGN',{requirement:req,campaign});
const call={id:'test-call',campaignId:campaign.id,employerId:employer.uid,employerName:employer.name,institutionId:college.uid,institutionName:college.name,role:req.role,vacanciesRequested:1,salaryLPA:'8-12 LPA',locations:req.locations,joiningWindow:'Later',deadline:'2099-12-31',status:'pending',createdAt:req.createdAt};
await step(employer,'SEND_CALLS',{campaignId:campaign.id,calls:[call]});
await step(college,'RESPOND_CALL',{callId:call.id,status:'accepted',offeredCandidatesCount:1});
const activation=await step(college,'ACTIVATE_STUDENTS',{callId:call.id,studentIds:[student.uid]});
const opportunityId=activation.ids.find(id=>id!==campaign.id);
assert.ok(opportunityId);
await step(student,'GLOBAL_CONSENT',{approved:true,campaignIds:[campaign.id]});
await step(student,'UPDATE_CONSENT_SCOPE',{campaignId:campaign.id,scopeKey:'academicDataShared',value:true});
await step(student,'SUBMIT_CONSENT',{opportunityId,consented:true});
await step(student,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'assessment_completed',meta:{assessmentResponse:'Synthetic review response',assessmentTemplateId:'test-template',shareAssessmentResponse:false}});
await json(app+'/api/candidate-projections',{method:'POST',headers:headers(outsider.token),body:JSON.stringify({campaignId:campaign.id,studentId:student.uid,requestId:'outsider-test'})},403);

await mkdir('acceptance-evidence',{recursive:true});
const browser=await chromium.launch({headless:true});
const viewportResults=[];
try {
  for (const actor of [employer,college,student]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route('**/*',route => {
      const url=new URL(route.request().url());
      return ['127.0.0.1','localhost'].includes(url.hostname) || ['data:','blob:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(app,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Sign In',exact:true}).first().click();
    await page.locator('input[type=email]').fill(actor.email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await page.getByRole('heading',{name:actor.name,exact:true}).waitFor({timeout:30000});
    for(const width of [320,375,390,430]) {
      await page.setViewportSize({width,height:844});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
      viewportResults.push({role:actor.role,width,overflow});
      await page.screenshot({path:'acceptance-evidence/'+actor.role+'-'+width+'.png',fullPage:true});
    }
    assert.deepEqual(errors,[],actor.role+' uncaught browser errors');
    if(actor.role==='employer'){
      await page.locator('#tab-level2').click();
      await page.getByRole('button',{name:'Check consent & view profile'}).click();
      await page.getByText(student.name,{exact:true}).waitFor({timeout:30000});
      await page.getByRole('button',{name:'Hide profile'}).click();
      await step(student,'GLOBAL_CONSENT',{approved:false,campaignIds:[campaign.id]});
      await page.getByRole('button',{name:'Check consent & view profile'}).click();
      await page.getByText('Profile unavailable:',{exact:false}).waitFor({timeout:30000});
      assert.equal(await page.getByText(student.name,{exact:true}).count(),0);
      await step(employer,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'shortlisted'},403);
      await step(student,'GLOBAL_CONSENT',{approved:true,campaignIds:[campaign.id]});
    }
    await context.close();
  }
  await step(employer,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'shortlisted'});
  await step(employer,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'interviewing'});
  await step(employer,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'offered',meta:{offer:{salaryLPA:10,terms:'Synthetic offer'}}});
  await step(student,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'accepted'});
  await step(employer,'ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'joined'});
  const result=await json(dbURL+'/opportunities/'+opportunityId,{headers:headers('owner')});
  assert.equal(result.fields.stage.stringValue,'joined');
  assert.equal(result.fields.joinedSalaryLPA.integerValue,'10');
  await writeFile('acceptance-evidence/viewport-results.json',JSON.stringify(viewportResults,null,2));
  console.log('Synthetic Auth + Firestore + HTTP lifecycle passed; viewport observations:',viewportResults);
  assert.ok(viewportResults.every(r=>!r.overflow),'Mobile page overflow observed; review evidence');
} finally { await browser.close(); }
