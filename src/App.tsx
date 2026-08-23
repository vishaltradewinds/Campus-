import React, { useEffect, useState } from 'react';
import { TalentNetworkProvider } from './context/TalentNetworkContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreens } from './components/auth/AuthScreens';
import { Header } from './components/common/Header';
import { EmployerPortal } from './components/employer/EmployerPortal';
import { InstitutionPortal } from './components/institution/InstitutionPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { SuperAdminPortal } from './components/admin/SuperAdminPortal';
import { KillerLoopSimulation } from './components/simulation/KillerLoopSimulation';
import { LandingPage } from './components/landing/LandingPage';

const AppContent: React.FC = () => {
  const { userData, loading } = useAuth();
  
  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<boolean>(true); // true = login, false = register
  const [initialAuthRole, setInitialAuthRole] = useState<'student' | 'institution' | 'employer'>('student');

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Forcing loading to false due to timeout in App.tsx");
        setLoadingTimeout(true);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono text-indigo-600">
        Loading NexusTalent OS...
      </div>
    );
  }

  if (!userData) {
    if (showAuth) {
      return (
        <AuthScreens 
          initialIsLogin={initialAuthMode}
          initialRole={initialAuthRole}
          onBack={() => setShowAuth(false)} 
        />
      );
    }

    return (
      <LandingPage
        onSelectAuth={(isLogin, role) => {
          setInitialAuthMode(isLogin);
          if (role) {
            setInitialAuthRole(role);
          }
          setShowAuth(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900">
      <Header onLoginClick={() => {
        setInitialAuthMode(true);
        setShowAuth(true);
      }} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {userData.role === 'employer' && <EmployerPortal />}
        {userData.role === 'institution' && <InstitutionPortal />}
        {userData.role === 'student' && <StudentPortal />}
        {userData.role === 'super_admin' && <SuperAdminPortal />}
        {userData.role === 'simulation' && <KillerLoopSimulation />}
      </main>

      {/* Global Bold Typography Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center space-x-2">
            <span className="font-black text-slate-900 uppercase tracking-tight">CAMPUS HIRING NETWORK</span>
            <span className="text-slate-300">—</span>
            <span className="text-slate-500 text-[11px]">Direct, transparent campus placement connecting Employers, Colleges, and Students</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span className="text-emerald-600 font-bold">● Network Active</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Employer ↔ College ↔ Student</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <TalentNetworkProvider>
        <AppContent />
      </TalentNetworkProvider>
    </AuthProvider>
  );
}

