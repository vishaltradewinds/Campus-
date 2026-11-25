export interface ClientPrincipal {
 readonly uid:string;
 readonly email?:string|null;
 getIdToken():Promise<string>;
}
export interface ClientIdentitySource {
 readonly currentUser:ClientPrincipal|null;
}
export interface ClientIdentityLifecycle extends ClientIdentitySource {
 subscribe(listener:(user:ClientPrincipal|null)=>void):()=>void;
 signOut():Promise<void>;
}
export function createClientIdentityAccess(source:ClientIdentitySource){
 return {
  current:()=>source.currentUser,
  async requireToken(){
   const user=source.currentUser;
   if(!user)throw Error('Authentication is required.');
   const token=await user.getIdToken();
   if(source.currentUser!==user||!token)throw Error('Authentication changed. Retry.');
   return token;
  }
 };
}
