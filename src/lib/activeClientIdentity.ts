import {onAuthStateChanged,signOut,signInWithEmailAndPassword,createUserWithEmailAndPassword,signInWithPopup} from 'firebase/auth';
import {auth,googleProvider} from './firebase';
import {createClientIdentityAccess,type ClientIdentityLifecycle} from './clientIdentity';
// Legacy adapter only; replace after independent browser acceptance.
export const activeIdentity:ClientIdentityLifecycle={get currentUser(){return auth.currentUser;},subscribe:listener=>onAuthStateChanged(auth,listener),signOut:()=>signOut(auth)};
export const clientIdentity=createClientIdentityAccess(activeIdentity);

export const interactiveIdentity={signIn:async(email:string,password:string)=>(await signInWithEmailAndPassword(auth,email,password)).user,register:async(email:string,password:string)=>(await createUserWithEmailAndPassword(auth,email,password)).user,signInWithGoogle:async()=>(await signInWithPopup(auth,googleProvider)).user};
