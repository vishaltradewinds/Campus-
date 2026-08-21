import React from 'react';
import { TalentNetworkProvider, useTalentNetwork } from './context/TalentNetworkContext';
import { Header } from './components/common/Header';
import { EmployerPortal } from './components/employer/EmployerPortal';
import { InstitutionPortal } from './components/institution/InstitutionPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { KillerLoopSimulation } from './components/simulation/KillerLoopSimulation';

const AppContent: React.FC = () => {
  const { activeRole } = useTalentNetwork();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col font-sans selection:bg-[#CCFF00] selection:text-black">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeRole === 'employer' && <EmployerPortal />}
        {activeRole === 'institution' && <InstitutionPortal />}
        {activeRole === 'student' && <StudentPortal />}
        {activeRole === 'simulation' && <KillerLoopSimulation />}
      </main>

      {/* Global Bold Typography Footer */}
      <footer className="border-t border-[#222] bg-[#0A0A0A] py-6 text-xs text-[#888]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center space-x-2">
            <span className="font-black text-white uppercase tracking-tight">NEXUSTALENT OS v2.4</span>
            <span className="text-[#444]">—</span>
            <span className="text-[#888] text-[11px] uppercase">Three-Sided Talent Matchmaking & Recruitment Architecture</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] uppercase tracking-wider">
            <span className="text-[#CCFF00] font-bold">● Network Synchronized</span>
            <span className="text-[#555]">|</span>
            <span className="text-[#aaa]">Demand Anchor ↔ Gateway ↔ Passport</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <TalentNetworkProvider>
      <AppContent />
    </TalentNetworkProvider>
  );
}

