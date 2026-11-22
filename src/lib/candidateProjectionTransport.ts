import type {AccountRequest} from './accountClient';

export interface CandidateProjectionInput {
  campaignId: string;
  studentId: string;
  requestId: string;
}

/**
 * Calls the trusted server-side projection service. The browser never writes
 * candidateProfiles directly. The server re-checks role, campaign targeting,
 * student ownership and explicit campaign consent before writing any projection.
 */
export async function requestCandidateProjection(request:AccountRequest,input: CandidateProjectionInput): Promise<{ projectionId: string; replayed: boolean; profile?: Record<string,any> }> {
  const response = await request('/api/candidate-projections', {
    method: 'POST', cache:'no-store', signal:AbortSignal.timeout(25000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({...input,view:true}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Candidate projection request failed');
  if(typeof data.projectionId!=='string'||!data.projectionId||typeof data.replayed!=='boolean'||(data.profile!==undefined&&(!data.profile||typeof data.profile!=='object'||Array.isArray(data.profile))))throw new Error('Invalid projection response');
  return { projectionId:data.projectionId,replayed:data.replayed,profile:data.profile };
}
