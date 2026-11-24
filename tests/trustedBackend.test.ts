import { createHash as hashForFixture } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = 'nexustalent-test';
process.env.GOOGLE_OAUTH_ACCESS_TOKEN = 'test-token';
const backend = await import('../server/trustedBackend');
type Doc = Record<string, any>;
function individualFixture(campaignId:string,studentId:string,employerId:string,institutionId:string,callId='call-individual'){
 const id=hashForFixture('sha256').update(callId+':'+studentId).digest('hex');
 return {id,callsSent:[{id:callId,institutionId}],records:{['opportunities/'+id]:{id,callId,campaignId,studentId,employerId,institutionId,stage:'invited'}}};
}

const firestoreValue = (value: any): any => value === null ? { nullValue: 'NULL_VALUE' } : typeof value === 'string' ? { stringValue: value } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { integerValue: String(value) } : Array.isArray(value) ? { arrayValue: { values: value.map(firestoreValue) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, firestoreValue(v)])) } };
const firestoreDoc = (path: string, data: Doc) => ({ name: `projects/nexustalent-test/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, firestoreValue(v)])) });
function installMock(docs: Record<string, Doc | null>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  (globalThis as any).fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith(':beginTransaction')) return new Response(JSON.stringify({ transaction: `tx-${calls.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':commit')) return new Response(JSON.stringify({ commitTime: new Date().toISOString(), writeResults: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':rollback')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    if(url.endsWith(':batchGet')){
      const body=JSON.parse(String(init?.body));
      assert.ok(body.transaction);
      assert.equal(body.documents.length,1);
      const document=body.documents[0],key=document.split('/documents/')[1],data=docs[key];
      return new Response(JSON.stringify([data?{found:firestoreDoc(key,data)}:{missing:document}]),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response('{}',{status:404});
  };
  return calls;
}

test('CREATE_REQUIREMENT_CAMPAIGN commits requirement, campaign and audit atomically', async () => {
  const calls = installMock({ 'users/emp-1': { uid:'emp-1',role: 'employer' }, 'employers/emp-1': { name: 'Employer', verificationStatus:'verified' } });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'req-test-001', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: { requirement: { id: 'req-0001', employerId: 'emp-1', role: 'Analyst', vacancies:1, salaryMinLPA:8,salaryMaxLPA:10 }, campaign: { id: 'camp-0001', requirementId: 'req-0001', employerId: 'emp-1', funnel: {joined:999}, targetedInstitutionIds: ['forged'], callsSent:[{id:'forged'}],candidateOpportunities:[{studentName:'private'}] } } });
  assert.equal(result.replayed, false); assert.deepEqual(result.ids, ['req-0001', 'camp-0001']);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); assert.equal(body.writes.length, 3); assert.equal(body.writes.filter((w: any) => w.update.name.includes('/auditEvents/')).length, 1);
  const fields=body.writes.find((w:any)=>w.update.name.endsWith('/campaigns/camp-0001')).update.fields;
  assert.equal(fields.funnel.mapValue.fields.joined.integerValue,'0');
  assert.equal(fields.targetedInstitutionIds.arrayValue.values.length,0);
  assert.equal(fields.callsSent.arrayValue.values.length,0);
  assert.equal(fields.candidateOpportunities.arrayValue.values.length,0);
});

test('same requestId is replay-safe and performs no second commit', async () => {
  const crypto = await import('node:crypto'); const realId = crypto.createHash('sha256').update('replay-001:emp-1:CREATE_REQUIREMENT_CAMPAIGN').digest('hex');
  const calls = installMock({ [`auditEvents/${realId}`]: { immutable: true } });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'replay-001', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} });
  assert.equal(result.replayed, true); assert.equal(calls.filter(c => c.url.includes(':commit')).length, 0);
});

test('institution cannot execute employer-only transition', async () => {
  installMock({ 'users/inst-1': { uid:'inst-1',role: 'institution' } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'inst-1', requestId: 'deny-test-1', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} }), /not authorized/);
});

test('GLOBAL_CONSENT re-reads authoritative campaigns and rejects forged campaign metadata', async () => {
  const invitation=individualFixture('camp-real','stu-1','emp-real','inst-1');
  const calls = installMock({
    ...invitation.records,
    'users/stu-1': { uid:'stu-1',role: 'student' },
    'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} },
    'campaigns/camp-real': { callsSent:invitation.callsSent, id: 'camp-real', employerId: 'emp-real', employerName: 'Real Employer', requirement: { role: 'Engineer', salaryMinLPA: 8, salaryMaxLPA: 12 }, targetedInstitutionIds: ['inst-1'] },
  });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'stu-1', requestId: 'global-consent-1', action: 'GLOBAL_CONSENT', payload: { approved: true, campaignIds: ['camp-real'], campaigns: [{ id: 'camp-real', employerId: 'attacker', employerName: 'Forged Employer' }] } });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body));
  const studentWrite = body.writes.find((w: any) => String(w.update?.name || '').includes('/students/stu-1')); assert.ok(studentWrite);
  const fields = studentWrite.update.fields.campaignConsents.mapValue.fields['camp-real'].mapValue.fields;
  assert.equal(fields.employerId.stringValue, 'emp-real'); assert.equal(fields.employerName.stringValue, 'Real Employer');
  for (const scope of ['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared']) assert.equal(fields[scope].booleanValue, false);
});

