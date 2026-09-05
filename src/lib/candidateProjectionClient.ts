import { auth } from './firebase';

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
export async function provisionCandidateProjection(input: CandidateProjectionInput): Promise<{ projectionId: string; replayed: boolean }> {
  if (!auth.currentUser) throw new Error('Authentication is required.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/candidate-projections', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Candidate projection request failed');
  return { projectionId: String(data.projectionId), replayed: Boolean(data.replayed) };
}
