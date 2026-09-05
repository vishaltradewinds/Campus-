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

export type RecruitmentTransitionAction = 'CREATE_REQUIREMENT_CAMPAIGN' | 'SEND_CALLS' | 'RESPOND_CALL' | 'ACTIVATE_STUDENTS' | 'SUBMIT_CONSENT' | 'UPDATE_CONSENT_SCOPE' | 'GLOBAL_CONSENT' | 'ADVANCE_CANDIDATE_STAGE';
export interface RecruitmentTransitionRequest { actorUid: string; requestId: string; action: RecruitmentTransitionAction; payload: Record<string, any> }
export interface RecruitmentTransitionResult { replayed: boolean; auditEventId: string; ids: string[] }
const REQUEST_RE = /^[A-Za-z0-9._:-]{8,128}$/;
function auditId(input: RecruitmentTransitionRequest): string { return createHash('sha256').update(`${input.requestId}:${input.actorUid}:${input.action}`).digest('hex'); }
function requireRole(actor: Record<string, any>, roles: string[]) { if (!roles.includes(actor.role)) throw new Error(`Role ${actor.role || 'unknown'} is not authorized for ${roles.join('/')}`); }
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

export async function executeRecruitmentTransition(input: RecruitmentTransitionRequest): Promise<RecruitmentTransitionResult> {
  if (!REQUEST_RE.test(input.requestId)) throw new Error('Invalid requestId');
  const transaction = await beginTransaction();
  try {
    const auditName = docName('auditEvents', auditId(input));
    const existingAudit = await getInTransaction(auditName, transaction);
    if (existingAudit) { await rollbackTransaction(transaction); return { replayed: true, auditEventId: auditId(input), ids: [] }; }
    const actorDoc = await getInTransaction(docName('users', input.actorUid), transaction);
    const actor = fromFirestoreDocument(actorDoc);
    if (!actor) throw new Error('Actor record was not found');
    const p = input.payload || {};
    const now = new Date().toISOString();
    const writes: Array<{ name: string; data: Record<string, unknown> }> = [];
    const ids: string[] = [];
    const read = async (collection: string, id: string) => fromFirestoreDocument(await getInTransaction(docName(collection, id), transaction));
    const must = async (collection: string, id: string) => { const value = await read(collection, id); if (!value) throw new Error(`${collection}/${id} was not found`); return value; };

    switch (input.action) {
      case 'CREATE_REQUIREMENT_CAMPAIGN': {
        requireRole(actor, ['employer']);
        const employerId = input.actorUid; const requirement = clone(p.requirement); const campaign = clone(p.campaign);
        if (!requirement?.id || !campaign?.id || campaign.requirementId !== requirement.id) throw new Error('Requirement and campaign identifiers are required and must match');
        if (requirement.employerId !== employerId || campaign.employerId !== employerId) throw new Error('Employer ownership mismatch');
        const existingRequirement = await read('requirements', requirement.id); const existingCampaign = await read('campaigns', campaign.id);
        if (existingRequirement || existingCampaign) throw new Error('Recruitment identifiers already exist; refusing to overwrite');
        writes.push({ name: docName('requirements', requirement.id), data: requirement }, { name: docName('campaigns', campaign.id), data: campaign }); ids.push(requirement.id, campaign.id); break;
      }
      case 'SEND_CALLS': {
        requireRole(actor, ['employer']); const campaign = await must('campaigns', p.campaignId);
        if (campaign.employerId !== input.actorUid) throw new Error('Employer is not authorized for this campaign');
        const calls = Array.isArray(p.calls) ? p.calls : []; if (!calls.length) throw new Error('At least one call is required');
        const existingIds = new Set<string>();
        for (const call of calls) { if (!call.id || call.campaignId !== campaign.id || call.employerId !== input.actorUid) throw new Error('Call ownership or campaign mismatch'); if (existingIds.has(call.id) || await read('calls', call.id)) throw new Error('One or more call identifiers already exist'); existingIds.add(call.id); }
        const targeted = Array.from(new Set([...(Array.isArray(campaign.targetedInstitutionIds) ? campaign.targetedInstitutionIds : []), ...calls.map((c: any) => c.institutionId)]));
        const updated = { ...campaign, targetedInstitutionIds: targeted, callsSent: [...(Array.isArray(campaign.callsSent) ? campaign.callsSent : []), ...calls], funnel: { ...campaign.funnel, institutionsInvited: targeted.length } };
        for (const call of calls) writes.push({ name: docName('calls', call.id), data: call }); writes.push({ name: docName('campaigns', campaign.id), data: updated }); ids.push(...calls.map((c: any) => c.id), campaign.id); break;
      }
      case 'RESPOND_CALL': {
        requireRole(actor, ['institution']); const call = await must('calls', p.callId); if (call.institutionId !== input.actorUid) throw new Error('Institution is not authorized for this call');
        const campaign = await must('campaigns', call.campaignId); const previous = call.status; if (previous !== 'pending') throw new Error('Call has already been responded to');
        const status = p.status; if (!['accepted','declined','countered'].includes(status)) throw new Error('Invalid call status');
        const updatedCall = { ...call, status, responseNotes: String(p.responseNotes || ''), offeredCandidatesCount: p.offeredCandidatesCount ?? call.vacanciesRequested * 2, counterDaysExtension: p.counterDaysExtension, respondedAt: now };
        const wasAccepted = previous !== 'pending' && previous !== 'declined'; const isAccepted = status !== 'pending' && status !== 'declined';
        const funnel = { ...campaign.funnel, institutionsAccepted: Math.max(0, Number(campaign.funnel?.institutionsAccepted || 0) + Number(isAccepted) - Number(wasAccepted)) };
        writes.push({ name: docName('calls', call.id), data: updatedCall }, { name: docName('campaigns', campaign.id), data: { ...campaign, funnel } }); ids.push(call.id, campaign.id); break;
      }
      case 'ACTIVATE_STUDENTS': {
        requireRole(actor, ['institution']); const call = await must('calls', p.callId); if (call.institutionId !== input.actorUid) throw new Error('Institution is not authorized for this call'); const campaign = await must('campaigns', call.campaignId); const studentIds = Array.isArray(p.studentIds) ? Array.from(new Set(p.studentIds)) : []; if (!studentIds.length) throw new Error('At least one student is required');
        const existingOppIds = new Set<string>(); const opportunities: any[] = [];
        for (const studentId of studentIds) { const student = await must('students', studentId); if (student.institutionId !== input.actorUid) throw new Error('Institution is not authorized for one or more students'); const id = String(p.opportunityIds?.[studentId] || createHash('sha256').update(`${call.id}:${studentId}`).digest('hex')); if (existingOppIds.has(id) || await read('opportunities', id)) throw new Error('Opportunity already exists; refusing to duplicate'); existingOppIds.add(id); opportunities.push({ id, callId: call.id, campaignId: campaign.id, employerId: call.employerId, employerName: call.employerName, role: call.role, salaryLPA: campaign.requirement?.salaryMinLPA || 0, locations: call.locations, joiningWindow: call.joiningWindow, studentId, studentName: student.name || 'Student', institutionId: call.institutionId, institutionName: call.institutionName, matchScore: 0, matchBreakdown: { skillMatchScore: 0, academicMatchScore: 0, preferenceMatchScore: 0, aiRationale: 'Candidate activated through institutional workflow; human evaluation required.' }, stage: 'invited', invitedAt: now, stageUpdatedAt: now }); }
        const existingList = Array.isArray(campaign.candidateOpportunities) ? campaign.candidateOpportunities : []; const updated = { ...campaign, candidateOpportunities: [...existingList, ...opportunities], funnel: { ...campaign.funnel, studentsInvited: Number(campaign.funnel?.studentsInvited || 0) + opportunities.length } };
        for (const opp of opportunities) writes.push({ name: docName('opportunities', opp.id), data: opp }); writes.push({ name: docName('campaigns', campaign.id), data: updated }); ids.push(...opportunities.map(o => o.id), campaign.id); break;
      }
      case 'SUBMIT_CONSENT': {
        requireRole(actor, ['student']); const opp = await must('opportunities', p.opportunityId); if (opp.studentId !== input.actorUid) throw new Error('Student is not authorized for this opportunity'); const campaign = await must('campaigns', opp.campaignId); const consented = Boolean(p.consented); const previousStage = opp.stage; const nextStage = consented ? 'assessment_pending' : 'declined'; if (previousStage !== 'invited' && previousStage !== 'declined' && previousStage !== 'assessment_pending') throw new Error('Opportunity is not in a consentable state'); const updatedOpp = { ...opp, stage: nextStage, consentedAt: consented ? now : undefined, stageUpdatedAt: now };
        const funnel = { ...campaign.funnel }; if (consented && previousStage !== 'assessment_pending') funnel.applicationsConsented = Number(funnel.applicationsConsented || 0) + 1; if (!consented && previousStage === 'assessment_pending') funnel.applicationsConsented = Math.max(0, Number(funnel.applicationsConsented || 0) - 1);
        writes.push({ name: docName('opportunities', opp.id), data: updatedOpp }, { name: docName('campaigns', campaign.id), data: { ...campaign, funnel } }); ids.push(opp.id, campaign.id); break;
      }
      case 'UPDATE_CONSENT_SCOPE': {
        requireRole(actor, ['student']); const student = await must('students', input.actorUid); const campaignId = String(p.campaignId); const consents = { ...(student.campaignConsents || {}) }; const current = consents[campaignId]; if (!current || current.status !== 'approved') throw new Error('Approved campaign consent is required before changing scope'); const key = p.scopeKey; if (!['academicDataShared','skillBenchmarksShared','projectReposShared','contactInfoShared'].includes(key)) throw new Error('Invalid consent scope'); consents[campaignId] = { ...current, [key]: Boolean(p.value), updatedAt: now }; writes.push({ name: docName('students', input.actorUid), data: { ...student, campaignConsents: consents } }); ids.push(input.actorUid, campaignId); break;
      }
      case 'GLOBAL_CONSENT': {
        requireRole(actor, ['student']); const student = await must('students', input.actorUid); const campaigns = Array.isArray(p.campaigns) ? p.campaigns : []; const consents = { ...(student.campaignConsents || {}) }; for (const campaign of campaigns) { if (!campaign?.id || campaign.employerId == null) throw new Error('Invalid campaign consent payload'); consents[campaign.id] = { campaignId: campaign.id, employerId: campaign.employerId, employerName: campaign.employerName, role: campaign.requirement?.role || 'Hiring Opportunity', salaryLPA: `₹${campaign.requirement?.salaryMinLPA || 0} - ${campaign.requirement?.salaryMaxLPA || 0} LPA`, status: p.approved ? 'approved' : 'denied', academicDataShared: Boolean(p.approved), skillBenchmarksShared: Boolean(p.approved), projectReposShared: Boolean(p.approved), contactInfoShared: Boolean(p.approved), updatedAt: now, ...(p.approved ? {} : { reasonForDenial: 'Student engaged Global Privacy Lock.' }) }; } writes.push({ name: docName('students', input.actorUid), data: { ...student, campaignConsents: consents } }); ids.push(input.actorUid); break;
      }
      case 'ADVANCE_CANDIDATE_STAGE': {
        const opp = await must('opportunities', p.opportunityId); const allowed = ['employer','institution','student']; requireRole(actor, allowed); if (actor.role === 'employer' && opp.employerId !== input.actorUid) throw new Error('Employer is not authorized for this opportunity'); if (actor.role === 'institution' && opp.institutionId !== input.actorUid) throw new Error('Institution is not authorized for this opportunity'); if (actor.role === 'student' && opp.studentId !== input.actorUid) throw new Error('Student is not authorized for this opportunity'); const nextStage = p.nextStage; if (!['invited','assessment_pending','assessment_completed','shortlisted','interviewing','offered','accepted','joined','declined'].includes(nextStage)) throw new Error('Invalid recruitment stage'); const campaign = await must('campaigns', opp.campaignId); const updatedOpp = { ...opp, stage: nextStage, assessmentScore: p.meta?.assessmentScore ?? opp.assessmentScore, interviewFeedback: p.meta?.interviewFeedback ?? opp.interviewFeedback, offerLetterUrl: p.meta?.offerLetterUrl ?? opp.offerLetterUrl, stageUpdatedAt: now }; const funnel = { ...campaign.funnel }; const increments: Record<string,string> = { assessment_completed:'assessmentsCompleted', shortlisted:'shortlisted', interviewing:'interviewed', offered:'offersMade', accepted:'offersAccepted', joined:'joined' }; if (increments[nextStage]) funnel[increments[nextStage]] = Number(funnel[increments[nextStage]] || 0) + (Number(funnel[increments[nextStage] + 'For_' + opp.id] || 0) ? 0 : 1) as any;
        const writesLocal: Array<{ name: string; data: Record<string, unknown> }> = [{ name: docName('opportunities', opp.id), data: updatedOpp }, { name: docName('campaigns', campaign.id), data: { ...campaign, funnel } }]; if (nextStage === 'joined' || nextStage === 'accepted') { const student = await must('students', opp.studentId); writesLocal.push({ name: docName('students', opp.studentId), data: { ...student, placementStatus: 'placed', placedCompany: opp.employerName, placedSalaryLPA: opp.salaryLPA, availability: 'not_currently_available' } }); } writes.push(...writesLocal); ids.push(opp.id, campaign.id); break;
      }
      default: throw new Error('Unsupported recruitment transition');
    }
    const audit = { eventId: auditId(input), requestId: input.requestId, actorUid: input.actorUid, actorRole: actor.role, action: input.action, ids, timestamp: now, immutable: true };
    writes.push({ name: auditName, data: audit });
    await commitTransaction(transaction, writes);
    return { replayed: false, auditEventId: audit.eventId as string, ids };
  } catch (error) { await rollbackTransaction(transaction); throw error; }
}