test('GLOBAL_CONSENT rejects campaigns not targeted to the student institution', async () => {
  installMock({ 'users/stu-1': { uid:'stu-1',role: 'student' }, 'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} }, 'campaigns/camp-other': { employerId: 'emp-real', targetedInstitutionIds: ['inst-2'], requirement: { role: 'Engineer' } } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'stu-1', requestId: 'global-consent-2', action: 'GLOBAL_CONSENT', payload: { approved: true, campaignIds: ['camp-other'] } }), /not eligible/);
});

test('candidate projection enforces consent and minimizes unapproved fields', async () => {
  const invitation=individualFixture('camp-1','stu-1','emp-1','inst-1');
  const calls = installMock({
    ...invitation.records,
    'users/emp-1': { uid:'emp-1',role: 'employer' },
    'campaigns/camp-1': { callsSent:invitation.callsSent, employerId: 'emp-1', requirement: { role: 'Analyst' } },
    'students/stu-1': { name: 'Candidate', institutionId: 'inst-1', email: 'candidate@example.com', program: 'B.Tech', branch: 'CSE', graduationYear: 2027, cgpa: 9.1, skills: [{ name: 'JS', category: 'technical', score: 90, badge: 'Gold' }], projects: [{ repo: 'secret-repo' }], campaignConsents: { 'camp-1': { opportunityId:invitation.id,status: 'approved', employerId: 'emp-1', updatedAt: '2026-11-20T00:00:00.000Z', academicDataShared: true, skillBenchmarksShared: true, projectReposShared: false, contactInfoShared: false } } },
  });
  const result = await backend.provisionCandidateProjection({ actorUid: 'emp-1', campaignId: 'camp-1', studentId: 'stu-1', requestId: 'projection-1' });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); const projectionWrite = body.writes.find((w: any) => w.update.name.includes('/candidateProfiles/')); assert.ok(projectionWrite);
  const fields = projectionWrite.update.fields; assert.ok(fields.program); assert.ok(fields.verifiedSkills); assert.equal(fields.projects, undefined); assert.equal(fields.email, undefined);
});

test('ADVANCE_CANDIDATE_STAGE counts a stage only once per opportunity', async () => {
  const calls = installMock({
    'users/stu-1': { uid:'stu-1',role: 'student' },
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'offered', offerRecordId: 'offer-opp-1', funnelCountedStages: {} },
    'offers/offer-opp-1': { id: 'offer-opp-1', opportunityId: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', currency: 'INR', status: 'issued', salaryLPA: 10 },
    'campaigns/camp-1': { id: 'camp-1', funnel: { offersMade: 1, offersAccepted: 0 }, requirement: {} },
    'students/stu-1': { placementStatus: 'in_process' },
  });
  const first = await backend.executeRecruitmentTransition({ actorUid: 'stu-1', requestId: 'stage-001', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-1', nextStage: 'accepted' } });
  assert.equal(first.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); const campaignWrite = body.writes.find((w: any) => w.update.name.endsWith('/campaigns/camp-1')); assert.equal(campaignWrite.update.fields.funnel.mapValue.fields.offersAccepted.integerValue, '1');
  assert.equal(body.writes.find((w: any) => w.update.name.endsWith('/opportunities/opp-1')).update.fields.funnelCountedStages.mapValue.fields.accepted.booleanValue, true);
});


test('candidate stage transitions reject illegal jumps and require role-appropriate evidence', async () => {
  installMock({
    'users/emp-1': { uid:'emp-1',role: 'employer' },
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'invited' },
    'campaigns/camp-1': { id: 'camp-1', funnel: {} },
  });
  await assert.rejects(
    () => backend.executeRecruitmentTransition({
      actorUid: 'emp-1', requestId: 'stage-illegal-1', action: 'ADVANCE_CANDIDATE_STAGE',
      payload: { opportunityId: 'opp-1', nextStage: 'offered' },
    }),
    /Invalid transition/
  );
  await assert.rejects(
    () => backend.executeRecruitmentTransition({
      actorUid: 'emp-1', requestId: 'stage-illegal-2', action: 'ADVANCE_CANDIDATE_STAGE',
      payload: { opportunityId: 'opp-1', nextStage: 'assessment_completed' },
    }),
    /Invalid transition/
  );
});

test('joining is the placement outcome; accepting an offer does not mark the student placed', async () => {
  const calls = installMock({
    'users/stu-1': { uid:'stu-1',role: 'student' },
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'offered', offerRecordId: 'offer-opp-1' },
    'offers/offer-opp-1': { id: 'offer-opp-1', opportunityId: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', currency: 'INR', status: 'issued', salaryLPA: 10 },
    'campaigns/camp-1': { id: 'camp-1', funnel: {} },
    'students/stu-1': { placementStatus: 'in_process' },
  });
  const result = await backend.executeRecruitmentTransition({
    actorUid: 'stu-1', requestId: 'stage-accepted-1', action: 'ADVANCE_CANDIDATE_STAGE',
    payload: { opportunityId: 'opp-1', nextStage: 'accepted' },
  });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.some((w: any) => w.update.name.endsWith('/students/stu-1')), false);
});


test('offer issuance rejects missing, invented or unsafe terms without a transaction commit', async () => {
  const calls=installMock({
    'users/emp-offer':{uid:'emp-offer',role:'employer'},
    'opportunities/opp-offer':{id:'opp-offer',employerId:'emp-offer',institutionId:'inst-offer',studentId:'stu-offer',campaignId:'camp-offer',stage:'interviewing',joiningWindow:'Employer-confirmed window'},
    'students/stu-offer':{campaignConsents:{'camp-offer':{status:'approved',employerId:'emp-offer',updatedAt:'2026-11-23T00:00:00Z'}}},
    'campaigns/camp-offer':{id:'camp-offer',funnel:{}},
  });
  const invalid=[
    {salaryLPA:8},
    {salaryLPA:8,terms:'  '},
    {salaryLPA:8,terms:'Synthetic terms',offerLetterUrl:'http://example.test/offer'},
    {salaryLPA:8,terms:'Synthetic terms',offerLetterUrl:'https://username:password@example.test/offer'},
    {salaryLPA:8,terms:'X'.repeat(4001)},
  ];
  for(let i=0;i<invalid.length;i++){
    await assert.rejects(()=>backend.executeRecruitmentTransition({
      actorUid:'emp-offer',requestId:'reject-offer-'+i,action:'ADVANCE_CANDIDATE_STAGE',
      payload:{opportunityId:'opp-offer',nextStage:'offered',meta:{offer:invalid[i]}},
    }),/employer-authored offer terms|Invalid HTTPS offer letter URL/);
  }
  assert.equal(calls.filter(c=>c.url.includes(':commit')).length,0);
});
test('canonical recruitment transition matrix accepts every permitted edge', async () => {
  const cases = [
    ['assessment_pending','assessment_completed','stu-1', { nextStage: 'assessment_completed', meta: { assessmentResponse: 'I would validate the requirements, identify constraints, propose a measurable solution, test the result, and document the evidence and trade-offs.', assessmentTemplateId: 'engineering' } }],
    ['assessment_completed','shortlisted','emp-1', { nextStage: 'shortlisted' }],
    ['shortlisted','interviewing','emp-1', { nextStage: 'interviewing' }],
    ['interviewing','offered','emp-1', { nextStage: 'offered', meta: { offer: { salaryLPA: 8, terms: 'Test offer' } } }],
    ['offered','accepted','stu-1', { nextStage: 'accepted' }],
    ['accepted','joined','emp-1', { nextStage: 'joined' }],
    ['invited','declined','stu-1', { nextStage: 'declined' }],
    ['assessment_completed','rejected','emp-1', { nextStage: 'rejected' }],
    ['shortlisted','rejected','emp-1', { nextStage: 'rejected' }],
    ['interviewing','rejected','emp-1', { nextStage: 'rejected' }],
    ['offered','rejected','emp-1', { nextStage: 'rejected' }],
    ['accepted','rejected','emp-1', { nextStage: 'rejected' }],
  ] as const;

  for (let i = 0; i < cases.length; i += 1) {
    const [from, , actorUid, payload] = cases[i];
    installMock({
      [`users/${actorUid}`]: { uid:actorUid,role: actorUid.startsWith('stu-') ? 'student' : 'employer' },
      'opportunities/opp-matrix': {
        id: 'opp-matrix', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1',
        campaignId: 'camp-1', stage: from, offerRecordId: 'offer-opp-matrix',
      },
      'campaigns/camp-1': { id: 'camp-1', funnel: {} },
      'students/stu-1': { placementStatus: 'in_process', campaignConsents: { 'camp-1': { status: 'approved', employerId: 'emp-1', updatedAt: '2026-11-20T00:00:00Z' } } },
      'offers/offer-opp-matrix': { id: 'offer-opp-matrix', opportunityId: 'opp-matrix', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', currency: 'INR', status: from === 'accepted' ? 'accepted' : 'issued', salaryLPA: 8 },
    });
    await assert.doesNotReject(() => backend.executeRecruitmentTransition({
      actorUid, requestId: `matrix-${i.toString().padStart(2, '0')}`, action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-matrix', ...payload },
    }));
  }
});


test('trusted profile mutations enforce student ownership and write an audit event', async () => {
  const calls = installMock({ 'users/stu-1': { uid:'stu-1',role: 'student' }, 'students/stu-1': { globalDataPrivacy: { allowUnsolicitedPings: false } } });
  const result = await backend.executeTrustedProfileMutation({ actorUid: 'stu-1', requestId: 'privacy-test-1', action: 'UPDATE_GLOBAL_PRIVACY', payload: { settings: { allowUnsolicitedPings: true } } });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.length, 2);
  const studentWrite = body.writes.find((w: any) => String(w.update?.name || '').endsWith('/students/stu-1'));
  assert.equal(studentWrite?.update?.fields?.globalDataPrivacy?.mapValue?.fields?.allowUnsolicitedPings?.booleanValue, true);
});

test('verified skill mutation requires super admin and stamps the actual verifier', async () => {
  installMock({ 'users/stu-1': { uid:'stu-1',role: 'student' }, 'students/stu-1': { skills: [] } });
  await assert.rejects(() => backend.executeTrustedProfileMutation({ actorUid: 'stu-1', requestId: 'skill-deny-1', action: 'ADD_VERIFIED_SKILL', payload: { studentId: 'stu-1', skill: { name: 'SQL', category: 'technical', score: 90, badge: 'Gold' } } }), /Super admin authorization/);
  const calls = installMock({ 'users/admin-1': { uid:'admin-1',role: 'super_admin' }, 'students/stu-1': { skills: [] } });
  const result = await backend.executeTrustedProfileMutation({ actorUid: 'admin-1', adminClaim:true, requestId: 'skill-admin-1', action: 'ADD_VERIFIED_SKILL', payload: { studentId: 'stu-1', skill: { name: 'SQL', category: 'technical', score: 90, badge: 'Gold', verifiedBy: 'forged' } } });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const fields = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-1')).update.fields.skills.arrayValue.values[0].mapValue.fields;
  assert.equal(fields.verifiedBy.stringValue, 'admin-1');
});

test('direct student registration cannot self-verify platform credentials', async () => {
  const calls = installMock({ 'users/stu-2': { uid:'stu-2',role: 'student', email:'candidate@example.com' } });
  await backend.executeTrustedProfileMutation({
    actorUid: 'stu-2', requestId: 'register-stu-2', action: 'REGISTER_INDEPENDENT_CANDIDATE',
    payload: { candidateData: { id: 'attacker-id', name: 'Candidate', email: 'candidate@example.com', program: 'B.Tech', branch: 'CSE', independentCredentials: { collegeName: 'College', state: 'MP', city: 'Indore', degree: 'B.Tech', branch: 'CSE', graduationYear: 2027, cgpa: 8.5, idProofNumber:'must-not-store' }, platformVerificationStatus: 'verified',campaignConsents:{forged:{status:'approved'}},skills:[{badge:'Gold'}],evidenceIds:['forged'] } }
  });
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const studentWrite = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-2'));
  assert.equal(studentWrite.update.fields.platformVerificationStatus.stringValue, 'pending');
  const f=studentWrite.update.fields;
  assert.equal(f.independentCredentials.mapValue.fields.idProofNumber,undefined);
  assert.deepEqual(f.campaignConsents.mapValue.fields,{});
  assert.deepEqual(f.skills.arrayValue.values,[]);
  assert.deepEqual(f.evidenceIds.arrayValue.values,[]);
  assert.equal(f.globalDataPrivacy.mapValue.fields.allowUnsolicitedPings.booleanValue,false);
  assert.equal(f.globalDataPrivacy.mapValue.fields.anonymizeProfileUntilConsent.booleanValue,true);
  assert.equal(f.globalDataPrivacy.mapValue.fields.shareVerifiedBadgesGlobally.booleanValue,false);
  assert.equal(studentWrite.update.name.endsWith('/students/stu-2'), true);
});


test('student evidence submission cannot claim an authoritative source', async () => {
  installMock({ 'users/stu-1': { uid:'stu-1',role: 'student' }, 'students/stu-1': { id: 'stu-1' } });
  await assert.rejects(() => backend.submitCareerEvidence({
    actorUid: 'stu-1', studentId: 'stu-1', requestId: 'evidence-source-1', evidenceId: 'evidence-1',
    claimType: 'education', claimKey: 'degree', claimValue: 'B.Tech', sourceType: 'institution', sourceId: 'fake-institution'
  }), /student_submission/);
});

test('Career Passport verification requires authoritative provenance and records rejection reason', async () => {
  let calls = installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'careerEvidence/e-1': { id: 'e-1', studentId: 'stu-1', status: 'under_review', sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'old' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' }
  });
  const result = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-review-1', action: 'REVIEW_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-1', status: 'rejected', rejectionReason: 'Source document could not be validated.' }
  });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const fields = body.writes.find((w: any) => w.update.name.endsWith('/careerEvidence/e-1')).update.fields;
  assert.equal(fields.status.stringValue, 'rejected');
  assert.equal(fields.rejectionReason.stringValue, 'Source document could not be validated.');
});


