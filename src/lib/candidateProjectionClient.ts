import {clientIdentity} from './activeClientIdentity';
import {requestCandidateProjection,type CandidateProjectionInput} from './candidateProjectionTransport';
export type {CandidateProjectionInput} from './candidateProjectionTransport';
export function provisionCandidateProjection(input:CandidateProjectionInput){return requestCandidateProjection(async(path,init)=>{const headers=new Headers(init?.headers);headers.set('Authorization','Bearer '+await clientIdentity.requireToken());return fetch(path,{...init,headers});},input);}
