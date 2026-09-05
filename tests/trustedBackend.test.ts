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
  installMock({
    'users/stu-1': { role: 'student' },
    'students/stu-1': { institutionId: 'inst-1', campaignConsents: {} },
    'campaigns/camp-other': { employerId: 'emp-real', targetedInstitutionIds: ['inst-2'], requirement: { role: 'Engineer' } },
  });
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
    'users/emp-1': { role: 'employer' },
    'opportunities/opp-1': { id: 'opp-1', employerId: 'emp-1', institutionId: 'inst-1', studentId: 'stu-1', campaignId: 'camp-1', stage: 'offered', funnelCountedStages: {} },
    'campaigns/camp-1': { funnel: { offersMade: 1, offersAccepted: 0 }, requirement: {} },
    'students/stu-1': { placementStatus: 'in_process' },
  });
  const first = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'stage-1', action: 'ADVANCE_CANDIDATE_STAGE', payload: { opportunityId: 'opp-1', nextStage: 'accepted' } });
  assert.equal(first.replayed, false);
  const commit = calls.find(c => c.url.includes(':commit')); assert.ok(commit); const body = JSON.parse(String(commit?.init?.body)); const campaignWrite = body.writes.find((w: any) => w.update.name.endsWith('/campaigns/camp-1')); assert.equal(campaignWrite.update.fields.funnel.mapValue.fields.offersAccepted.integerValue, '1');
  assert.equal(body.writes.find((w: any) => w.update.name.endsWith('/opportunities/opp-1')).update.fields.funnelCountedStages.mapValue.fields.accepted.booleanValue, true);
});
