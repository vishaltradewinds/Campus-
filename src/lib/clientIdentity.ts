export interface ClientPrincipal {
 readonly uid:string;
 getIdToken():Promise<string>;
}
export interface ClientIdentitySource {
 readonly currentUser:ClientPrincipal|null;
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
