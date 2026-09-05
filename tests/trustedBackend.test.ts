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
    if (url.endsWith(':beginTransaction')) return new Response(JSON.stringify({ transaction: 'tx-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':commit')) return new Response(JSON.stringify({ commitTime: new Date().toISOString(), writeResults: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes(':rollback')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const match = url.match(/documents\/(.+?)\?transaction=/);
    if (!match) return new Response('{}', { status: 404 });
    const key = decodeURIComponent(match[1]);
    const data = docs[key];
    if (!data) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
    return new Response(JSON.stringify(firestoreDoc(key, data)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

test('CREATE_REQUIREMENT_CAMPAIGN commits requirement, campaign and audit atomically', async () => {
  const calls = installMock({
    'users/emp-1': { role: 'employer' },
  });
  const result = await backend.executeRecruitmentTransition({
    actorUid: 'emp-1', requestId: 'req-test-001', action: 'CREATE_REQUIREMENT_CAMPAIGN',
    payload: {
      requirement: { id: 'req-1', employerId: 'emp-1', role: 'Analyst' },
      campaign: { id: 'camp-1', requirementId: 'req-1', employerId: 'emp-1', funnel: {}, targetedInstitutionIds: [] },
    },
  });
  assert.equal(result.replayed, false);
  assert.deepEqual(result.ids, ['req-1', 'camp-1']);
  const commit = calls.find(c => c.url.includes(':commit'));
  assert.ok(commit);
  const body = JSON.parse(String(commit?.init?.body));
  assert.equal(body.writes.length, 3);
  assert.equal(body.writes.filter((w: any) => w.update.name.includes('/auditEvents/')).length, 1);
});

test('same requestId is replay-safe and performs no second commit', async () => {
  const auditId = 'a';
  const calls = installMock({ [`auditEvents/${auditId}`]: { immutable: true } });
  // The deterministic audit id is SHA-256, so instead exercise replay by deriving it from the implementation contract.
  const crypto = await import('node:crypto');
  const realId = crypto.createHash('sha256').update('replay-001:emp-1:CREATE_REQUIREMENT_CAMPAIGN').digest('hex');
  const calls2 = installMock({ [`auditEvents/${realId}`]: { immutable: true } });
  const result = await backend.executeRecruitmentTransition({ actorUid: 'emp-1', requestId: 'replay-001', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} });
  assert.equal(result.replayed, true);
  assert.equal(calls2.filter(c => c.url.includes(':commit')).length, 0);
  assert.equal(calls.filter(c => c.url.includes(':commit')).length, 0);
});

test('institution cannot execute employer-only transition', async () => {
  installMock({ 'users/inst-1': { role: 'institution' } });
  await assert.rejects(() => backend.executeRecruitmentTransition({ actorUid: 'inst-1', requestId: 'deny-test-1', action: 'CREATE_REQUIREMENT_CAMPAIGN', payload: {} }), /not authorized/);
});
