import React, { useEffect, useState } from 'react';
import { TalentNetworkProvider, useTalentNetwork } from './context/TalentNetworkContext';
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
  const { userData, loading, signOut } = useAuth();
  const { workspaceStatus, retryWorkspace } = useTalentNetwork();
  
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

  if (loading && !showAuth && !loadingTimeout) {
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
      {workspaceStatus === 'ready' && <Header onLoginClick={() => {
        setInitialAuthMode(true);
        setShowAuth(true);
      }} />}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {workspaceStatus !== 'ready' ? <section role="status" className="max-w-lg mx-auto mt-12 p-6 bg-white border border-slate-200 rounded-xl">
          <h2 className="text-xl font-bold">{workspaceStatus==='loading'?'Connecting to your workspace':workspaceStatus==='missing'?'Workspace profile missing':'Workspace temporarily unavailable'}</h2>
          <p className="mt-3 text-sm text-slate-600">{workspaceStatus==='loading'?'Waiting for a confirmed database response.':workspaceStatus==='missing'?'Your account is signed in, but its stakeholder record needs administrator review.':'Your records could not be loaded. Check your connection or try again later.'}</p>
          <div className="flex flex-wrap gap-3 mt-5"><button onClick={retryWorkspace} className="bg-indigo-700 text-white px-4 py-2 rounded-lg">Retry connection</button><button onClick={()=>void signOut()} className="border px-4 py-2 rounded-lg">Sign out</button></div>
        </section> : <>
        {userData.role === 'employer' && <EmployerPortal />}
        {userData.role === 'institution' && <InstitutionPortal />}
        {userData.role === 'student' && <StudentPortal />}
        {userData.role === 'super_admin' && <SuperAdminPortal />}
        {userData.role === 'simulation' && <KillerLoopSimulation />}
        </>}
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
            <span className="text-emerald-600 font-bold">{workspaceStatus==='ready'?'Network connected':'Connection pending'}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Employer ↔ College ↔ Student</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AccountWorkspace: React.FC = () => {
  const { user, userData } = useAuth();
  // Remount all role-local listeners and UI state on principal/role changes.
  const scope = user && userData?.uid === user.uid ? user.uid + ':' + userData.role : 'anonymous';
  return <TalentNetworkProvider key={scope}><AppContent /></TalentNetworkProvider>;
};

export default function App() {
  return <AuthProvider><AccountWorkspace /></AuthProvider>;
}

