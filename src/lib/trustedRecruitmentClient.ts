import { auth } from './firebase';

export type RecruitmentTransitionAction = 'CREATE_REQUIREMENT_CAMPAIGN' | 'SEND_CALLS' | 'RESPOND_CALL' | 'ACTIVATE_STUDENTS' | 'SUBMIT_CONSENT' | 'UPDATE_CONSENT_SCOPE' | 'GLOBAL_CONSENT' | 'ADVANCE_CANDIDATE_STAGE';

export async function executeTrustedRecruitmentTransition(action: RecruitmentTransitionAction, payload: Record<string, any>, requestId: string = crypto.randomUUID()) {
  if (!auth.currentUser) throw new Error('Authentication is required.');
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new Error('Invalid requestId.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/recruitment/transitions', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId, payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Recruitment transition failed (${response.status})`);
  return data;
}