test('Career Passport evidence lifecycle supports expiry, re-verification, and student disputes', async () => {
  let calls = installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'users/stu-1': { uid:'stu-1',role: 'student' },
    'students/stu-1': { id: 'stu-1', evidenceIds: [] },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-2': {
      id: 'e-2', studentId: 'stu-1', status: 'under_review',
      sourceType: 'institution', sourceId: 'inst-1', expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lineageHash: 'seed'
    }
  });
  await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-verify-2', action: 'REVIEW_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-2', status: 'verified' }
  });
  let commit = calls.filter(c => c.url.includes(':commit')).at(-1);
  assert.ok(commit);
  let body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.some((w: any) => w.update.name.endsWith('/students/stu-1')), true);

  calls = installMock({
    'users/stu-1': { uid:'stu-1',role: 'student' },
    'students/stu-1': { id: 'stu-1' },
    'careerEvidence/e-2': {
      id: 'e-2', studentId: 'stu-1', status: 'verified', sourceType: 'institution', sourceId: 'inst-1',
      expiresAt: new Date(Date.now() + 86400000).toISOString(), lineageHash: 'seed'
    }
  });
  const disputed = await backend.executeTrustedProfileMutation({
    actorUid: 'stu-1', requestId: 'evidence-dispute-2', action: 'DISPUTE_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-2', reason: 'The verified record contains an incorrect claim value.' }
  });
  assert.equal(disputed.replayed, false);

  calls = installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-2': {
      id: 'e-2', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const resolved = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-resolve-2', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
    payload: { evidenceId: 'e-2', outcome: 'reopen', resolution: 'Dispute accepted; evidence requires authoritative re-review.' }
  });
  assert.equal(resolved.replayed, false);
  commit = calls.filter(c => c.url.includes(':commit')).at(-1);
  assert.ok(commit);
  body = JSON.parse(String(commit?.init?.body));
  const fields = body.writes.find((w: any) => w.update.name.endsWith('/careerEvidence/e-2')).update.fields;
  assert.equal(fields.status.stringValue, 'under_review');
  assert.equal(fields.disputeStatus.stringValue, 'resolved');
});

test('Career Passport dispute uphold preserves verified evidence and reject records the rejection', async () => {
  const calls = installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'careerEvidence/e-uphold': {
      id: 'e-uphold', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const upheld = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-uphold-1', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
    payload: { evidenceId: 'e-uphold', outcome: 'uphold', resolution: 'Original verification remains supported by the authoritative evidence.' }
  });
  assert.equal(upheld.replayed, false);
  let commit = calls.filter(c => c.url.includes(':commit')).at(-1);
  assert.ok(commit);
  let body = JSON.parse(String(commit?.init?.body));
  let fields = body.writes.find((w: any) => w.update.name.endsWith('/careerEvidence/e-uphold')).update.fields;
  assert.equal(fields.status.stringValue, 'verified');
  assert.equal(fields.disputeStatus.stringValue, 'resolved');

  const rejectCalls = installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'careerEvidence/e-reject': {
      id: 'e-reject', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const rejected = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-reject-1', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
    payload: { evidenceId: 'e-reject', outcome: 'reject', resolution: 'The disputed claim cannot be supported by the authoritative record.' }
  });
  assert.equal(rejected.replayed, false);
  commit = rejectCalls.filter(c => c.url.includes(':commit')).at(-1);
  assert.ok(commit);
  body = JSON.parse(String(commit?.init?.body));
  fields = body.writes.find((w: any) => w.update.name.endsWith('/careerEvidence/e-reject')).update.fields;
  assert.equal(fields.status.stringValue, 'rejected');
  assert.equal(fields.disputeStatus.stringValue, 'resolved');
  assert.equal(fields.rejectionReason.stringValue, 'The disputed claim cannot be supported by the authoritative record.');
});


test('Career Passport expiry cannot be forced before expiry time', async () => {
  installMock({
    'users/admin-1': { uid:'admin-1',role: 'super_admin' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-3': {
      id: 'e-3', studentId: 'stu-1', status: 'verified',
      sourceType: 'institution', sourceId: 'inst-1',
      expiresAt: new Date(Date.now() + 86400000).toISOString(), lineageHash: 'seed'
    }
  });
  await assert.rejects(() => backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', adminClaim:true, requestId: 'evidence-expiry-3', action: 'REVIEW_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-3', status: 'expired' }
  }), /cannot be expired/);
});


