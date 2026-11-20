import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_PROJECT_ID = 'nexustalent-test';
process.env.GOOGLE_OAUTH_ACCESS_TOKEN = 'test-token';
const backend = await import('../server/trustedBackend');
type Doc = Record<string, any>;
const firestoreValue = (value: any): any => value === null ? { nullValue: 'NULL_VALUE' } : typeof value === 'string' ? { stringValue: value } : typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { integerValue: String(value) } : Array.isArray(value) ? { arrayValue: { values: value.map(firestoreValue) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, firestoreValue(v)])) } };
const firestoreDoc = (path: string, data: Doc) => ({ name: `projects/nexustalent-test/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, firestoreValue(v)])) });
function installMock(docs: Record<string, Doc | null>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  (globalThis as any).fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.endsWith(':beginTransaction')) return new Response(JSON.stringify({ transaction: `tx-${calls.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':commit')) return new Response(JSON.stringify({ commitTime: new Date().toISOString(), writeResults: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':rollback')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const match = url.match(/documents\/(.+?)\?transaction=/);
    if (!match) return new Response('{}', { status: 404 });
    const key = decodeURIComponent(match[1]); const data = docs[key];
    if (!data) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
    return new Response(JSON.stringify(firestoreDoc(key, data)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

test('CREATE_REQUIREMENT_CAMPAIGN commits requirement, campaign and audit atomically', async () => {
  const calls = installMock({ 'users/emp-1': { role: 'employer' } });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'req-test-001', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: { requirement: { id: 'req-1', employerId: 'emp-1', role: 'Analyst' }, campaign: { id: 'camp-1', requirementId: 'req-1', employerId: 'emp-1', funnel: {}, targetedInstitutionIds: [] } } });
  assert.equal(result.replayed, false); assert.deepEqual(result.ids, ['req-1', 'camp-1']);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); assert.equal(body.writes.length, 3); assert.equal(body.writes.filter((w: any) => w.update.name.includes('/auditEvents/')).length, 1);
});

test('same requestId is replay-safe and performs no second commit', async () => {
  const crypto = await import('node:crypto'); const realId = crypto.createHash('sha256').update('replay-001:emp-1:CREATE_REQUIREMENT_CAMPAIGN').digest('hex');
  const calls = installMock({ [`auditEvents/${realId}`]: { immutable: true } });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'replay-001', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} });
  assert.equal(result.replayed, true); assert.equal(calls.filter(c => c.url.includes(':commit')).length, 0);
});

test('institution cannot execute employer-only transition', async () => {
  installMock({ 'users/inst-1': { role: 'institution' } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'inst-1', requestId: 'deny-test-1', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} }), /not authorized/);
});

