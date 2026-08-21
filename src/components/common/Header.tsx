import React from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  Briefcase,
  Building2,
  GraduationCap,
  Sparkles,
  RotateCcw,
  Users,
  CheckCircle2,
  Send,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface HeaderProps {
  onLoginClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
  const {
    
    
    employers,
    selectedEmployerId,
    setSelectedEmployerId,
    institutions,
    selectedInstitutionId,
    setSelectedInstitutionId,
    students,
    selectedStudentId,
    setSelectedStudentId,
    requirements,
    callsForTalent,
    studentOpportunities,
    resetDemoData,
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

  const roleTabs: { id: UserRole; label: string; sub: string; num: string; icon: React.ReactNode }[] = [
    {
      id: 'employer',
      label: 'Employers',
      sub: 'Post Jobs & Hire',
      num: '01',
      icon: <Briefcase className="w-3.5 h-3.5" />,
    },
    {
      id: 'institution',
      label: 'Colleges',
      sub: 'Placement Cell',
      num: '02',
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'student',
      label: 'Students',
      sub: 'Jobs & Permissions',
      num: '03',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
    },
    {
      id: 'simulation',
      label: 'How It Works',
      sub: 'Interactive Demo',
      num: '04',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <header className="bg-[#0A0A0A] border-b border-[#222] text-[#F5F5F5] sticky top-0 z-50">
      {/* Top Bar with Brand & Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-[#222] gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-[#CCFF00] text-black font-black flex items-center justify-center text-xl tracking-tighter shrink-0 select-none">
              CH
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#CCFF00] font-mono text-[10px] tracking-wider uppercase">
                  Campus Hiring Platform
                </span>
                <span className="text-[#444] font-mono text-[10px]">|</span>
                <span className="text-[#888] font-mono text-[10px]">
                  Direct Student-to-Employer Network
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black leading-none tracking-tight uppercase italic text-white flex items-center gap-2">
                Campus <span className="text-[#CCFF00]">Exchange</span>
              </h1>
            </div>
          </div>

          {/* Network Health Indicators in Plain English */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Platform Status</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold flex items-center justify-end gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse"></span>
                ONLINE
              </p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Open Positions</p>
              <p className="text-white font-mono text-sm sm:text-base font-bold">{totalDemands.toLocaleString()}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Campus Drives</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold">{totalCalls}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6 hidden sm:block">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Student Applications</p>
              <p className="text-white font-mono text-sm sm:text-base font-bold">{consentedApps}</p>
            </div>
            <div className="text-right border-l border-[#222] pl-4 sm:pl-6 hidden md:block">
              <p className="text-[#888] text-[9px] font-mono uppercase tracking-wider">Hired Students</p>
              <p className="text-[#CCFF00] font-mono text-sm sm:text-base font-bold">{totalJoined}</p>
            </div>

            {/* Reset Demo Button */}
            <div className="border-l border-[#222] pl-4 sm:pl-6">
              <button
                id="reset-demo-btn"
                onClick={resetDemoData}
                title="Reset data back to initial demo state"
                className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#888] hover:text-[#CCFF00] px-2.5 py-1.5 border border-[#333] hover:border-[#CCFF00] bg-[#111] transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden lg:inline">Reset Demo</span>
              </button>
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
                    {userData.role === 'employer' ? 'Employer Portal' : 
                     userData.role === 'institution' ? 'College Portal' : 
                     userData.role === 'student' ? 'Student Portal' : 
                     userData.role === 'super_admin' ? 'System Administrator' : 'Portal'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 text-xs border bg-[#111] text-[#AAA] border-[#222] font-medium">
                <span className="font-mono text-[10px] font-bold text-[#AAA]">
                  Welcome to NexusTalent OS
                </span>
              </div>
            )}
          </nav>

          {/* Sub-Entity Selector & Sign Out */}
          <div className="flex items-center space-x-2 text-xs w-full lg:w-auto justify-end font-mono">
            {userData ? (
              <>
                <span className="text-[#888] text-[11px] flex items-center gap-1 whitespace-nowrap hidden sm:flex">
                  <span className="font-bold text-white uppercase">{userData.name}</span>
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