test('joined outcome creates an idempotent five-percent success fee', async () => {
  const calls = installMock({
    'users/emp-1': { uid:'emp-1',role: 'employer' },
    'opportunities/opp-fee': { id: 'opp-fee', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'accepted', employerName: 'Employer', salaryLPA: 2, offerRecordId: 'offer-opp-fee' },
    'offers/offer-opp-fee': { id: 'offer-opp-fee', opportunityId: 'opp-fee', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', currency: 'INR', status: 'accepted', salaryLPA: 10 },
    'campaigns/camp-1': { id: 'camp-1', funnel: {} },
    'students/stu-1': { placementStatus: 'in_process' },
  });
  await backend.executeRecruitmentTransition({
    actorUid: 'emp-1', requestId: 'joined-fee-1', action: 'ADVANCE_CANDIDATE_STAGE',
    payload: { opportunityId: 'opp-fee', nextStage: 'joined' },
  });
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const fee = body.writes.find((w: any) => w.update.name.includes('/successFees/'));
  assert.ok(fee);
  assert.equal(fee.update.fields.feeRateBps.integerValue, '500');
  assert.equal(fee.update.fields.compensationMinor.integerValue, '100000000');
  assert.equal(fee.update.fields.feeAmountMinor.integerValue, '5000000');
  const student = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-1'));
  assert.equal(student.update.fields.placedSalaryLPA.integerValue, '10');
  const joinedOffer = body.writes.find((w: any) => w.update.name.endsWith('/offers/offer-opp-fee'));
  assert.equal(joinedOffer.update.fields.status.stringValue, 'joined');
});

test('candidate projection exposes only current verified evidence and excludes expired or pending evidence', async () => {
  const invitation=individualFixture('camp-evidence','stu-evidence','emp-1','inst-1');
  const calls = installMock({
    ...invitation.records,
    'users/emp-1': { uid:'emp-1',role: 'employer' },
    'campaigns/camp-evidence': { callsSent:invitation.callsSent, employerId: 'emp-1', requirement: { role: 'Analyst' } },
    'students/stu-evidence': {
      name: 'Candidate',
      institutionId: 'inst-1',
      campaignConsents: {
        'camp-evidence': {
          opportunityId:invitation.id,status: 'approved',
          employerId: 'emp-1',
          updatedAt: '2026-11-20T00:00:00.000Z',
          skillBenchmarksShared: true,
          academicDataShared: false,
          projectReposShared: false,
          contactInfoShared: false,
        },
      },
      evidenceIds: ['ev-current', 'ev-expired', 'ev-pending'],
    },
    'careerEvidence/ev-current': {
      id: 'ev-current', studentId: 'stu-evidence', claimType: 'skill',
      claimKey: 'sql', claimValue: 'Advanced SQL', sourceType: 'institution',
      sourceId: 'inst-1', status: 'verified',
      reviewedAt: '2026-10-08T00:00:00.000Z',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    'careerEvidence/ev-expired': {
      id: 'ev-expired', studentId: 'stu-evidence', claimType: 'skill',
      claimKey: 'python', claimValue: 'Python', sourceType: 'institution',
      sourceId: 'inst-1', status: 'verified',
      reviewedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    },
    'careerEvidence/ev-pending': {
      id: 'ev-pending', studentId: 'stu-evidence', claimType: 'skill',
      claimKey: 'javascript', claimValue: 'JavaScript', sourceType: 'student_submission',
      status: 'under_review',
    },
  });
  const result = await backend.provisionCandidateProjection({
    actorUid: 'emp-1', campaignId: 'camp-evidence', studentId: 'stu-evidence',
    requestId: 'projection-evidence-1',
  });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const projectionWrite = body.writes.find((w: any) => w.update.name.includes('/candidateProfiles/'));
  assert.ok(projectionWrite);
  const fields = projectionWrite.update.fields;
  const verifiedEvidence = fields.verifiedEvidence.arrayValue.values.map((v: any) => v.mapValue.fields.id.stringValue);
  assert.deepEqual(verifiedEvidence, ['ev-current']);
  const verifiedSkills = fields.verifiedSkills.arrayValue.values.map((v: any) => v.mapValue.fields.evidenceId.stringValue);
  assert.deepEqual(verifiedSkills, ['ev-current']);
});

test('projection refresh replaces an existing snapshot and excludes out-of-scope verified evidence', async () => {
  const { createHash } = await import('node:crypto');
  const projectionId = createHash('sha256').update('emp-privacy:camp-privacy:stu-privacy').digest('hex');
  const invitation=individualFixture('camp-privacy','stu-privacy','emp-privacy','inst-1');
  const calls = installMock({
    ...invitation.records,
    'users/emp-privacy': { uid:'emp-privacy',role: 'employer' },
    'campaigns/camp-privacy': { callsSent:invitation.callsSent, employerId: 'emp-privacy', requirement: { role: 'Analyst' } },
    'students/stu-privacy': { institutionId:'inst-1',name: 'Synthetic student', email: 'private@example.test', program: 'Private degree', evidenceIds: ['private-education', 'allowed-skill', 'private-identity'], campaignConsents: { 'camp-privacy': { opportunityId:invitation.id,status: 'approved', employerId: 'emp-privacy', updatedAt: '2026-11-20T00:01:00.000Z', academicDataShared: false, skillBenchmarksShared: true, contactInfoShared: false, projectReposShared: false } } },
    ['candidateProfiles/' + projectionId]: { email: 'old@example.test', program: 'old degree', projectionVersion: 2 },
    'careerEvidence/private-education': { id: 'private-education', studentId: 'stu-privacy', claimType: 'education', claimKey: 'degree', claimValue: 'Private', sourceType: 'institution', status: 'verified' },
    'careerEvidence/allowed-skill': { id: 'allowed-skill', studentId: 'stu-privacy', claimType: 'skill', claimKey: 'SQL', claimValue: 'Advanced', sourceType: 'institution', status: 'verified' },
    'careerEvidence/private-identity': { id: 'private-identity', studentId: 'stu-privacy', claimType: 'identity', claimKey: 'identity', claimValue: 'Private', sourceType: 'platform', status: 'verified' },
  });
  await backend.provisionCandidateProjection({ actorUid: 'emp-privacy', campaignId: 'camp-privacy', studentId: 'stu-privacy', requestId: 'projection-refresh-1' });
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const writes = JSON.parse(String(commit.init?.body)).writes;
  const projection = writes.find((w: any) => w.update.name.endsWith('/' + projectionId));
  assert.ok(projection);
  assert.equal(projection.updateMask, undefined, 'full replacement must not retain withdrawn fields');
  const fields = projection.update.fields;
  assert.equal(fields.email, undefined);
  assert.equal(fields.program, undefined);
  assert.equal(fields.projectionVersion.integerValue, '3');
  assert.equal(fields.consentUpdatedAt.stringValue, '2026-11-20T00:01:00.000Z');
  assert.deepEqual(fields.verifiedEvidence.arrayValue.values.map((v: any) => v.mapValue.fields.id.stringValue), ['allowed-skill']);
});

test('projection rejects legacy consent without a current timestamp', async () => {
  const calls = installMock({
    'users/emp-legacy': { uid:'emp-legacy',role: 'employer' },
    'campaigns/camp-legacy': { employerId: 'emp-legacy' },
    'students/stu-legacy': { campaignConsents: { 'camp-legacy': { status: 'approved', employerId: 'emp-legacy' } } },
  });
  await assert.rejects(() => backend.provisionCandidateProjection({ actorUid: 'emp-legacy', campaignId: 'camp-legacy', studentId: 'stu-legacy', requestId: 'legacy-consent-01' }), /consent is required/);
  assert.equal(calls.some(c => c.url.includes(':commit')), false);
});

test('trusted recruitment uses server OAuth and does not forward the caller Firebase token', async () => {
  const calls = installMock({ 'users/emp-service': { uid:'emp-service',role: 'employer' }, 'employers/emp-service':{name:'Service Employer',verificationStatus:'verified'} });
  const result = await backend.executeRecruitmentTransition({
    actorUid: 'emp-service', firebaseIdToken: 'synthetic-user-id-token',
    requestId: 'service-identity-001', action: 'CREATE_REQUIREMENT_CAMPAIGN',
    payload: { requirement: { id: 'req-service', employerId: 'emp-service', role: 'Analyst',vacancies:1,salaryMinLPA:8,salaryMaxLPA:10 }, campaign: { id: 'camp-service', requirementId: 'req-service', employerId: 'emp-service', funnel: {}, targetedInstitutionIds: [] } },
  });
  assert.equal(result.replayed, false);
  assert.ok(calls.some(c => c.url.includes(':commit')));
  for (const call of calls) {
    assert.equal(new Headers(call.init?.headers).get('authorization'), 'Bearer test-token');
  }
});

test('joining refuses a missing or unrelated accepted offer before creating a fee', async () => {
  const base = {
    'users/emp-1': { uid:'emp-1',role: 'employer' },
    'opportunities/opp-foreign': { id: 'opp-foreign', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'accepted', offerRecordId: 'offer-foreign' },
    'campaigns/camp-1': { id: 'camp-1', funnel: {} },
  };
  for (const record of [null, { id: 'offer-foreign', opportunityId: 'different-opportunity', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', currency: 'INR', status: 'accepted', salaryLPA: 10 }]) {
    const calls = installMock({ ...base, 'offers/offer-foreign': record });
    await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'join-foreign-1', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-foreign', nextStage: 'joined' } }), /not found|Invalid offer ownership/);
    assert.equal(calls.some(c => c.url.includes(':commit')), false);
  }
});

test('assessment records actual submitted evidence without inventing a score', async () => {
  const calls = installMock({
    'users/stu-assessment': { uid:'stu-assessment',role: 'student' },
    'opportunities/opp-assessment': { id: 'opp-assessment', employerId: 'emp-assessment', institutionId: 'inst-1', studentId: 'stu-assessment', campaignId: 'camp-assessment', stage: 'assessment_pending' },
    'campaigns/camp-assessment': { id: 'camp-assessment', funnel: {} },
  });
  await backend.executeRecruitmentTransition({ actorUid: 'stu-assessment', requestId: 'assessment-evidence-01', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-assessment', nextStage: 'assessment_completed', meta: { assessmentResponse: '  Synthetic response for human review.  ', assessmentTemplateId: 'eng-mech', assessmentScore: 100 } } });
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const writes = JSON.parse(String(commit.init?.body)).writes;
  const submission = writes.find((w: any) => w.update.name.includes('/assessmentSubmissions/')).update.fields;
  const opportunity = writes.find((w: any) => w.update.name.includes('/opportunities/')).update.fields;
  assert.equal(submission.response.stringValue, 'Synthetic response for human review.');
  assert.equal(submission.status.stringValue, 'pending_review');
  assert.equal(opportunity.assessmentScore.nullValue, 'NULL_VALUE');
  assert.equal(opportunity.assessmentReviewStatus.stringValue, 'pending_review');
  assert.equal(opportunity.assessmentEvidenceHash.stringValue, submission.evidenceHash.stringValue);
  assert.equal(opportunity.assessmentSubmissionId.stringValue, submission.id.stringValue);
  assert.equal(opportunity.response, undefined);
});

test('assessment rejects empty submissions and another student before any commit', async () => {
  const fixture = {
    'users/stu-assessment': { uid:'stu-assessment',role: 'student' },
    'users/stu-other': { uid:'stu-other',role: 'student' },
    'opportunities/opp-assessment': { id: 'opp-assessment', employerId: 'emp-assessment', institutionId: 'inst-1', studentId: 'stu-assessment', campaignId: 'camp-assessment', stage: 'assessment_pending' },
    'campaigns/camp-assessment': { id: 'camp-assessment', funnel: {} },
  };
  const calls = installMock(fixture);
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'stu-assessment', requestId: 'assessment-empty-01', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-assessment', nextStage: 'assessment_completed', meta: { assessmentResponse: '  ', assessmentTemplateId: 'eng-mech' } } }), /Invalid assessment response/);
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'stu-other', requestId: 'assessment-other-01', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-assessment', nextStage: 'assessment_completed', meta: { assessmentResponse: 'Synthetic response', assessmentTemplateId: 'eng-mech' } } }), /not authorized/);
  assert.equal(calls.some(c => c.url.includes(':commit')), false);
});

test('application requires current consent, and employer cannot move an invitation to assessment', async () => {
  const fixture = {
    'users/student': { uid:'student',role: 'student' }, 'users/employer': { uid:'employer',role: 'employer' },
    'opportunities/opp-apply': { id: 'opp-apply', employerId: 'employer', institutionId: 'inst', studentId: 'student', campaignId: 'camp-apply', stage: 'invited' },
    'campaigns/camp-apply': { id: 'camp-apply', funnel: {} },
  };
  const input = { actorUid: 'student', requestId: 'apply-consent-01', action: 'SUBMIT_CONSENT' as const, payload: { opportunityId: 'opp-apply', consented: true } };
  const denied = installMock({ ...fixture, 'students/student': { campaignConsents: {} } });
  await assert.rejects(() => backend.executeRecruitmentTransition(input), /consent is required/);
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'employer', requestId: 'apply-employer-01', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-apply', nextStage: 'assessment_pending' } }), /explicit application consent/);
  assert.equal(denied.some(c => c.url.includes(':commit')), false);
  const approved = installMock({ ...fixture, 'students/student': { campaignConsents: { 'camp-apply': { status: 'approved', employerId: 'employer' } } } });
  await backend.executeRecruitmentTransition(input);
  const writes = JSON.parse(String(approved.find(c => c.url.includes(':commit'))?.init?.body)).writes;
  assert.equal(writes.find((w:any) => w.update.name.endsWith('/opp-apply')).update.fields.stage.stringValue, 'assessment_pending');
});

test('activation rejects pending calls and unverified students, uses canonical IDs and excludes embedded candidate records', async () => {
  const campaign = { id: 'camp-active', funnel: {}, requirement: { salaryMinLPA: 8 }, candidateOpportunities: [{ studentName: 'legacy private record' }] };
  const call = { id: 'call-active', institutionId: 'inst', campaignId: 'camp-active', employerId: 'emp', employerName: 'Employer', institutionName: 'College', role: 'Analyst', locations: [], joiningWindow: 'Later',activatedStudentsCount:0,offeredCandidatesCount:1 };
  const fixture = { 'users/inst': { uid:'inst',role: 'institution' }, 'institutions/inst':{empanelmentStatus:'empanelled'}, 'campaigns/camp-active': campaign };
  const input = { actorUid: 'inst', requestId: 'activation-0001', action: 'ACTIVATE_STUDENTS' as const, payload: { callId: 'call-active', studentIds: ['student'], opportunityIds: { student: 'attacker-selected-id' } } };
  installMock({ ...fixture, 'calls/call-active': { ...call, status: 'pending' } });
  await assert.rejects(() => backend.executeRecruitmentTransition(input), /Accepted or partially accepted/);
  installMock({ ...fixture, 'calls/call-active': { ...call, status: 'accepted' }, 'students/student': { institutionId: 'inst', institutionVerificationStatus: 'pending' } });
  await assert.rejects(() => backend.executeRecruitmentTransition(input), /Institution-verified/);
  installMock({...fixture,'calls/call-active':{...call,status:'accepted',activatedStudentsCount:1}});
  await assert.rejects(()=>backend.executeRecruitmentTransition(input),/exceeds institution committed/);
  const {activatedStudentsCount: _legacyMissing,...legacyCall}=call;
  installMock({...fixture,'calls/call-active':{...legacyCall,status:'accepted'}});
  await assert.rejects(()=>backend.executeRecruitmentTransition(input),/historical call requires reconciliation/);
  const approved = installMock({ ...fixture, 'calls/call-active': { ...call, status: 'accepted' }, 'students/student': { institutionId: 'inst', institutionVerificationStatus: 'verified', name: 'Private name' } });
  await backend.executeRecruitmentTransition(input);
  const writes = JSON.parse(String(approved.find(c=>c.url.includes(':commit'))?.init?.body)).writes;
  const opp = writes.find((w:any)=>w.update.name.includes('/opportunities/'));
  assert.ok(opp); assert.equal(opp.update.name.endsWith('/attacker-selected-id'), false);
  assert.equal(opp.update.fields.studentName.stringValue, 'Candidate');
  assert.deepEqual(writes.find((w:any)=>w.update.name.endsWith('/camp-active')).update.fields.candidateOpportunities.arrayValue.values, []);
});
test('historical grant can be revoked without the original campaign record', async () => {
  const calls = installMock({ 'users/student': { uid:'student',role: 'student' }, 'students/student': { campaignConsents: { retired: { status: 'approved', employerId: 'emp', contactInfoShared: true } } } });
  await backend.executeRecruitmentTransition({ actorUid: 'student', requestId: 'revocation-archived', action: 'GLOBAL_CONSENT', payload: { campaignIds: ['retired'], approved: false } });
  const writes = JSON.parse(String(calls.find(c=>c.url.includes(':commit'))?.init?.body)).writes;
  const grant = writes.find((w:any)=>w.update.name.endsWith('/students/student')).update.fields.campaignConsents.mapValue.fields.retired.mapValue.fields;
  assert.equal(grant.status.stringValue, 'denied'); assert.equal(grant.contactInfoShared.booleanValue, false);
});

test('employer cannot advance candidate after consent is revoked or belongs to another employer', async () => {
  const fixture = {
    'users/emp': { uid:'emp',role:'employer' },
    'opportunities/opp-consent': { id:'opp-consent', employerId:'emp', institutionId:'inst', studentId:'stu', campaignId:'camp', stage:'assessment_completed' },
    'campaigns/camp': { id:'camp', funnel:{} },
  };
  for (const grant of [{status:'denied',employerId:'emp',updatedAt:'2026-11-20'}, {status:'approved',employerId:'other',updatedAt:'2026-11-20'}, {status:'approved',employerId:'emp'}]) {
    const calls=installMock({ ...fixture, 'students/stu': { campaignConsents:{camp:grant} } });
    await assert.rejects(() => backend.executeRecruitmentTransition({actorUid:'emp',requestId:'revoked-stage-001',action:'ADVANCE_CANDIDATE_STAGE',payload:{opportunityId:'opp-consent',nextStage:'shortlisted'}}), /consent is required/);
    assert.equal(calls.some(c=>c.url.includes(':commit')),false);
  }
});

test('synthetic multi-stakeholder lifecycle carries committed evidence across every backend transition', async () => {
  const records: Record<string, Doc | null> = {
    'users/emp-flow': {uid:'emp-flow',role:'employer'}, 'users/inst-flow': {uid:'inst-flow',role:'institution'}, 'users/stu-flow': {uid:'stu-flow',role:'student'},'institutions/inst-flow':{empanelmentStatus:'empanelled'},
    'students/stu-flow': {id:'stu-flow',name:'Synthetic candidate',institutionId:'inst-flow',institutionVerificationStatus:'verified',campaignConsents:{}},
    'campaigns/camp-flow': {id:'camp-flow',employerId:'emp-flow',employerName:'Synthetic employer',requirement:{role:'Analyst',salaryMinLPA:8},targetedInstitutionIds:['inst-flow'],callsSent:[{id:'call-flow',institutionId:'inst-flow'}],funnel:{}},
    'calls/call-flow': {id:'call-flow',campaignId:'camp-flow',employerId:'emp-flow',employerName:'Synthetic employer',institutionId:'inst-flow',institutionName:'Synthetic college',role:'Analyst',locations:[],joiningWindow:'Later',status:'pending',vacanciesRequested:1,activatedStudentsCount:0},
  };
  const unpack = (v:any):any => 'nullValue' in v ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(unpack) : Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,value])=>[k,unpack(value)]));
  let seq=0;
  async function step(actorUid:string, action:Parameters<typeof backend.executeRecruitmentTransition>[0]['action'], payload:Record<string,any>) {
    const calls=installMock(records);
    await backend.executeRecruitmentTransition({actorUid,action,requestId:'flow-test-'+String(++seq).padStart(3,'0'),payload});
    const commit=calls.find(c=>c.url.includes(':commit')); assert.ok(commit);
    for(const w of JSON.parse(String(commit.init?.body)).writes){
      const key=decodeURIComponent(w.update.name.split('/documents/')[1]);
      records[key]=Object.fromEntries(Object.entries(w.update.fields).map(([k,v])=>[k,unpack(v)]));
    }
  }
  await step('inst-flow','RESPOND_CALL',{callId:'call-flow',status:'accepted',offeredCandidatesCount:1});
  await step('inst-flow','ACTIVATE_STUDENTS',{callId:'call-flow',studentIds:['stu-flow']});
  const oppKey=Object.keys(records).find(k=>k.startsWith('opportunities/')); assert.ok(oppKey);
  const opportunityId=records[oppKey]!.id;
  await step('stu-flow','GLOBAL_CONSENT',{approved:true,campaignIds:['camp-flow']});
  await step('stu-flow','UPDATE_CONSENT_SCOPE',{campaignId:'camp-flow',scopeKey:'skillBenchmarksShared',value:true});
  await step('stu-flow','SUBMIT_CONSENT',{opportunityId,consented:true});
  await step('stu-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'assessment_completed',meta:{assessmentResponse:'Synthetic answer',assessmentTemplateId:'test-template',shareAssessmentResponse:true}});
  await step('emp-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'shortlisted'});
  await step('emp-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'interviewing'});
  await step('emp-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'offered',meta:{offer:{salaryLPA:10,terms:'Synthetic test terms'}}});
  await step('stu-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'accepted'});
  await step('emp-flow','ADVANCE_CANDIDATE_STAGE',{opportunityId,nextStage:'joined'});
  assert.equal(records[oppKey]!.stage,'joined');
  assert.equal(records[oppKey]!.joinedSalaryLPA,10);
  assert.ok(records[oppKey]!.joinedAt);
  assert.equal(records['students/stu-flow']!.placementStatus,'placed');
  assert.equal(records['students/stu-flow']!.placedSalaryLPA,10);
  assert.equal(records['campaigns/camp-flow']!.funnel.joined,1);
  const fee = Object.entries(records).find(([k])=>k.startsWith('successFees/'))?.[1];
  assert.equal(fee?.feeAmountMinor,5000000);
});

test('institution verification is audited, scoped and evidence-note gated', async()=>{
  const fixture={'users/inst-a':{uid:'inst-a',role:'institution'},'institutions/inst-a':{empanelmentStatus:'empanelled'},'students/stu-a':{institutionId:'inst-a',institutionVerificationStatus:'pending'},'students/stu-b':{institutionId:'inst-b',institutionVerificationStatus:'pending'}};
  const denied=installMock(fixture);
  await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'inst-a',requestId:'verify-other-1',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION',payload:{studentId:'stu-b',status:'verified',notes:'Synthetic review'}}),/not authorized/);
  await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'inst-a',requestId:'verify-empty-1',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION',payload:{studentId:'stu-a',status:'verified',notes:''}}),/evidence note is required/);
  assert.equal(denied.some(c=>c.url.includes(':commit')),false);
  installMock({...fixture,'institutions/inst-a':{empanelmentStatus:'rejected'}});
  await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'inst-a',requestId:'verify-rejected-1',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION',payload:{studentId:'stu-a',status:'verified',notes:'Synthetic review'}}),/Empanelled institution is required/);
  const allowed=installMock(fixture);
  await backend.executeTrustedProfileMutation({actorUid:'inst-a',requestId:'verify-owned-1',action:'UPDATE_STUDENT_INSTITUTION_VERIFICATION',payload:{studentId:'stu-a',status:'verified',notes:'Synthetic review'}});
  const commit=allowed.find(c=>c.url.includes(':commit'));assert.ok(commit);
  const writes=JSON.parse(String(commit.init?.body)).writes;
  assert.equal(writes.find((w:any)=>w.update.name.endsWith('/students/stu-a')).update.fields.institutionVerificationStatus.stringValue,'verified');
  assert.ok(writes.some((w:any)=>w.update.name.includes('/auditEvents/')));
});

test('transactional reads must return the exact requested resource or explicit missing marker', async()=>{
  const calls=installMock({});
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    if(String(input).endsWith(':batchGet')) return new Response(JSON.stringify([{missing:'projects/nexustalent-test/databases/(default)/documents/unrelated/wrong'}]),{status:200});
    return original(input,init);
  };
  await assert.rejects(()=>backend.executeRecruitmentTransition({actorUid:'emp-1',requestId:'missing-wrong-1',action:'CREATE_REQUIREMENT_CAMPAIGN',payload:{}}),/did not return the requested document/);
  assert.equal(calls.some(c=>c.url.endsWith(':commit')),false);
  assert.ok(calls.some(c=>c.url.endsWith(':rollback')));
});


test('academic correction preserves verified record until scoped review and invalidates obsolete consent on approval',async()=>{
  const initial={id:'stu-correction',institutionId:'inst-correction',program:'B.Tech',graduationYear:2026,institutionVerificationStatus:'verified',platformVerificationStatus:'verified',campaignConsents:{campaign:{status:'approved',academicDataShared:true,contactInfoShared:true,updatedAt:'2026-01-01T00:00:00.000Z'}}};
  const fixture={'users/stu-correction':{uid:'stu-correction',role:'student'},'users/inst-correction':{uid:'inst-correction',role:'institution'},'users/inst-other':{uid:'inst-other',role:'institution'},'institutions/inst-correction':{empanelmentStatus:'empanelled'},'students/stu-correction':initial};
  const requested=installMock(fixture);
  const request=await backend.executeTrustedProfileMutation({actorUid:'stu-correction',requestId:'correction-request-1',action:'REQUEST_ACADEMIC_CORRECTION',payload:{proposed:{graduationYear:2027},reason:'Synthetic transcript mismatch'}});
  const writes=JSON.parse(String(requested.find(c=>c.url.includes(':commit'))?.init?.body)).writes;
  const studentWrite=writes.find((w:any)=>w.update.name.endsWith('/students/stu-correction'));
  assert.equal(studentWrite.update.fields.graduationYear.integerValue,'2026');
  assert.equal(studentWrite.update.fields.institutionVerificationStatus.stringValue,'verified');
  const correction={id:request.auditEventId,studentId:'stu-correction',institutionId:'inst-correction',status:'pending',before:{graduationYear:2026},proposed:{graduationYear:2027},reason:'Synthetic transcript mismatch'};
  const pending={...fixture,'students/stu-correction':{...initial,academicCorrection:correction},['academicCorrections/'+correction.id]:correction};
  const payload={studentId:'stu-correction',correctionId:correction.id,decision:'approved',note:'Synthetic record reviewed'};
  installMock(pending);
  await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'inst-other',requestId:'correction-deny-1',action:'REVIEW_ACADEMIC_CORRECTION',payload}),/not authorized/);
  installMock({...pending,'students/stu-correction':{...initial,graduationYear:2025,academicCorrection:correction}});
  await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'inst-correction',requestId:'correction-stale-1',action:'REVIEW_ACADEMIC_CORRECTION',payload}),/stale correction/);
  const approved=installMock(pending);
  await backend.executeTrustedProfileMutation({actorUid:'inst-correction',requestId:'correction-review-1',action:'REVIEW_ACADEMIC_CORRECTION',payload});
  const f=JSON.parse(String(approved.find(c=>c.url.includes(':commit'))?.init?.body)).writes.find((w:any)=>w.update.name.endsWith('/students/stu-correction')).update.fields;
  assert.equal(f.graduationYear.integerValue,'2027');
  assert.equal(f.institutionVerificationStatus.stringValue,'pending');
  assert.equal(f.platformVerificationStatus.stringValue,'pending');
  assert.equal(f.campaignConsents.mapValue.fields.campaign.mapValue.fields.status.stringValue,'denied');
  assert.equal(f.campaignConsents.mapValue.fields.campaign.mapValue.fields.academicDataShared.booleanValue,false);
  assert.equal(f.academicCorrection.mapValue.fields.status.stringValue,'approved');
  assert.ok(f.academicCorrectedAt.stringValue);
});

