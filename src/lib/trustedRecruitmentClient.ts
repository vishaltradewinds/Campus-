import {clientIdentity} from './activeClientIdentity';
import {createRecruitmentClient} from './recruitmentTransport';
export type {RecruitmentTransitionAction,TrustedProfileMutationAction} from './recruitmentTransport';
const client=createRecruitmentClient(async(path,init)=>{const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+await clientIdentity.requireToken());return fetch(path,{...init,headers});},()=>window.dispatchEvent(new Event('nexustalent:workspace-changed')));
export const {executeTrustedRecruitmentTransition,executeTrustedProfileMutation}=client;
