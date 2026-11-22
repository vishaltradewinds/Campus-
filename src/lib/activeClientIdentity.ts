import {onAuthStateChanged,signOut} from 'firebase/auth';
import {auth} from './firebase';
import {createClientIdentityAccess,type ClientIdentityLifecycle} from './clientIdentity';
// Legacy adapter only; replace after independent browser acceptance.
export const activeIdentity:ClientIdentityLifecycle={get currentUser(){return auth.currentUser;},subscribe:listener=>onAuthStateChanged(auth,listener),signOut:()=>signOut(auth)};
export const clientIdentity=createClientIdentityAccess(activeIdentity);