test('targeted institution alone cannot grant consent for an uninvited student',async()=>{
 const calls=installMock({'users/stu-no-invitation':{uid:'stu-no-invitation',role:'student'},'students/stu-no-invitation':{institutionId:'inst-1'},'campaigns/camp-not-invited':{employerId:'emp',targetedInstitutionIds:['inst-1'],callsSent:[{institutionId:'inst-1',id:'call-existing'}]}});
 await assert.rejects(()=>backend.executeRecruitmentTransition({actorUid:'stu-no-invitation',requestId:'uninvited-001',action:'GLOBAL_CONSENT',payload:{campaignIds:['camp-not-invited'],approved:true}}),/individual invitation is required/);
 assert.equal(calls.some(c=>c.url.includes(':commit')),false);
});

test('connectivity probes exactly one masked own-account read and never writes',async()=>{
 const original=globalThis.fetch;
 const calls:Array<{url:string;init?:RequestInit}>=[];
 try{
  globalThis.fetch=async(input,init)=>{calls.push({url:String(input),init});return new Response(JSON.stringify(firestoreDoc('users/emp-1',{uid:'emp-1',role:'employer'})),{status:200});};
  assert.equal(await backend.checkTrustedRecruitmentRead('emp-1'),true);
  assert.equal(calls.length,1);assert.equal(calls[0].init?.method,'GET');
  assert.match(calls[0].url,/\/users\/emp-1\?mask.fieldPaths=uid&mask.fieldPaths=role$/);
  assert.equal((calls[0].init?.headers as Record<string,string>).Authorization,'Bearer test-token');
  assert.equal(await backend.checkTrustedRecruitmentRead('../other'),false);
  assert.equal(calls.length,1);
  globalThis.fetch=async()=>new Response(JSON.stringify(firestoreDoc('users/other',{uid:'emp-1',role:'employer'})),{status:200});
  assert.equal(await backend.checkTrustedRecruitmentRead('emp-1'),false);
  globalThis.fetch=async()=>new Response(JSON.stringify(firestoreDoc('users/emp-1',{uid:'emp-1',role:'simulation'})),{status:200});
  assert.equal(await backend.checkTrustedRecruitmentRead('emp-1'),false);
  for(const status of [403,404,429,503]){
   globalThis.fetch=async()=>new Response('{}',{status});
   assert.equal(await backend.checkTrustedRecruitmentRead('emp-1'),false);
  }
 }finally{globalThis.fetch=original;}
});
test('own account endpoint projection excludes unapproved fields and distinguishes missing from invalid records',async()=>{
 const calls=installMock({'users/emp-1':{uid:'emp-1',role:'employer',name:'Synthetic',email:'synthetic@example.test',secret:'private'}});
 assert.deepEqual(await backend.readOwnAccount('emp-1'),{uid:'emp-1',role:'employer',name:'Synthetic',email:'synthetic@example.test'});
 assert.equal(calls.filter(x=>x.url.endsWith(':batchGet')).length,1);
 assert.equal(calls.filter(x=>x.url.includes(':commit')).length,0);
 assert.ok(calls.some(x=>x.url.endsWith(':rollback')));
 installMock({});assert.equal(await backend.readOwnAccount('missing'),null);
 installMock({'users/emp-1':{uid:'different',role:'employer',name:'Synthetic',email:'synthetic@example.test'}});
 await assert.rejects(()=>backend.readOwnAccount('emp-1'),backend.DatastoreUnavailable);
});
const studentSignup={role:'student',name:'Synthetic candidate',registrationType:'empanelled',institutionId:'campus-1',customCollegeName:'Spoofed',state:'Test',program:'BTech',branch:'CSE',graduationYear:2027,cgpa:8,rollNumber:'Synthetic',minSalaryLPA:0};
test('server registration creates account, pending profile and audit atomically using verified email and canonical campus',async()=>{
 const calls=installMock({'institutions/campus-1':{id:'campus-1',name:'Verified campus',code:'TEST',empanelmentStatus:'empanelled'}});
 assert.deepEqual(await backend.registerOwnStakeholder('new-student','student@example.test',studentSignup),{replayed:false});
 const commit=calls.find(x=>x.url.endsWith(':commit'));assert.ok(commit);
 const writes=JSON.parse(String(commit.init?.body)).writes;
 assert.equal(writes.length,3);
 const user=writes.find((w:any)=>w.update.name.endsWith('/users/new-student')).update.fields;
 const profile=writes.find((w:any)=>w.update.name.endsWith('/students/new-student')).update.fields;
 assert.equal(user.role.stringValue,'student');assert.equal(user.email.stringValue,'student@example.test');
 assert.equal(profile.institutionName.stringValue,'Verified campus');
 assert.equal(profile.institutionVerificationStatus.stringValue,'pending');
 assert.equal(profile.platformVerificationStatus.stringValue,'pending');
 assert.equal(calls.filter(x=>x.url.endsWith(':rollback')).length,0);
});
test('registration denies forged privilege fields, orphaned profiles and unavailable campuses',async()=>{
 for(const input of [{...studentSignup,role:'super_admin'},{...studentSignup,uid:'victim'},{...studentSignup,platformVerificationStatus:'verified'},{...studentSignup,registrationType:'independent'}]){
  const calls=installMock({});await assert.rejects(()=>backend.registerOwnStakeholder('new-student','student@example.test',input));assert.equal(calls.length,0);
 }
 for(const docs of [{'employers/new-student':{id:'new-student'}},{'institutions/campus-1':{id:'campus-1',name:'Unapproved',code:'TEST',empanelmentStatus:'pending_empanelment'}},{}]){
  const calls=installMock(docs);await assert.rejects(()=>backend.registerOwnStakeholder('new-student','student@example.test',studentSignup),/No record was overwritten/);assert.ok(!calls.some(x=>x.url.endsWith(':commit')));
 }
});
test('registration retries are read-only, not role reassignment or overwrites',async()=>{
 const calls=installMock({'users/new-student':{uid:'new-student',role:'student',email:'student@example.test'},'students/new-student':{id:'new-student'}});
 assert.deepEqual(await backend.registerOwnStakeholder('new-student','student@example.test',studentSignup),{replayed:true});
 assert.ok(!calls.some(x=>x.url.endsWith(':commit')));
 await assert.rejects(()=>backend.registerOwnStakeholder('new-student','student@example.test',{role:'employer',name:'Synthetic',companyName:'Synthetic',industry:'',headquarters:'',businessRegNumber:'',websiteUrl:''}),/No record was overwritten/);
});
test('registration directory has fixed query, bound limit and minimal projection',async()=>{
 const calls=installMock({});
 const base=globalThis.fetch;
 globalThis.fetch=async(input,init)=>String(input).endsWith(':runQuery')?(()=>{calls.push({url:String(input),init});return new Response(JSON.stringify([{document:firestoreDoc('institutions/verified-campus',{id:'verified-campus',name:'Verified Campus',code:'VC',empanelmentStatus:'empanelled',privateField:'do not return'})}]),{status:200});})():base(input,init);
 assert.deepEqual(await backend.listRegistrationInstitutions(),[{id:'verified-campus',name:'Verified Campus',code:'VC'}]);
 const query=JSON.parse(String(calls.find(x=>x.url.endsWith(':runQuery'))?.init?.body));
 assert.equal(query.structuredQuery.limit,100);
 assert.equal(query.structuredQuery.where.fieldFilter.value.stringValue,'empanelled');
 assert.ok(query.transaction);assert.equal(calls.at(-1)?.url.endsWith(':rollback'),true);
 assert.deepEqual(await backend.listRegistrationInstitutions('previous-campus'),[{id:'verified-campus',name:'Verified Campus',code:'VC'}]);
 const paged=JSON.parse(String(calls.filter(x=>x.url.endsWith(':runQuery')).at(-1)?.init?.body));
 assert.equal(paged.structuredQuery.limit,101);assert.equal(paged.structuredQuery.startAt.before,false);
 assert.ok(paged.structuredQuery.startAt.values[0].referenceValue.endsWith('/institutions/previous-campus'));

 globalThis.fetch=async(input,init)=>String(input).endsWith(':runQuery')?new Response(JSON.stringify([{document:firestoreDoc('institutions/not-verified',{id:'not-verified',name:'Pending',code:'P',empanelmentStatus:'pending_empanelment'})}]),{status:200}):base(input,init);
 await assert.rejects(()=>backend.listRegistrationInstitutions(),backend.DatastoreUnavailable);
});
import {workspaceQueries,verifiedAdminClaim,WorkspaceDenied} from '../server/workspaceScope';
function installWorkspaceMock(docs:Record<string,Doc|null>,forged?:Doc){
 const calls=installMock(docs);const base=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  if(!String(input).endsWith(':runQuery'))return base(input,init);
  calls.push({url:String(input),init});
  const {structuredQuery:q,transaction}=JSON.parse(String(init?.body));assert.ok(transaction);
  const c=q.from[0].collectionId;const f=q.where?.fieldFilter;
  const results=Object.entries(docs).filter(([path,data])=>path.startsWith(c+'/')&&path.split('/').length===2&&data&&(!f||(f.op==='ARRAY_CONTAINS'?Array.isArray(data[f.field.fieldPath])&&data[f.field.fieldPath].includes(f.value.stringValue):data[f.field.fieldPath]===f.value.stringValue))).filter(([path])=>!q.startAt||firestoreDoc(path,{}).name>q.startAt.values[0].referenceValue).sort(([a],[b])=>a<b?-1:a>b?1:0).slice(0,q.limit).map(([path,data])=>({document:firestoreDoc(path,data!)}));
  if(forged&&c==='opportunities')results.push({document:firestoreDoc('opportunities/forged',forged)});
  return new Response(JSON.stringify(results),{status:200});
 };
 return calls;
}
const workspaceDocs={
 'users/own-emp':{uid:'own-emp',role:'employer'},'employers/own-emp':{id:'own-emp',name:'Owner',verificationStatus:'pending'},
 'employers/verified':{id:'verified',verificationStatus:'verified'},'employers/other-pending':{id:'other-pending',verificationStatus:'pending'},
 'users/own-inst':{uid:'own-inst',role:'institution'},'institutions/own-inst':{id:'own-inst',empanelmentStatus:'empanelled'},
 'users/own-stu':{uid:'own-stu',role:'student'},'students/own-stu':{id:'own-stu',institutionId:'own-inst'},'students/other':{id:'other',institutionId:'outside'},
 'campaigns/own':{id:'own',employerId:'own-emp',targetedInstitutionIds:['own-inst']},'campaigns/other':{id:'other',employerId:'outside',targetedInstitutionIds:['outside']},
 'opportunities/own':{id:'own',employerId:'own-emp',institutionId:'own-inst',studentId:'own-stu'},'opportunities/other':{id:'other',employerId:'outside',institutionId:'outside',studentId:'other'}
};
test('workspace queries preserve role ownership and deny unrelated tenants',async()=>{
 const calls=installWorkspaceMock(workspaceDocs);
 const employer=await backend.readStakeholderWorkspace('own-emp');
 assert.equal(employer.profile?.id,'own-emp');assert.deepEqual(employer.collections.employers.map(x=>x.id),['verified']);
 assert.deepEqual(employer.collections.students,[]);assert.deepEqual(employer.collections.users,[]);
 assert.deepEqual(employer.collections.opportunities.map(x=>x.id),['own']);
 assert.deepEqual(employer.collections.campaigns.map(x=>x.id),['own']);
 const inst=await backend.readStakeholderWorkspace('own-inst');
 assert.deepEqual(inst.collections.students.map(x=>x.id),['own-stu']);assert.deepEqual(inst.collections.campaigns.map(x=>x.id),['own']);
 const student=await backend.readStakeholderWorkspace('own-stu');
 assert.deepEqual(student.collections.students.map(x=>x.id),['own-stu']);assert.deepEqual(student.collections.campaigns,[]);
 assert.deepEqual(student.collections.opportunities.map(x=>x.id),['own']);
 assert.ok(!calls.some(x=>x.url.endsWith(':commit')));
 assert.equal(calls.filter(x=>x.url.endsWith(':rollback')).length,3);
});
test('workspace rejects malformed rows, missing profile and unclaimed administrators',async()=>{
 installWorkspaceMock(workspaceDocs,{id:'forged',studentId:'outside'});
 await assert.rejects(()=>backend.readStakeholderWorkspace('own-stu'),backend.DatastoreUnavailable);
 installWorkspaceMock({'users/own':{uid:'own',role:'student'}});
 assert.equal((await backend.readStakeholderWorkspace('own')).status,'missing');
 installWorkspaceMock({'users/owner':{uid:'owner',role:'super_admin',secret:'private',email:'owner@example.test',name:'Owner'}});
 await assert.rejects(()=>backend.readStakeholderWorkspace('owner'),WorkspaceDenied);
 const admin=await backend.readStakeholderWorkspace('owner',true);
 assert.equal(admin.collections.users[0].secret,undefined);
 assert.throws(()=>workspaceQueries('super_admin','owner',false),WorkspaceDenied);
 const token='header.'+Buffer.from(JSON.stringify({sub:'owner',role:'super_admin'})).toString('base64url')+'.signature';
 assert.equal(verifiedAdminClaim(token,'owner'),true);assert.equal(verifiedAdminClaim(token,'other'),false);assert.equal(verifiedAdminClaim('invalid','owner'),false);
});
test('workspace refuses silently truncated tenant records',async()=>{
 const docs:Record<string,Doc>={'users/own':{uid:'own',role:'student'},'students/own':{id:'own'}};
 for(let i=0;i<201;i++)docs['opportunities/id-'+i]={id:'id-'+i,studentId:'own'};
 installWorkspaceMock(docs);
 await assert.rejects(()=>backend.readStakeholderWorkspace('own'),backend.DatastoreUnavailable);
});