test('GLOBAL_CONSENT re-reads authoritative campaigns and rejects forged campaign metadata', async () => {
  const calls = installMock({
    'users/stu-1': { role: 'student' },
    'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} },
    'campaigns/camp-real': { id: 'camp-real', employerId: 'emp-real', employerName: 'Real Employer', requirement: { role: 'Engineer', salaryMinLPA: 8, salaryMaxLPA: 12 }, targetedInstitutionIds: ['inst-1'] },
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
  installMock({ 'users/stu-1': { role: 'student' }, 'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} }, 'campaigns/camp-other': { employerId: 'emp-real', targetedInstitutionIds: ['inst-2'], requirement: { role: 'Engineer' } } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'stu-1', requestId: 'global-consent-2', action: 'GLOBAL_CONSENT', payload: { approved: true, campaignIds: ['camp-other'] } }), /not eligible/);
});

test('candidate projection enforces consent and minimizes unapproved fields', async () => {
  const calls = installMock({
    'users/emp-1': { role: 'employer' },
    'campaigns/camp-1': { employerId: 'emp-1', requirement: { role: 'Analyst' } },
    'students/stu-1': { name: 'Candidate', institutionId: 'inst-1', email: 'candidate@example.com', program: 'B.Tech', branch: 'CSE', graduationYear: 2027, cgpa: 9.1, skills: [{ name: 'JS', category: 'technical', score: 90, badge: 'Gold' }], projects: [{ repo: 'secret-repo' }], campaignConsents: { 'camp-1': { status: 'approved', employerId: 'emp-1', updatedAt: '2026-11-20T00:00:00.000Z', academicDataShared: true, skillBenchmarksShared: true, projectReposShared: false, contactInfoShared: false } } },
  });
  const result = await backend.provisionCandidateProjection({ actorUid: 'emp-1', campaignId: 'camp-1', studentId: 'stu-1', requestId: 'projection-1' });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); const projectionWrite = body.writes.find((w: any) => w.update.name.includes('/candidateProfiles/')); assert.ok(projectionWrite);
  const fields = projectionWrite.update.fields; assert.ok(fields.program); assert.ok(fields.verifiedSkills); assert.equal(fields.projects, undefined); assert.equal(fields.email, undefined);
});

test('ADVANCE_CANDIDATE_STAGE counts a stage only once per opportunity', async () => {
  const calls = installMock({
    'users/stu-1': { role: 'student' },
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
    'users/emp-1': { role: 'employer' },
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
    'users/stu-1': { role: 'student' },
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
      [`users/${actorUid}`]: { role: actorUid.startsWith('stu-') ? 'student' : 'employer' },
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
  const calls = installMock({ 'users/stu-1': { role: 'student' }, 'students/stu-1': { globalDataPrivacy: { allowUnsolicitedPings: false } } });
  const result = await backend.executeTrustedProfileMutation({ actorUid: 'stu-1', requestId: 'privacy-test-1', action: 'UPDATE_GLOBAL_PRIVACY', payload: { settings: { allowUnsolicitedPings: true } } });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.length, 2);
  const studentWrite = body.writes.find((w: any) => String(w.update?.name || '').endsWith('/students/stu-1'));
  assert.equal(studentWrite?.update?.fields?.globalDataPrivacy?.mapValue?.fields?.allowUnsolicitedPings?.booleanValue, true);
});

test('verified skill mutation requires super admin and stamps the actual verifier', async () => {
  installMock({ 'users/stu-1': { role: 'student' }, 'students/stu-1': { skills: [] } });
  await assert.rejects(() => backend.executeTrustedProfileMutation({ actorUid: 'stu-1', requestId: 'skill-deny-1', action: 'ADD_VERIFIED_SKILL', payload: { studentId: 'stu-1', skill: { name: 'SQL', category: 'technical', score: 90, badge: 'Gold' } } }), /Super admin authorization/);
  const calls = installMock({ 'users/admin-1': { role: 'super_admin' }, 'students/stu-1': { skills: [] } });
  const result = await backend.executeTrustedProfileMutation({ actorUid: 'admin-1', requestId: 'skill-admin-1', action: 'ADD_VERIFIED_SKILL', payload: { studentId: 'stu-1', skill: { name: 'SQL', category: 'technical', score: 90, badge: 'Gold', verifiedBy: 'forged' } } });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const fields = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-1')).update.fields.skills.arrayValue.values[0].mapValue.fields;
  assert.equal(fields.verifiedBy.stringValue, 'admin-1');
});

test('direct student registration cannot self-verify platform credentials', async () => {
  const calls = installMock({ 'users/stu-2': { role: 'student' } });
  await backend.executeTrustedProfileMutation({
    actorUid: 'stu-2', requestId: 'register-stu-2', action: 'REGISTER_INDEPENDENT_CANDIDATE',
    payload: { candidateData: { id: 'attacker-id', name: 'Candidate', email: 'candidate@example.com', program: 'B.Tech', branch: 'CSE', independentCredentials: { collegeName: 'College', state: 'MP', city: 'Indore', degree: 'B.Tech', branch: 'CSE', graduationYear: 2027, cgpa: 8.5 }, platformVerificationStatus: 'verified' } }
  });
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  const studentWrite = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-2'));
  assert.equal(studentWrite.update.fields.platformVerificationStatus.stringValue, 'pending');
  assert.equal(studentWrite.update.name.endsWith('/students/stu-2'), true);
});


test('student evidence submission cannot claim an authoritative source', async () => {
  installMock({ 'users/stu-1': { role: 'student' }, 'students/stu-1': { id: 'stu-1' } });
  await assert.rejects(() => backend.submitCareerEvidence({
    actorUid: 'stu-1', studentId: 'stu-1', requestId: 'evidence-source-1', evidenceId: 'evidence-1',
    claimType: 'education', claimKey: 'degree', claimValue: 'B.Tech', sourceType: 'institution', sourceId: 'fake-institution'
  }), /student_submission/);
});

test('Career Passport verification requires authoritative provenance and records rejection reason', async () => {
  let calls = installMock({
    'users/admin-1': { role: 'super_admin' },
    'careerEvidence/e-1': { id: 'e-1', studentId: 'stu-1', status: 'under_review', sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'old' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' }
  });
  const result = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-review-1', action: 'REVIEW_CAREER_EVIDENCE',
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
    'users/admin-1': { role: 'super_admin' },
    'users/stu-1': { role: 'student' },
    'students/stu-1': { id: 'stu-1', evidenceIds: [] },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-2': {
      id: 'e-2', studentId: 'stu-1', status: 'under_review',
      sourceType: 'institution', sourceId: 'inst-1', expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lineageHash: 'seed'
    }
  });
  await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-verify-2', action: 'REVIEW_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-2', status: 'verified' }
  });
  let commit = calls.filter(c => c.url.includes(':commit')).at(-1);
  assert.ok(commit);
  let body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.some((w: any) => w.update.name.endsWith('/students/stu-1')), true);

  calls = installMock({
    'users/stu-1': { role: 'student' },
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
    'users/admin-1': { role: 'super_admin' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-2': {
      id: 'e-2', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const resolved = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-resolve-2', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
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
    'users/admin-1': { role: 'super_admin' },
    'careerEvidence/e-uphold': {
      id: 'e-uphold', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const upheld = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-uphold-1', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
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
    'users/admin-1': { role: 'super_admin' },
    'careerEvidence/e-reject': {
      id: 'e-reject', studentId: 'stu-1', status: 'verified', disputeStatus: 'open',
      sourceType: 'institution', sourceId: 'inst-1', lineageHash: 'seed'
    }
  });
  const rejected = await backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-reject-1', action: 'RESOLVE_CAREER_EVIDENCE_DISPUTE',
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
    'users/admin-1': { role: 'super_admin' },
    'institutions/inst-1': { id: 'inst-1', empanelmentStatus: 'empanelled' },
    'careerEvidence/e-3': {
      id: 'e-3', studentId: 'stu-1', status: 'verified',
      sourceType: 'institution', sourceId: 'inst-1',
      expiresAt: new Date(Date.now() + 86400000).toISOString(), lineageHash: 'seed'
    }
  });
  await assert.rejects(() => backend.executeTrustedProfileMutation({
    actorUid: 'admin-1', requestId: 'evidence-expiry-3', action: 'REVIEW_CAREER_EVIDENCE',
    payload: { evidenceId: 'e-3', status: 'expired' }
  }), /cannot be expired/);
});


