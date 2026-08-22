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

const AppContent: React.FC = () => {
  const { userData, loading } = useAuth();
  
  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<boolean>(true); // true = login, false = register

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
          onBack={() => setShowAuth(false)} 
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-hidden relative">
        {/* Virtual Campus Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-indigo-100/50 blur-3xl"></div>
          <div className="absolute bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-50/60 blur-3xl"></div>
          <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] rounded-full bg-amber-50/50 blur-3xl"></div>
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwgMCwgMCwgMC4wNSkiLz48L3N2Zz4=')] opacity-70"></div>
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          <Header onLoginClick={() => {
            setInitialAuthMode(true);
            setShowAuth(true);
          }} isLandingPage={true} />
          
          <main className="flex-1 w-full flex flex-col justify-center relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Column: Copy & Actions */}
              <div className="text-left max-w-2xl">
                <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-6">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase">The New Standard in Campus Hiring</span>
                </div>
                
                <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.1]">
                  Step into the <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">
                    Virtual Campus
                  </span>
                </h1>
                
                <p className="text-lg lg:text-xl text-slate-600 mb-10 leading-relaxed font-medium">
                  Connect instantly with thousands of verified students from top-tier institutions. Streamline your hiring pipeline, host virtual placement drives, and build your future workforce in one vibrant ecosystem.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <button 
                    onClick={() => { setInitialAuthMode(false); setShowAuth(true); }}
                    className="bg-indigo-600 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all w-full sm:w-auto text-center"
                  >
                    Start Hiring Now
                  </button>
                  <button 
                    onClick={() => { setInitialAuthMode(true); setShowAuth(true); }}
                    className="bg-white text-slate-700 border border-slate-200 font-bold px-8 py-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all w-full sm:w-auto text-center shadow-sm"
                  >
                    Employer Login
                  </button>
                </div>
                
                <div className="mt-10 flex items-center space-x-4 text-sm text-slate-500 font-medium">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-600">IT</div>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-600">CS</div>
                    <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-xs font-bold text-amber-600">EE</div>
                  </div>
                  <p>Join 500+ top employers hiring today</p>
                </div>
              </div>

              {/* Right Column: Vibrant Visual/Mockup */}
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/10 to-emerald-500/10 rounded-[2.5rem] transform rotate-3 scale-105"></div>
                <div className="relative bg-white/60 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl overflow-hidden p-6">
                  {/* Mock UI Header */}
                  <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                        NT
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Nexus Virtual Campus</h3>
                        <p className="text-xs text-emerald-600 font-medium flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          24,500 Students Online
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mock UI Cards */}
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between transform hover:-translate-y-1 transition-transform cursor-default">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex flex-shrink-0">
                          <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Aisha" alt="Student" className="w-full h-full rounded-full" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Aisha Sharma</h4>
                          <p className="text-xs text-slate-500">B.Tech Computer Science • Tier 1</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
                        Top 5% Match
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between transform hover:-translate-y-1 transition-transform cursor-default ml-8">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex flex-shrink-0">
                          <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Rahul" alt="Student" className="w-full h-full rounded-full" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Rahul Verma</h4>
                          <p className="text-xs text-slate-500">M.Sc Data Science • Autonomous</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
                        Ready to Interview
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between transform hover:-translate-y-1 transition-transform cursor-default">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex flex-shrink-0">
                          <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Priya" alt="Student" className="w-full h-full rounded-full" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Priya Patel</h4>
                          <p className="text-xs text-slate-500">B.E Electronics • State University</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100">
                        Portfolio Updated
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
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