test('fresh candidate API disclosure is employer-only, excludes unshared fields and never returns an old replayed snapshot',async()=>{
 const invitation=individualFixture('camp-view','stu-view','emp-view','inst-view');
 const grant={status:'approved',employerId:'emp-view',opportunityId:invitation.id,updatedAt:'2026-11-20T00:00:00Z',academicDataShared:true};
 const docs:Record<string,Doc>={...invitation.records,'users/emp-view':{uid:'emp-view',role:'employer'},'users/inst-view':{uid:'inst-view',role:'institution'},'campaigns/camp-view':{id:'camp-view',employerId:'emp-view',callsSent:invitation.callsSent,targetedInstitutionIds:['inst-view'],requirement:{role:'Analyst'}},'students/stu-view':{id:'stu-view',name:'Synthetic student',email:'private@example.test',institutionId:'inst-view',program:'BTech',campaignConsents:{'camp-view':grant}}};
 const input={actorUid:'emp-view',campaignId:'camp-view',studentId:'stu-view',requestId:'view-test-001',includeEmployerProfile:true};
 installMock(docs);
 const current=await backend.provisionCandidateProjection(input);assert.equal(current.profile?.name,'Synthetic student');assert.equal(current.profile?.program,'BTech');assert.equal(current.profile?.email,undefined);
 installMock(docs);await assert.rejects(()=>backend.provisionCandidateProjection({...input,actorUid:'inst-view'}),WorkspaceDenied);
 const audit=hashForFixture('sha256').update('view-test-001:emp-view:camp-view:stu-view').digest('hex');
 installMock({...docs,['auditEvents/'+audit]:{immutable:true}});
 const replay=await backend.provisionCandidateProjection(input);assert.equal(replay.replayed,true);assert.equal(replay.profile,undefined);
 grant.status='denied';installMock(docs);await assert.rejects(()=>backend.provisionCandidateProjection(input),/consent is required/);
});
test('assessment access checks exact ownership, current consent, sharing and evidence hash',async()=>{
 const response='Synthetic response',hash=hashForFixture('sha256').update(response).digest('hex');
 const submission={id:'submission-1',employerId:'emp-1',studentId:'stu-1',campaignId:'camp-1',opportunityId:'opp-1',response,evidenceHash:hash,shareWithEmployer:true};
 const grant={status:'approved',employerId:'emp-1',opportunityId:'opp-1',updatedAt:'2026-11-20T00:00:00Z',skillBenchmarksShared:true};
 const docs={'users/emp-1':{uid:'emp-1',role:'employer'},'users/other':{uid:'other',role:'employer'},'assessmentSubmissions/submission-1':submission,'students/stu-1':{id:'stu-1',campaignConsents:{'camp-1':grant}},'campaigns/camp-1':{id:'camp-1',employerId:'emp-1'},'opportunities/opp-1':{id:'opp-1',studentId:'stu-1',employerId:'emp-1',campaignId:'camp-1',assessmentSubmissionId:'submission-1',assessmentEvidenceHash:hash}};
 installMock(docs);assert.deepEqual(await backend.readEmployerAssessment('emp-1','submission-1'),{submissionId:'submission-1',response});
 installMock(docs);await assert.rejects(()=>backend.readEmployerAssessment('other','submission-1'),WorkspaceDenied);
 for(const mutation of [()=>{grant.status='denied';},()=>{grant.status='approved';grant.skillBenchmarksShared=false;},()=>{grant.skillBenchmarksShared=true;submission.shareWithEmployer=false;},()=>{submission.shareWithEmployer=true;submission.evidenceHash='tampered';}]){
  mutation();installMock(docs);await assert.rejects(()=>backend.readEmployerAssessment('emp-1','submission-1'),WorkspaceDenied);
 }
});
test('career evidence queue denies nonowners and unclaimed admins',async()=>{
 const docs={'users/stu':{uid:'stu',role:'student'},'users/admin':{uid:'admin',role:'super_admin'},'users/emp':{uid:'emp',role:'employer'},'careerEvidence/one':{id:'one',studentId:'stu',status:'verified'},'careerEvidence/two':{id:'two',studentId:'other',status:'submitted'},'careerEvidence/three':{id:'three',studentId:'stu',status:'under_review'}};
 installWorkspaceMock(docs);assert.deepEqual((await backend.readCareerEvidenceQueue('stu')).map(x=>x.id),['one','three']);
 await assert.rejects(()=>backend.readCareerEvidenceQueue('admin'),WorkspaceDenied);
 await assert.rejects(()=>backend.readCareerEvidenceQueue('emp',true),WorkspaceDenied);
 assert.deepEqual((await backend.readCareerEvidenceQueue('admin',true)).map(x=>x.id),['two','three']);
});
test('recruitment rejects mismatched authoritative actor UID',async()=>{
 const calls=installMock({'users/emp-1':{uid:'other',role:'employer'}});
 await assert.rejects(()=>backend.executeRecruitmentTransition({actorUid:'emp-1',requestId:'actor-mismatch-001',action:'CREATE_REQUIREMENT_CAMPAIGN',payload:{}}),/Actor record was not found/);
 assert.ok(!calls.some(c=>c.url.endsWith(':commit')));
});
test('commercial estimate is read-only, actor-owned and rejects missing or foreign campaigns',async()=>{
 const docs={'users/emp-quote':{uid:'emp-quote',role:'employer'},'users/other-quote':{uid:'other-quote',role:'employer'},'users/stu-quote':{uid:'stu-quote',role:'student'},'campaigns/quote-camp':{id:'quote-camp',employerId:'emp-quote',requirement:{vacancies:2},targetedInstitutionIds:['inst-a','inst-b','inst-a']}};
 const calls=installMock(docs);
 assert.deepEqual(await backend.authorizeCommercialCampaign('emp-quote','quote-camp'),{campaignId:'quote-camp',vacancies:2,institutions:2});
 await assert.rejects(()=>backend.authorizeCommercialCampaign('other-quote','quote-camp'),/not authorized/);
 await assert.rejects(()=>backend.authorizeCommercialCampaign('emp-quote','missing'),/not authorized/);
 await assert.rejects(()=>backend.authorizeCommercialCampaign('stu-quote','quote-camp'),/Only an employer/);
 assert.ok(!calls.some(c=>c.url.endsWith(':commit')));
 assert.equal(calls.filter(c=>c.url.endsWith(':rollback')).length,4);
});

