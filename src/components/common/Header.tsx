import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { useAuth } from '../../context/AuthContext';
import { Activity, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  onLoginClick?: () => void;
  isLandingPage?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onLoginClick, isLandingPage = false }) => {
  const {
    requirements,
    callsForTalent,
    studentOpportunities,
  } = useTalentNetwork();

  const { userData, signOut } = useAuth();
  const [connectivity,setConnectivity]=useState<'idle'|'checking'|'connected'|'unavailable'>('idle');
  const checkConnection=async()=>{
    if(connectivity==='checking')return;
    const principal=auth.currentUser;
    if(!principal){setConnectivity('unavailable');return;}
    setConnectivity('checking');
    try{
      const token=await principal.getIdToken();
      const result=await fetch('/api/recruitment/connectivity',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(25000)});
      const data=await result.json();
      if(auth.currentUser?.uid!==principal.uid)return;
      setConnectivity(result.ok&&data.status==='connected'&&data.scope==='trusted_read_only'?'connected':'unavailable');
    }catch{if(auth.currentUser?.uid===principal.uid)setConnectivity('unavailable');}
  };

  const totalDemands = requirements.reduce((acc, r) => acc + r.vacancies, 0);
  const totalCalls = callsForTalent.length;
  const consentedApps = studentOpportunities.filter(
    (o) => o.stage !== 'invited' && o.stage !== 'declined'
  ).length;
  const totalJoined = studentOpportunities.filter(
    (o) => o.stage === 'joined'
  ).length;

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 md:sticky md:top-0 z-50 shadow-sm">
      {/* Top Bar with Brand & Stats */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isLandingPage ? 'bg-white/70 backdrop-blur-md rounded-2xl border border-white shadow-sm mt-4' : ''}`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between py-4 ${isLandingPage ? '' : 'border-b border-slate-100'} gap-4`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-indigo-600 text-slate-900 rounded-xl font-black flex items-center justify-center text-xl tracking-tighter shrink-0 select-none shadow-md">
              NT
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-indigo-600 font-mono text-[10px] tracking-wider uppercase font-bold">
                  NexusTalent OS
                </span>
                <span className="text-slate-300 font-mono text-[10px]">|</span>
                <span className="text-slate-500 font-mono text-[10px]">
                  Unified Indian Campus & Employment Ecosystem
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black leading-tight tracking-tight uppercase italic text-slate-900 break-words">
                National <span className="text-indigo-600">Campus Network</span>
              </h1>
            </div>
          </div>

          {/* Activity Statistics in Plain English */}
          {!isLandingPage && (
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="text-right">
                <p className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Workspace</p>
                <p className="text-emerald-600 font-mono text-sm sm:text-base font-bold flex items-center justify-end gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ROLE-SCOPED
                </p>
              </div>
              <div className="text-right border-l border-slate-200 pl-4 sm:pl-6">
                <p className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Active Vacancies</p>
                <p className="text-slate-800 font-mono text-sm sm:text-base font-bold">{totalDemands.toLocaleString()}</p>
              </div>
              <div className="text-right border-l border-slate-200 pl-4 sm:pl-6">
                <p className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Campus Drives</p>
                <p className="text-indigo-600 font-mono text-sm sm:text-base font-bold">{totalCalls}</p>
              </div>
              <div className="text-right border-l border-slate-200 pl-4 sm:pl-6 hidden sm:block">
                <p className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Applications</p>
                <p className="text-slate-800 font-mono text-sm sm:text-base font-bold">{consentedApps}</p>
              </div>
              <div className="text-right border-l border-slate-200 pl-4 sm:pl-6 hidden md:block">
                <p className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Recorded Joining</p>
                <p className="text-emerald-600 font-mono text-sm sm:text-base font-bold">{totalJoined}</p>
              </div>
            </div>
          )}

          {isLandingPage && (
            <div className="flex items-center gap-4">
              <button 
                onClick={onLoginClick}
                className="px-6 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Log In
              </button>
            </div>
          )}
        </div>

        {/* Role Navigation & User Info */}
        {!isLandingPage && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3 gap-3">
            {/* User Status Tab */}
            <nav className="flex space-x-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
              {userData ? (
                <div className="flex items-center gap-2 px-3.5 py-2 text-xs border bg-indigo-50 text-indigo-900 border-indigo-200 font-black rounded-lg">
                  <span className="font-mono text-[10px] font-bold text-indigo-500">
                    ●
                  </span>
                  <div className="text-left flex items-center gap-1.5">
                    <span className="font-bold tracking-tight uppercase">
                      {userData.role === 'employer' ? 'Corporate Employer Portal' : 
                       userData.role === 'institution' ? 'University Placement Cell (TPO)' : 
                       userData.role === 'student' ? 'Student Career Passport' : 
                       userData.role === 'super_admin' ? 'National Governance Dashboard' : 'Portal'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-2 text-xs border bg-slate-50 text-slate-500 border-slate-200 font-medium rounded-lg">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    Welcome to National Campus Network
                  </span>
                </div>
              )}
            </nav>

            {/* Sub-Entity Selector & Sign Out */}
            <div className="flex items-center space-x-2 text-xs w-full lg:w-auto justify-end font-mono">
              {userData ? (
                <>
                  <span className="text-slate-600 text-[11px] flex items-center gap-1.5 whitespace-nowrap hidden sm:flex bg-white px-3 py-1.5 border border-slate-200 rounded-lg">
                    <User className="w-3 h-3 text-indigo-600" />
                    <span className="font-bold text-slate-800 uppercase">{userData.name}</span>
                    <span className="text-slate-500">({userData.email})</span>
                  </span>
                  <button 
                    onClick={signOut}
                    className="ml-4 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer rounded-lg"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={onLoginClick}
                    className="ml-4 px-4 py-1.5 text-[11px] uppercase font-bold tracking-wider text-slate-900 bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer rounded-lg shadow-sm"
                  >
                    Login / Register
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {userData && !isLandingPage && <div className="pb-3 flex flex-wrap items-center gap-2 text-xs"><button type="button" disabled={connectivity==='checking'} onClick={()=>void checkConnection()} className="px-3 py-2 border rounded-lg text-indigo-700 disabled:opacity-50">{connectivity==='checking'?'Checking connection...':'Check recruitment connection'}</button><span role="status" className="text-slate-600">{connectivity==='connected'?'Server database read confirmed. Writes not tested.':connectivity==='unavailable'?'Recruitment server unavailable. Try again later.':'Optional read-only connection check.'}</span></div>}
      </div>
    </header>
  );
};
