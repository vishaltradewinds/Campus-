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
import { UserRole } from '../../types';

export const Header: React.FC = () => {
  const {
    activeRole,
    setActiveRole,
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

        {/* Role Navigation & Perspective Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3 gap-3">
          {/* Role Tabs */}
          <nav className="flex space-x-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
            {roleTabs.map((tab) => {
              const isActive = activeRole === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`role-tab-${tab.id}`}
                  onClick={() => setActiveRole(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer whitespace-nowrap border ${
                    isActive
                      ? 'bg-[#CCFF00] text-black border-[#CCFF00] font-black'
                      : 'bg-[#111] text-[#AAA] border-[#222] hover:border-[#444] hover:text-white font-medium'
                  }`}
                >
                  <span className={`font-mono text-[10px] font-bold ${isActive ? 'text-black/70' : 'text-[#CCFF00]'}`}>
                    {tab.num}
                  </span>
                  <div className="text-left flex items-center gap-1.5">
                    <span className="font-bold tracking-tight uppercase">{tab.label}</span>
                    <span className={`text-[9px] font-mono hidden xl:inline ${
                      isActive ? 'text-black/80' : 'text-[#888]'
                    }`}>
                      ({tab.sub})
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sub-Entity Selector with clear label */}
          <div className="flex items-center space-x-2 text-xs w-full lg:w-auto justify-end font-mono">
            <span className="text-[#888] text-[11px] flex items-center gap-1 whitespace-nowrap">
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#CCFF00]" />
              <span>Switch user profile:</span>
            </span>

            {activeRole === 'employer' && (
              <select
                id="select-employer-dropdown"
                value={selectedEmployerId}
                onChange={(e) => setSelectedEmployerId(e.target.value)}
                aria-label="Select Employer"
                className="bg-[#111] text-white text-xs font-mono rounded-none px-3 py-1.5 border border-[#333] focus:outline-none focus:border-[#CCFF00] cursor-pointer"
              >
                {employers.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-[#111] text-white">
                    {emp.name} ({emp.headquarters})
                  </option>
                ))}
              </select>
            )}

            {activeRole === 'institution' && (
              <select
                id="select-institution-dropdown"
                value={selectedInstitutionId}
                onChange={(e) => setSelectedInstitutionId(e.target.value)}
                aria-label="Select Institution"
                className="bg-[#111] text-white text-xs font-mono rounded-none px-3 py-1.5 border border-[#333] focus:outline-none focus:border-[#CCFF00] cursor-pointer max-w-[260px] truncate"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id} className="bg-[#111] text-white">
                    {inst.name} ({inst.city})
                  </option>
                ))}
              </select>
            )}

            {activeRole === 'student' && (
              <select
                id="select-student-dropdown"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                aria-label="Select Student"
                className="bg-[#111] text-white text-xs font-mono rounded-none px-3 py-1.5 border border-[#333] focus:outline-none focus:border-[#CCFF00] cursor-pointer max-w-[260px] truncate"
              >
                {students.map((stu) => (
                  <option key={stu.id} value={stu.id} className="bg-[#111] text-white">
                    {stu.name} — {stu.branch.split(' ')[0]} ({stu.institutionCode})
                  </option>
                ))}
              </select>
            )}

            {activeRole === 'simulation' && (
              <span className="px-2.5 py-1 bg-[#181818] text-[#CCFF00] font-mono text-[10px] uppercase tracking-wider font-bold border border-[#333]">
                ⚡ Step-by-Step Flow
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
