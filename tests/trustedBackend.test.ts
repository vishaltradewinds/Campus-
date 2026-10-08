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
  const studentWrite = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-1')); assert.ok(studentWrite);
  const fields = studentWrite.update.fields.campaignConsents.mapValue.fields['camp-real'].mapValue.fields;
  assert.equal(fields.employerId.stringValue, 'emp-real'); assert.equal(fields.employerName.stringValue, 'Real Employer');
});

test('GLOBAL_CONSENT rejects campaigns not targeted to the student institution', async () => {
  installMock({ 'users/stu-1': { role: 'student' }, 'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} }, 'campaigns/camp-other': { employerId: 'emp-real', targetedInstitutionIds: ['inst-2'], requirement: { role: 'Engineer' } } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'stu-1', requestId: 'global-consent-2', action: 'GLOBAL_CONSENT', payload: { approved: true, campaignIds: ['camp-other'] } }), /not eligible/);
});

test('candidate projection enforces consent and minimizes unapproved fields', async () => {
  const calls = installMock({
    'users/emp-1': { role: 'employer' },
    'campaigns/camp-1': { employerId: 'emp-1', requirement: { role: 'Analyst' } },
    'students/stu-1': { name: 'Candidate', institutionId: 'inst-1', email: 'candidate@example.com', program: 'B.Tech', branch: 'CSE', graduationYear: 2027, cgpa: 9.1, skills: [{ name: 'JS', category: 'technical', score: 90, badge: 'Gold' }], projects: [{ repo: 'secret-repo' }], campaignConsents: { 'camp-1': { status: 'approved', employerId: 'emp-1', academicDataShared: true, skillBenchmarksShared: true, projectReposShared: false, contactInfoShared: false } } },
  });
  const result = await backend.provisionCandidateProjection({ actorUid: 'emp-1', campaignId: 'camp-1', studentId: 'stu-1', requestId: 'projection-1' });
  assert.equal(result.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); const projectionWrite = body.writes.find((w: any) => w.update.name.includes('/candidateProfiles/')); assert.ok(projectionWrite);
  const fields = projectionWrite.update.fields; assert.ok(fields.program); assert.ok(fields.verifiedSkills); assert.equal(fields.projects, undefined); assert.equal(fields.email, undefined);
});

test('ADVANCE_CANDIDATE_STAGE counts a stage only once per opportunity', async () => {
  const calls = installMock({
    'users/stu-1': { role: 'student' },
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'offered', funnelCountedStages: {} },
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
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'offered' },
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
    ['invited','assessment_pending','emp-1', { nextStage: 'assessment_pending' }],
    ['assessment_pending','assessment_completed','emp-1', { nextStage: 'assessment_completed', meta: { assessmentScore: 82 } }],
    ['assessment_completed','shortlisted','emp-1', { nextStage: 'shortlisted' }],
    ['shortlisted','interviewing','emp-1', { nextStage: 'interviewing' }],
    ['interviewing','offered','emp-1', { nextStage: 'offered', meta: { offerLetterUrl: 'offer://test-1' } }],
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
        campaignId: 'camp-1', stage: from,
      },
      'campaigns/camp-1': { id: 'camp-1', funnel: {} },
      ...(payload.nextStage === 'joined' ? { 'students/stu-1': { placementStatus: 'in_process' } } : {}),
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
  const studentWrite = body.writes.find((w: any) => w.update.name.endsWith('/students/stu-1'));
  assert.equal(studentWrite.update.fields.globalDataPrivacy.mapValue.fields.allowUnsolicitedPings.booleanValue, true);
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
  const calls = installMock({
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
  const calls = installMock({
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

  installMock({
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

  installMock({
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
    'opportunities/opp-fee': { id: 'opp-fee', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'accepted', employerName: 'Employer', salaryLPA: 10 },
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
  assert.equal(fee.update.fields.feeAmountMinor.integerValue, '50000');
});
