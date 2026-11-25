// One in-flight read per identity scope. Mutations always cause a fresh read;
// focus events coalesce with concurrent reads and recent successful refreshes.
export function createWorkspaceRefresh<T>(options:{
 read:()=>Promise<T>;apply:(value:T)=>void;unavailable:()=>void;
 now?:()=>number;focusCooldownMs?:number;
}){
 const now=options.now??Date.now,cooldown=options.focusCooldownMs??1000;
 let active=true,running=false,pendingMutation=false,lastSuccess:number|null=null;
 async function refresh(reason:'initial'|'focus'|'mutation'|'retry'){
  if(!active)return;
  if(running){if(reason==='mutation'||reason==='retry')pendingMutation=true;return;}
  if(reason==='focus'&&lastSuccess!==null&&now()-lastSuccess<cooldown)return;
  running=true;
  try{
   const value=await options.read();
   if(active&&!pendingMutation){options.apply(value);lastSuccess=now();}
  }catch{
   if(active&&!pendingMutation){lastSuccess=null;options.unavailable();}
  }finally{
   running=false;
   if(active&&pendingMutation){pendingMutation=false;await refresh('mutation');}
  }
 }
 return {refresh,dispose(){active=false;pendingMutation=false;}};
}