test('joined outcome creates an idempotent five-percent success fee', async () => {
  const calls = installMock({
    'users/emp-1': { role: 'employer' },
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
  const calls = installMock({
    'users/emp-1': { role: 'employer' },
    'campaigns/camp-evidence': { employerId: 'emp-1', requirement: { role: 'Analyst' } },
    'students/stu-evidence': {
      name: 'Candidate',
      institutionId: 'inst-1',
      campaignConsents: {
        'camp-evidence': {
          status: 'approved',
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
  const calls = installMock({
    'users/emp-privacy': { role: 'employer' },
    'campaigns/camp-privacy': { employerId: 'emp-privacy', requirement: { role: 'Analyst' } },
    'students/stu-privacy': { name: 'Synthetic student', email: 'private@example.test', program: 'Private degree', evidenceIds: ['private-education', 'allowed-skill', 'private-identity'], campaignConsents: { 'camp-privacy': { status: 'approved', employerId: 'emp-privacy', updatedAt: '2026-11-20T00:01:00.000Z', academicDataShared: false, skillBenchmarksShared: true, contactInfoShared: false, projectReposShared: false } } },
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
    'users/emp-legacy': { role: 'employer' },
    'campaigns/camp-legacy': { employerId: 'emp-legacy' },
    'students/stu-legacy': { campaignConsents: { 'camp-legacy': { status: 'approved', employerId: 'emp-legacy' } } },
  });
  await assert.rejects(() => backend.provisionCandidateProjection({ actorUid: 'emp-legacy', campaignId: 'camp-legacy', studentId: 'stu-legacy', requestId: 'legacy-consent-01' }), /consent is required/);
  assert.equal(calls.some(c => c.url.includes(':commit')), false);
});

test('trusted recruitment uses server OAuth and does not forward the caller Firebase token', async () => {
  const calls = installMock({ 'users/emp-service': { role: 'employer' } });
  const result = await backend.executeRecruitmentTransition({
    actorUid: 'emp-service', firebaseIdToken: 'synthetic-user-id-token',
    requestId: 'service-identity-001', action: 'CREATE_REQUIREMENT_CAMPAIGN',
    payload: { requirement: { id: 'req-service', employerId: 'emp-service', role: 'Analyst' }, campaign: { id: 'camp-service', requirementId: 'req-service', employerId: 'emp-service', funnel: {}, targetedInstitutionIds: [] } },
  });
  assert.equal(result.replayed, false);
  assert.ok(calls.some(c => c.url.includes(':commit')));
  for (const call of calls) {
    assert.equal(new Headers(call.init?.headers).get('authorization'), 'Bearer test-token');
  }
});

test('joining refuses a missing or unrelated accepted offer before creating a fee', async () => {
  const base = {
    'users/emp-1': { role: 'employer' },
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
    'users/stu-assessment': { role: 'student' },
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
    'users/stu-assessment': { role: 'student' },
    'users/stu-other': { role: 'student' },
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
    'users/student': { role: 'student' }, 'users/employer': { role: 'employer' },
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
  const call = { id: 'call-active', institutionId: 'inst', campaignId: 'camp-active', employerId: 'emp', employerName: 'Employer', institutionName: 'College', role: 'Analyst', locations: [], joiningWindow: 'Later' };
  const fixture = { 'users/inst': { role: 'institution' }, 'campaigns/camp-active': campaign };
  const input = { actorUid: 'inst', requestId: 'activation-0001', action: 'ACTIVATE_STUDENTS' as const, payload: { callId: 'call-active', studentIds: ['student'], opportunityIds: { student: 'attacker-selected-id' } } };
  installMock({ ...fixture, 'calls/call-active': { ...call, status: 'pending' } });
  await assert.rejects(() => backend.executeRecruitmentTransition(input), /Accepted or partially accepted/);
  installMock({ ...fixture, 'calls/call-active': { ...call, status: 'accepted' }, 'students/student': { institutionId: 'inst', institutionVerificationStatus: 'pending' } });
  await assert.rejects(() => backend.executeRecruitmentTransition(input), /Institution-verified/);
  const approved = installMock({ ...fixture, 'calls/call-active': { ...call, status: 'accepted' }, 'students/student': { institutionId: 'inst', institutionVerificationStatus: 'verified', name: 'Private name' } });
  await backend.executeRecruitmentTransition(input);
  const writes = JSON.parse(String(approved.find(c=>c.url.includes(':commit'))?.init?.body)).writes;
  const opp = writes.find((w:any)=>w.update.name.includes('/opportunities/'));
  assert.ok(opp); assert.equal(opp.update.name.endsWith('/attacker-selected-id'), false);
  assert.equal(opp.update.fields.studentName.stringValue, 'Candidate');
  assert.deepEqual(writes.find((w:any)=>w.update.name.endsWith('/camp-active')).update.fields.candidateOpportunities.arrayValue.values, []);
});
test('historical grant can be revoked without the original campaign record', async () => {
  const calls = installMock({ 'users/student': { role: 'student' }, 'students/student': { campaignConsents: { retired: { status: 'approved', employerId: 'emp', contactInfoShared: true } } } });
  await backend.executeRecruitmentTransition({ actorUid: 'student', requestId: 'revocation-archived', action: 'GLOBAL_CONSENT', payload: { campaignIds: ['retired'], approved: false } });
  const writes = JSON.parse(String(calls.find(c=>c.url.includes(':commit'))?.init?.body)).writes;
  const grant = writes.find((w:any)=>w.update.name.endsWith('/students/student')).update.fields.campaignConsents.mapValue.fields.retired.mapValue.fields;
  assert.equal(grant.status.stringValue, 'denied'); assert.equal(grant.contactInfoShared.booleanValue, false);
});

test('employer cannot advance candidate after consent is revoked or belongs to another employer', async () => {
  const fixture = {
    'users/emp': { role:'employer' },
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
    'users/emp-flow': {role:'employer'}, 'users/inst-flow': {role:'institution'}, 'users/stu-flow': {role:'student'},
    'students/stu-flow': {id:'stu-flow',name:'Synthetic candidate',institutionId:'inst-flow',institutionVerificationStatus:'verified',campaignConsents:{}},
    'campaigns/camp-flow': {id:'camp-flow',employerId:'emp-flow',employerName:'Synthetic employer',requirement:{role:'Analyst',salaryMinLPA:8},targetedInstitutionIds:['inst-flow'],funnel:{}},
    'calls/call-flow': {id:'call-flow',campaignId:'camp-flow',employerId:'emp-flow',employerName:'Synthetic employer',institutionId:'inst-flow',institutionName:'Synthetic college',role:'Analyst',locations:[],joiningWindow:'Later',status:'pending',vacanciesRequested:1},
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
