import {auth} from './firebase';
import {createClientIdentityAccess} from './clientIdentity';
// Legacy adapter only; replace here after independent browser acceptance.
export const clientIdentity=createClientIdentityAccess(auth);
