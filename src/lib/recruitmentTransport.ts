export type TrustedProfileMutationAction =
  | 'REQUEST_ACADEMIC_CORRECTION'
  | 'REVIEW_ACADEMIC_CORRECTION'
  | 'UPDATE_GLOBAL_PRIVACY'
  | 'PUBLISH_INSTITUTION_AVAILABILITY'
  | 'UPDATE_STUDENT_AVAILABILITY'
  | 'ADD_VERIFIED_SKILL'
  | 'UPDATE_EMPLOYER_VERIFICATION'
  | 'UPDATE_INSTITUTION_EMPANELMENT'
  | 'UPDATE_STUDENT_INSTITUTION_VERIFICATION'
  | 'UPDATE_STUDENT_PLATFORM_VERIFICATION'
  | 'REGISTER_INDEPENDENT_CANDIDATE'
  | 'PROVISION_USER_ROLE'
  | 'REVIEW_CAREER_EVIDENCE'
  | 'DISPUTE_CAREER_EVIDENCE'
  | 'RESOLVE_CAREER_EVIDENCE_DISPUTE';

import type {AccountRequest} from './accountClient';

export type RecruitmentTransitionAction = 'CREATE_REQUIREMENT_CAMPAIGN' | 'SEND_CALLS' | 'RESPOND_CALL' | 'ACTIVATE_STUDENTS' | 'SUBMIT_CONSENT' | 'UPDATE_CONSENT_SCOPE' | 'GLOBAL_CONSENT' | 'ADVANCE_CANDIDATE_STAGE';

export function createRecruitmentClient(request:AccountRequest,changed:()=>void=()=>{}) {
async function executeTrustedRecruitmentTransition(action: RecruitmentTransitionAction, payload: Record<string, any>, requestId: string = crypto.randomUUID()) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new Error('Invalid requestId.');
  const response = await request('/api/recruitment/transitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId, payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Recruitment transition failed (${response.status})`);
  changed();
  return data;
}


async function executeTrustedProfileMutation(action: TrustedProfileMutationAction, payload: Record<string, any>, requestId: string = crypto.randomUUID()) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new Error('Invalid requestId.');
  const response = await request('/api/profile/mutations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId, payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Profile mutation failed (${response.status})`);
  changed();
  return data;
}

 return {executeTrustedRecruitmentTransition,executeTrustedProfileMutation};
}
