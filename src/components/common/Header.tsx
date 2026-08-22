import React from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { useAuth } from '../../context/AuthContext';
import { Activity, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  onLoginClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
  const {
    requirements,
    callsForTalent,
    studentOpportunities,
  } = useTalentNetwork();

  const { userData, signOut } = useAuth();

  const totalDemands = requirements.reduce((acc, r) => acc + r.vacancies, 0);
  const totalCalls = callsForTalent.length;
  const consentedApps = studentOpportunities.filter(
    (o) => o.stage !== 'invited' && o.stage !== 'declined'
  ).length;
  const totalJoined = studentOpportunities.filter(
    (o) => o.stage === 'joined' || o.stage === 'accepted' || o.stage === 'offered'
  ).length;

  return (
    <header className="bg-[#0A0A0A] border-b border-[#222] text-[#F5F5F5] sticky top-0 z-50">
      {/* Top Bar with Brand & Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-[#222] gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-[#CCFF00] text-black font-black flex items-center justify-center text-xl tracking-tighter shrink-0 select-none">
              NT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#CCFF00] font-mono text-[10px] tracking-wider uppercase font-bold">
                  NexusTalent OS
                </span>
                <span className="text-[#444] font-mono text-[10px]">|</span>
                <span className="text-[#888] font-mono text-[10px]">
                  Unified Indian Campus & Employment Ecosystem
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black leading-none tracking-tight uppercase italic text-white flex items-center gap-2">
                National <span className="text-[#CCFF00]">Campus Network</span>
              </h1>
            </div>
          </div>

          {/* Activity Statistics in Plain English */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Network Status</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold flex items-center justify-end gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse"></span>
                LIVE CLOUD
              </p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Active Vacancies</p>
              <p className="text-white font-mono text-sm sm:text-base font-bold">{totalDemands.toLocaleString()}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Campus Drives</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold">{totalCalls}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6 hidden sm:block">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Applications</p>
              <p className="text-white font-mono text-sm sm:text-base font-bold">{consentedApps}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6 hidden md:block">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Offers & Hires</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold">{totalJoined}</p>
            </div>
          </div>
        </div>

        {/* Role Navigation & User Info */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3 gap-3">
          
          {/* User Status Tab */}
          <nav className="flex space-x-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
            {userData ? (
              <div className="flex items-center gap-2 px-3.5 py-2 text-xs border bg-[#CCFF00] text-black border-[#CCFF00] font-black">
                <span className="font-mono text-[10px] font-bold text-black/70">
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
              <div className="flex items-center gap-2 px-3.5 py-2 text-xs border bg-[#111] text-[#AAA] border-[#222] font-medium">
                <span className="font-mono text-[10px] font-bold text-[#AAA]">
                  Welcome to National Campus Network
                </span>
              </div>
            )}
          </nav>

          {/* Sub-Entity Selector & Sign Out */}
          <div className="flex items-center space-x-2 text-xs w-full lg:w-auto justify-end font-mono">
            {userData ? (
              <>
                <span className="text-[#888] text-[11px] flex items-center gap-1.5 whitespace-nowrap hidden sm:flex bg-[#161616] px-3 py-1.5 border border-[#2E2E2E]">
                  <User className="w-3 h-3 text-[#CCFF00]" />
                  <span className="font-bold text-white uppercase">{userData.name}</span>
                  <span className="text-[#555]">({userData.email})</span>
                </span>
                <button 
                  onClick={signOut}
                  className="ml-4 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-[#F5F5F5] bg-rose-950/40 border border-rose-900 hover:bg-rose-900/60 transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={onLoginClick}
                  className="ml-4 px-4 py-1.5 text-[11px] uppercase font-bold tracking-wider text-black bg-[#CCFF00] hover:bg-[#b8e600] transition-colors cursor-pointer"
                >
                  Login / Register
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