test('stored administrator role alone cannot authorize a profile mutation',async()=>{
 const calls=installMock({'users/unclaimed':{uid:'unclaimed',role:'super_admin'},'employers/target':{id:'target',verificationStatus:'pending'}});
 await assert.rejects(()=>backend.executeTrustedProfileMutation({actorUid:'unclaimed',requestId:'claim-denial-001',action:'UPDATE_EMPLOYER_VERIFICATION',payload:{employerId:'target',status:'verified',adminClaim:true}}),/Super admin authorization/);
 assert.ok(!calls.some(c=>c.url.endsWith(':commit')));
});

test('paged workspace permits more than legacy cap without exposing other tenants or inventing totals',async()=>{
 const docs:Record<string,Doc>={'users/page-student':{uid:'page-student',role:'student'},'students/page-student':{id:'page-student'}};
 for(let i=0;i<205;i++){const id='opp-'+String(i).padStart(3,'0');docs['opportunities/'+id]={id,studentId:'page-student',offerSummary:{terms:'Untrusted historical copy'}};}
 docs['opportunities/foreign']={id:'foreign',studentId:'outside'};
 const calls=installWorkspaceMock(docs);
 let after='',seen:string[]=[];
 for(let i=0;i<5;i++){
  const page=await backend.readStakeholderWorkspacePage('page-student',false,'opportunities',after);
  assert.equal(page.snapshot,'page_only');assert.equal(page.uid,'page-student');assert.equal(page.records.length,i===4?5:50);
  assert.ok(page.records.every(r=>r.studentId==='page-student'&&!r.offerSummary));
  seen.push(...page.records.map(r=>r.id));if(page.nextCursor===null){assert.equal(i,4);break;}after=page.nextCursor;
 }
 assert.equal(new Set(seen).size,205);assert.equal(seen.length,205);
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('page-student',false,'users'),WorkspaceDenied);
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('page-student',false,'opportunities','bad/cursor'),WorkspaceDenied);
 assert.ok(!calls.some(c=>c.url.endsWith(':commit')));
});
test('paged administrative reads preserve claim boundary and redaction',async()=>{
 installWorkspaceMock({'users/admin-page':{uid:'admin-page',role:'super_admin',name:'Synthetic admin',secret:'not disclosed'}});
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('admin-page',false,'users'),WorkspaceDenied);
 const result=await backend.readStakeholderWorkspacePage('admin-page',true,'users');
 assert.equal(result.records[0].uid,'admin-page');assert.equal(result.records[0].secret,undefined);
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('admin-page',true,'students'),WorkspaceDenied);
});

test('workspace paging rejects backward or misordered provider responses',async()=>{
 const docs:Record<string,Doc>={'users/paged-order':{uid:'paged-order',role:'student'},'students/paged-order':{id:'paged-order'},'opportunities/z-last':{id:'z-last',studentId:'paged-order'}};
 // The deliberately appended forged record is in scope but fails keyset order.
 installWorkspaceMock(docs,{id:'forged',studentId:'paged-order'});
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('paged-order',false,'opportunities','m-middle'),backend.DatastoreUnavailable);
 await assert.rejects(()=>backend.readStakeholderWorkspacePage('paged-order',false,'opportunities'),backend.DatastoreUnavailable);
});
