import { createHash } from 'node:crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const DATABASE = `(default)`;
const FIRESTORE_BASE = PROJECT_ID ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE)}/documents` : '';
interface FirestoreDocument { name?: string; fields?: Record<string, FirestoreValue> }
interface FirestoreValue { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: string; timestampValue?: string; arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> } }
function fromFirestoreValue(value?: FirestoreValue): unknown { if (!value) return undefined; if ('stringValue' in value) return value.stringValue; if ('integerValue' in value) return Number(value.integerValue); if ('doubleValue' in value) return value.doubleValue; if ('booleanValue' in value) return value.booleanValue; if ('nullValue' in value) return null; if ('timestampValue' in value) return value.timestampValue; if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestoreValue); if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)])); return undefined; }
function fromFirestoreDocument(document?: FirestoreDocument): Record<string, any> | null { if (!document) return null; return Object.fromEntries(Object.entries(document.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)])); }
function toFirestoreValue(value: unknown): FirestoreValue { if (value === null || value === undefined) return { nullValue: 'NULL_VALUE' }; if (typeof value === 'string') return { stringValue: value }; if (typeof value === 'boolean') return { booleanValue: value }; if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }; if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } }; if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toFirestoreValue(v)])) } }; throw new Error('Unsupported Firestore value type'); }
function toDocument(name: string, data: Record<string, unknown>): FirestoreDocument { return { name, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)])) }; }
function docName(collection: string, id: string): string { if (!PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required for trusted Firestore operations'); return `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`; }
async function metadataAccessToken(): Promise<string> { const configured = process.env.GOOGLE_OAUTH_ACCESS_TOKEN; if (configured) return configured; const response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } }); if (!response.ok) throw new Error(`Unable to obtain Google workload identity token (${response.status})`); const data = await response.json() as { access_token?: string }; if (!data.access_token) throw new Error('Google workload identity token was not returned'); return data.access_token; }
async function firestoreRequest<T>(url: string, init: RequestInit = {}): Promise<T> { const token = await metadataAccessToken(); const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } }); if (!response.ok) { const body = await response.text(); throw new Error(`Firestore trusted request failed (${response.status}): ${body.slice(0, 500)}`); } return response.status === 204 ? {} as T : await response.json() as T; }
async function beginTransaction(): Promise<string> { const result = await firestoreRequest<{ transaction?: string }>(`${FIRESTORE_BASE}:beginTransaction`, { method: 'POST', body: JSON.stringify({ options: { readWrite: {} } }) }); if (!result.transaction) throw new Error('Firestore transaction was not created'); return result.transaction; }
async function getInTransaction(name: string, transaction: string): Promise<FirestoreDocument | null> { try { return await firestoreRequest<FirestoreDocument>(`${name}?transaction=${encodeURIComponent(transaction)}`); } catch (error) { if (String(error).includes('(404)')) return null; throw error; } }
async function commitTransaction(transaction: string, documents: Array<{ name: string; data: Record<string, unknown> }>): Promise<void> { await firestoreRequest(`${FIRESTORE_BASE}:commit`, { method: 'POST', body: JSON.stringify({ transaction, writes: documents.map(item => ({ update: toDocument(item.name, item.data) })) }) }); }
async function rollbackTransaction(transaction: string): Promise<void> { try { await firestoreRequest(`${FIRESTORE_BASE}:rollback`, { method: 'POST', body: JSON.stringify({ transaction }) }); } catch { /* best effort */ } }
function projectionId(employerId: string, campaignId: string, studentId: string): string { return createHash('sha256').update(`${employerId}:${campaignId}:${studentId}`).digest('hex'); }
export interface CandidateProjectionRequest { actorUid: string; campaignId: string; studentId: string; requestId: string }
export async function provisionCandidateProjection(input: CandidateProjectionRequest): Promise<{ projectionId: string; replayed: boolean }> {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.requestId)) throw new Error('Invalid requestId');
  const transaction = await beginTransaction();
  try {
    const [actorDoc, campaignDoc, studentDoc] = await Promise.all([getInTransaction(docName('users', input.actorUid), transaction), getInTransaction(docName('campaigns', input.campaignId), transaction), getInTransaction(docName('students', input.studentId), transaction)]);
    const actor = fromFirestoreDocument(actorDoc); const campaign = fromFirestoreDocument(campaignDoc); const student = fromFirestoreDocument(studentDoc);
    if (!actor || !campaign || !student) throw new Error('Required recruitment records were not found');
    const role = actor.role;
    if (role !== 'employer' && role !== 'institution') throw new Error('Only employers or institutions may provision candidate projections');
    if (role === 'employer' && campaign.employerId !== input.actorUid) throw new Error('Employer is not authorized for this campaign');
    if (role === 'institution' && !(Array.isArray(campaign.targetedInstitutionIds) && campaign.targetedInstitutionIds.includes(input.actorUid))) throw new Error('Institution is not targeted by this campaign');
    if (role === 'institution' && student.institutionId !== input.actorUid) throw new Error('Institution is not authorized for this student');
    const consent = student.campaignConsents?.[input.campaignId];
    if (!consent || consent.status !== 'approved') throw new Error('Explicit campaign consent is required before projection');
    if (consent.employerId !== campaign.employerId) throw new Error('Consent does not match the campaign employer');
    const id = projectionId(campaign.employerId, input.campaignId, input.studentId);
    const projectionName = docName('candidateProfiles', id);
    const auditName = docName('auditEvents', createHash('sha256').update(`${input.requestId}:${input.actorUid}:${input.campaignId}:${input.studentId}`).digest('hex'));
    const [existingProjection, existingAudit] = await Promise.all([getInTransaction(projectionName, transaction), getInTransaction(auditName, transaction)]);
    if (existingAudit) { await rollbackTransaction(transaction); return { projectionId: id, replayed: true }; }
    const projection: Record<string, unknown> = { studentId: input.studentId, employerId: campaign.employerId, campaignId: input.campaignId, role: campaign.requirement?.role || 'Hiring Opportunity', name: student.name || 'Candidate', institutionId: student.institutionId || '', institutionName: student.institutionName || '', candidateType: student.candidateType || 'unknown', consentStatus: 'approved', consentUpdatedAt: consent.updatedAt || new Date().toISOString(), projectionVersion: 1, updatedAt: new Date().toISOString() };
    if (consent.academicDataShared) Object.assign(projection, { program: student.program || '', branch: student.branch || '', graduationYear: student.graduationYear || 0, cgpa: student.cgpa || 0 });
    if (consent.skillBenchmarksShared) projection.verifiedSkills = Array.isArray(student.skills) ? student.skills.filter((skill: any) => ['Gold', 'Silver', 'Bronze', 'Verified'].includes(skill?.badge)).map((skill: any) => ({ name: skill.name, category: skill.category, score: skill.score, badge: skill.badge })) : [];
    if (consent.projectReposShared) projection.projects = Array.isArray(student.projects) ? student.projects : [];
    if (consent.contactInfoShared) projection.email = student.email || '';
    const audit = { eventId: auditName.split('/').pop(), requestId: input.requestId, actorUid: input.actorUid, actorRole: role, subjectStudentId: input.studentId, employerId: campaign.employerId, campaignId: input.campaignId, action: 'CANDIDATE_PROJECTION_PROVISIONED', consentScope: { academicDataShared: !!consent.academicDataShared, skillBenchmarksShared: !!consent.skillBenchmarksShared, projectReposShared: !!consent.projectReposShared, contactInfoShared: !!consent.contactInfoShared }, projectionId: id, timestamp: new Date().toISOString(), immutable: true };
    await commitTransaction(transaction, existingProjection ? [{ name: auditName, data: audit }] : [{ name: projectionName, data: projection }, { name: auditName, data: audit }]);
    return { projectionId: id, replayed: false };
  } catch (error) { await rollbackTransaction(transaction); throw error; }
}
