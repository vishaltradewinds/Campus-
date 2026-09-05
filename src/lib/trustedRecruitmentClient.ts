import { auth } from './firebase';

export type RecruitmentTransitionAction = 'CREATE_REQUIREMENT_CAMPAIGN' | 'SEND_CALLS' | 'RESPOND_CALL' | 'ACTIVATE_STUDENTS' | 'SUBMIT_CONSENT' | 'UPDATE_CONSENT_SCOPE' | 'GLOBAL_CONSENT' | 'ADVANCE_CANDIDATE_STAGE';

export async function executeTrustedRecruitmentTransition(action: RecruitmentTransitionAction, payload: Record<string, any>) {
  if (!auth.currentUser) throw new Error('Authentication is required.');
  const requestId = crypto.randomUUID();
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/recruitment/transitions', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId, payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Recruitment transition failed (${response.status})`);
  return data;
}
