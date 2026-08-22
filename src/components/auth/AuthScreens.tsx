import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { Sparkles, Loader2, ArrowRight, Mail, Lock, ShieldCheck, UserCheck, School, Building2, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';

export interface AuthScreensProps {
  initialIsLogin?: boolean;
  onBack?: () => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ initialIsLogin = true, onBack }) => {
  const { loginWithLocalSession } = useAuth();
  const { registerIndependentCandidate, institutions } = useTalentNetwork();
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Independent vs Empanelled Student Registration State
  const [studentRegistrationType, setStudentRegistrationType] = useState<'empanelled' | 'independent'>('empanelled');
  const [fullName, setFullName] = useState('');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('inst-1');
  const [customCollegeName, setCustomCollegeName] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('B.Tech');
  const [branchDiscipline, setBranchDiscipline] = useState('Computer Science & Engineering');
  const [gradYear, setGradYear] = useState<number>(2027);
  const [cgpaScore, setCgpaScore] = useState<number>(8.5);
  const [stateRegion, setStateRegion] = useState('Karnataka');
  const [rollNumber, setRollNumber] = useState('');
  const [idType, setIdType] = useState<'college_id' | 'digilocker' | 'aadhaar_doc' | 'student_reg'>('college_id');
  const [idRefNumber, setIdRefNumber] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [attestationAccepted, setAttestationAccepted] = useState(true);
  const [registrationSuccessMsg, setRegistrationSuccessMsg] = useState<string | null>(null);

  const DEMO_ACCOUNTS = [
    {
      roleName: 'System Administrator',
      role: 'super_admin' as UserRole,
      email: 'admin@nexustalent.os',
      password: 'Admin@123456',
      badge: 'Super Admin',
      color: 'border-[#CCFF00] text-[#CCFF00]',
      desc: 'Full platform telemetry, oversight & audit command'
    },
    {
      roleName: 'Enterprise Employer',
      role: 'employer' as UserRole,
      email: 'recruiter@apex.com',
      password: 'Apex@123456',
      badge: 'Recruiter',
      color: 'border-blue-400 text-blue-400',
      desc: 'Publish demand, issue calls & interview candidates'
    },
    {
      roleName: 'Partner University',
      role: 'institution' as UserRole,
      email: 'tpo@aust.edu',
      password: 'Aust@123456',
      badge: 'TPO / Dean',
      color: 'border-emerald-400 text-emerald-400',
      desc: 'Verify student cohorts & accept campus hiring calls'
    },
    {
      roleName: 'Student Candidate',
      role: 'student' as UserRole,
      email: 'rahul.sharma@student.os',
      password: 'Student@123456',
      badge: 'Candidate',
      color: 'border-amber-400 text-amber-400',
      desc: 'Career passport, skill benchmarks & consent controls'
    },
  ];

  const initializeUserRoleData = async (uid: string, userEmail: string, userRole: UserRole, displayName?: string) => {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      uid,
      email: userEmail,
      name: displayName || userEmail.split('@')[0],
      role: userRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (userRole === 'employer') {
      await setDoc(doc(db, 'employers', uid), {
        id: uid,
        name: displayName || (userEmail.split('@')[0] === 'recruiter' ? 'Apex Global Enterprises' : userEmail.split('@')[0]),
        industry: 'Technology & Enterprise Solutions',
        companySize: 'Enterprise (1,000+)',
        verified: true,
        tier: 'platinum',
        contactEmail: userEmail,
        hqLocation: 'Bengaluru',
        description: 'Global innovation leader hiring top campus talent.',
        metrics: { activeRequirements: 4, totalHires: 1420, joiningRatio: 95 }
      }, { merge: true });
    } else if (userRole === 'institution') {
      await setDoc(doc(db, 'institutions', uid), {
        id: uid,
        name: displayName || (userEmail.split('@')[0] === 'tpo' ? 'Apex University of Arts, Science & Technology' : userEmail.split('@')[0] + ' University'),
        code: 'AUST-BLR',
        type: 'Central University',
        tier: 'Tier 1',
        location: 'Bengaluru',
        contactEmail: userEmail,
        verified: true,
        totalStudentSupply: 2400,
        historicalOfferRatePercent: 85,
        historicalJoiningRatePercent: 92,
        overallRating: 4.9,
        responseRatePercent: 98,
        batches: [{ batchYear: 2027, totalStudents: 2400, branches: [{ branchName: 'Computer Science', totalStudents: 600, highMatchCount: 450, placementSeeking: 540 }] }],
        publishedAvailability: []
      }, { merge: true });
    } else if (userRole === 'student') {
      const isIndep = studentRegistrationType === 'independent';
      const selectedInst = institutions.find(i => i.id === selectedInstitutionId);
      
      await setDoc(doc(db, 'students', uid), {
        id: uid,
        name: fullName || displayName || (userEmail.split('@')[0] === 'rahul.sharma' ? 'Rahul Sharma' : userEmail.split('@')[0]),
        email: userEmail,
        avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=' + uid,
        candidateType: isIndep ? 'independent_direct' : 'empanelled_student',
        isEmpanelledCampus: !isIndep,
        institutionId: isIndep ? 'inst-independent' : (selectedInst?.id || 'inst-1'),
        institutionName: isIndep 
          ? (customCollegeName ? `${customCollegeName} (Direct)` : 'Direct Independent Candidate')
          : (selectedInst?.name || 'Apex University of Arts, Science & Technology'),
        institutionCode: isIndep ? 'DIRECT-IND' : (selectedInst?.code || 'AUST-BLR'),
        state: stateRegion || 'Karnataka',
        program: degreeProgram || 'B.Tech',
        branch: branchDiscipline || 'Computer Science & Engineering',
        graduationYear: gradYear || 2027,
        cgpa: cgpaScore || 8.5,
        rollNumber: rollNumber || (isIndep ? idRefNumber || `IND-${Date.now().toString().slice(-5)}` : 'STU-2027-01'),
        institutionVerificationStatus: isIndep ? 'not_applicable' : 'pending',
        platformVerificationStatus: isIndep ? 'pending' : 'verified',
        verificationNotes: isIndep 
          ? `Direct independent candidate registered on ${new Date().toISOString().split('T')[0]}. Pending Platform Admin credential review.`
          : undefined,
        independentCredentials: isIndep ? {
          collegeName: customCollegeName,
          degree: degreeProgram,
          branch: branchDiscipline,
          graduationYear: gradYear,
          cgpa: cgpaScore,
          rollNumber: rollNumber || idRefNumber,
          documentType: idType,
          documentRefNumber: idRefNumber || 'DOC-PENDING-REF',
          portfolioUrl: portfolioUrl,
          attestationAccepted: attestationAccepted,
          submissionDate: new Date().toISOString().split('T')[0],
          state: stateRegion,
        } : undefined,
        skills: [
          { name: 'TypeScript', category: 'Programming', verified: true, score: 92, verifiedBy: 'Subject Diagnostic Lab' },
          { name: 'React', category: 'Frontend', verified: true, score: 89, verifiedBy: 'National Skill Benchmark' },
          { name: 'System Design', category: 'Core', verified: true, score: 86, verifiedBy: 'Subject Diagnostic Lab' },
          { name: 'Cloud Architecture', category: 'Infrastructure', verified: true, score: 84, verifiedBy: 'National Skill Benchmark' },
        ],
        projects: [
          { title: 'Full-Stack Application Portfolio', description: 'Interactive production systems and services.', techStack: ['TypeScript', 'React', 'Node.js'], liveUrl: portfolioUrl || 'https://github.com' }
        ],
        internships: [],
        assessments: [],
        preferences: { targetRoles: ['Software Engineer', 'Full-Stack Developer'], preferredLocations: ['Bengaluru', 'Hyderabad', 'Remote'], minSalaryLPA: 10, employmentTypes: ['Full-Time'] },
        availability: 'actively_seeking',
        globalDataPrivacy: { allowUnsolicitedPings: false, anonymizeProfileUntilConsent: false, shareVerifiedBadgesGlobally: true, autoDeclineBelowMinSalary: false }
      }, { merge: true });
    }
  };

  const handleQuickLogin = async (demo: typeof DEMO_ACCOUNTS[0]) => {
    setLoading(true);
    setError(null);
    setEmail(demo.email);
    setPassword(demo.password);

    try {
      let user;
      try {
        const result = await signInWithEmailAndPassword(auth, demo.email, demo.password);
        user = result.user;
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/operation-not-allowed' || signInErr.code === 'auth/admin-restricted-operation') {
          // If Email/Password provider is disabled in Firebase console, fall back to local authenticated session
          await loginWithLocalSession(demo.role, demo.email, demo.roleName);
          return;
        } else if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          try {
            const createResult = await createUserWithEmailAndPassword(auth, demo.email, demo.password);
            user = createResult.user;
          } catch (createErr: any) {
            if (createErr.code === 'auth/operation-not-allowed' || createErr.code === 'auth/admin-restricted-operation') {
              await loginWithLocalSession(demo.role, demo.email, demo.roleName);
              return;
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      if (user) {
        await initializeUserRoleData(user.uid, user.email || demo.email, demo.role, demo.roleName);
      }
    } catch (err: any) {
      console.warn('Demo auth notice:', err);
      // Fallback seamlessly on any authentication provider constraint
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        await loginWithLocalSession(demo.role, demo.email, demo.roleName);
      } else {
        setError(err.message || 'Failed to authenticate with demo credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetRole: UserRole = isLogin 
      ? (email.includes('admin') ? 'super_admin' : (email.includes('recruiter') || email.includes('apex') ? 'employer' : (email.includes('tpo') || email.includes('aust') ? 'institution' : 'student')))
      : role;

    try {
      if (isLogin) {
        let user;
        try {
          const result = await signInWithEmailAndPassword(auth, email, password);
          user = result.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/operation-not-allowed' || signInErr.code === 'auth/admin-restricted-operation') {
            await loginWithLocalSession(targetRole, email);
            return;
          } else if ((signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') && email.includes('admin')) {
            try {
              const createResult = await createUserWithEmailAndPassword(auth, email, password);
              user = createResult.user;
              await initializeUserRoleData(user.uid, user.email || email, 'super_admin', 'System Administrator');
            } catch (createErr: any) {
              if (createErr.code === 'auth/operation-not-allowed' || createErr.code === 'auth/admin-restricted-operation') {
                await loginWithLocalSession('super_admin', email, 'System Administrator');
                return;
              }
              throw createErr;
            }
          } else {
            throw signInErr;
          }
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          await initializeUserRoleData(user.uid, user.email || email, targetRole);
        }
      } else {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const user = result.user;
          await initializeUserRoleData(user.uid, user.email || email, role);
        } catch (createErr: any) {
          if (createErr.code === 'auth/operation-not-allowed' || createErr.code === 'auth/admin-restricted-operation') {
            await loginWithLocalSession(role, email);
            return;
          }
          throw createErr;
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        await loginWithLocalSession(targetRole, email);
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'unavailable' || (err.message && err.message.toLowerCase().includes('offline'))) {
        console.warn('Auth offline warning:', err);
        setError('Network error: Unable to connect to the database. Please try again.');
      } else {
        console.error('Auth error:', err);
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (isLogin) {
        if (!userDocSnap.exists()) {
          // If logging in for the first time via Google, initialize role based on email or default to student
          const detectedRole: UserRole = user.email?.includes('admin') ? 'super_admin' : 'student';
          await initializeUserRoleData(user.uid, user.email || '', detectedRole, user.displayName || undefined);
        }
      } else {
        if (!userDocSnap.exists()) {
          await initializeUserRoleData(user.uid, user.email || '', role, user.displayName || undefined);
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/user-cancelled' || err.code === 'auth/cancelled-popup-request') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'unavailable' || (err.message && err.message.toLowerCase().includes('offline'))) {
        console.warn('Auth offline warning:', err);
        setError('Network error: Unable to connect to the database. Please try again.');
      } else {
        console.error('Auth error:', err);
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#F5F5F5] font-sans flex flex-col items-center justify-center p-4 relative">
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 text-xs font-mono font-bold text-[#888888] hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wider"
        >
          ← Back to Home
        </button>
      )}
      <div className="bg-[#111111] border border-[#333333] shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-[#222222] text-[#CCFF00] border border-[#333333]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tight text-white">
              NexusTalent OS
            </h1>
            <p className="text-xs font-mono text-[#888888] uppercase tracking-wider mt-0.5">
              {isLogin ? 'Secure Gateway Login' : 'Create Access Account'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-900 text-rose-400 p-3 mb-6 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-[#AAAAAA] uppercase mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="system@nexustalent.os"
                className="w-full bg-[#181818] text-sm font-sans text-white pl-10 p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-[#AAAAAA] uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#181818] text-sm font-sans text-white pl-10 p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-3 pt-2 border-t border-[#222]">
              <div>
                <label className="block text-xs font-mono font-bold text-[#AAAAAA] uppercase mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#181818] text-sm font-sans text-white p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#AAAAAA] uppercase mb-1">
                  Select Your Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-[#181818] text-xs font-mono text-white p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
                >
                  <option value="student">Student / Job Candidate</option>
                  <option value="employer">Employer / Corporate Recruiter</option>
                  <option value="institution">Partner University / TPO Office</option>
                </select>
              </div>

              {/* Student Candidate Enrollment Path Selection */}
              {role === 'student' && (
                <div className="space-y-3 p-3 bg-[#161616] border border-[#2e2e2e]">
                  <span className="block text-[11px] font-mono font-bold text-[#CCFF00] uppercase tracking-wider">
                    Candidate Enrollment Type
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStudentRegistrationType('empanelled')}
                      className={`p-2.5 text-left border text-xs font-mono transition-all cursor-pointer ${
                        studentRegistrationType === 'empanelled'
                          ? 'bg-[#222] border-[#CCFF00] text-[#CCFF00]'
                          : 'bg-[#111] border-[#333] text-[#888] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <School className="w-3.5 h-3.5" />
                        <span>Empanelled College</span>
                      </div>
                      <p className="text-[10px] text-[#777] mt-1 font-sans">
                        Enrolled in an officially partnered university
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentRegistrationType('independent')}
                      className={`p-2.5 text-left border text-xs font-mono transition-all cursor-pointer ${
                        studentRegistrationType === 'independent'
                          ? 'bg-[#222] border-[#CCFF00] text-[#CCFF00]'
                          : 'bg-[#111] border-[#333] text-[#888] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Direct / Independent</span>
                      </div>
                      <p className="text-[10px] text-[#777] mt-1 font-sans">
                        Non-empanelled college or independent candidate
                      </p>
                    </button>
                  </div>

                  {studentRegistrationType === 'empanelled' ? (
                    <div className="space-y-2 pt-2 border-t border-[#222]">
                      <label className="block text-[11px] font-mono text-[#AAA] uppercase">
                        Select Empanelled University
                      </label>
                      <select
                        value={selectedInstitutionId}
                        onChange={(e) => setSelectedInstitutionId(e.target.value)}
                        className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                      >
                        {institutions.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name} ({inst.code}) — {inst.tier}
                          </option>
                        ))}
                      </select>
                      <div>
                        <label className="block text-[10px] font-mono text-[#888] uppercase mt-1">
                          Campus Roll Number
                        </label>
                        <input
                          type="text"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          placeholder="e.g. 23CS042"
                          className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-2 border-t border-[#222] font-mono text-xs">
                      <div className="bg-[#111] p-2 border border-[#333] text-[#AAA] text-[11px]">
                        <span className="text-[#CCFF00] font-bold">✓ Direct Access:</span> Provide your college and credential details. Your profile will be submitted directly to the Platform Verification Board.
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                          College / University Name (Non-Empanelled) *
                        </label>
                        <input
                          type="text"
                          required
                          value={customCollegeName}
                          onChange={(e) => setCustomCollegeName(e.target.value)}
                          placeholder="e.g. St. Xavier's College of Engineering"
                          className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            Degree / Program
                          </label>
                          <select
                            value={degreeProgram}
                            onChange={(e) => setDegreeProgram(e.target.value)}
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          >
                            <option value="B.Tech">B.Tech / B.E</option>
                            <option value="B.Sc">B.Sc / BS</option>
                            <option value="BCA">BCA / MCA</option>
                            <option value="B.Com">B.Com / BBA</option>
                            <option value="MBA">MBA / PGDM</option>
                            <option value="M.Tech">M.Tech / MS</option>
                            <option value="Other">Other Degree</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            Branch / Major
                          </label>
                          <input
                            type="text"
                            required
                            value={branchDiscipline}
                            onChange={(e) => setBranchDiscipline(e.target.value)}
                            placeholder="e.g. Computer Science"
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            Pass Year
                          </label>
                          <select
                            value={gradYear}
                            onChange={(e) => setGradYear(Number(e.target.value))}
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                            <option value={2028}>2028</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            CGPA (10.0)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="4.0"
                            max="10.0"
                            value={cgpaScore}
                            onChange={(e) => setCgpaScore(Number(e.target.value))}
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            value={stateRegion}
                            onChange={(e) => setStateRegion(e.target.value)}
                            placeholder="e.g. Karnataka"
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            Verification ID Type
                          </label>
                          <select
                            value={idType}
                            onChange={(e) => setIdType(e.target.value as any)}
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          >
                            <option value="college_id">College ID Card</option>
                            <option value="digilocker">DigiLocker Marksheet</option>
                            <option value="aadhaar_doc">Aadhaar e-KYC Ref</option>
                            <option value="student_reg">University Reg No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                            ID / Roll Ref No *
                          </label>
                          <input
                            type="text"
                            required
                            value={idRefNumber}
                            onChange={(e) => setIdRefNumber(e.target.value)}
                            placeholder="e.g. REG-IND-2027-89"
                            className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-[#AAA] mb-1">
                          Portfolio / GitHub / LinkedIn URL
                        </label>
                        <input
                          type="url"
                          value={portfolioUrl}
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          placeholder="https://github.com/username or linkedin.com/in/..."
                          className="w-full bg-[#111] text-xs font-mono text-white p-2 border border-[#333] focus:border-[#CCFF00] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-start gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="attestation-chk"
                          checked={attestationAccepted}
                          onChange={(e) => setAttestationAccepted(e.target.checked)}
                          required
                          className="mt-1 accent-[#CCFF00]"
                        />
                        <label htmlFor="attestation-chk" className="text-[10px] text-[#888] leading-tight">
                          I declare that the credentials submitted are true and verifiable by the Platform Governance Board.
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-[#CCFF00] hover:bg-[#b3ff00] text-black font-sans font-bold text-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Account...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Login to OS' : 'Initialize Account & Career Passport'}</span>
                <ArrowRight className="w-4 h-4 text-black/50" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#333333]"></div>
          </div>
          <div className="relative flex justify-center text-xs font-mono">
            <span className="bg-[#111111] px-2 text-[#666666] uppercase">OR</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3 bg-white hover:bg-gray-100 text-black font-sans font-bold text-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>{isLogin ? 'Sign in with Google' : 'Register with Google'}</span>
        </button>

        <div className="mt-6 pt-4 border-t border-[#222222] text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs font-mono text-[#888888] hover:text-white transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Register here" 
              : "Already have an account? Login here"}
          </button>
        </div>

        {/* PRE-CONFIGURED DEMO & SYSTEM ADMIN CREDENTIALS */}
        <div className="mt-8 pt-6 border-t border-[#333333]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#AAAAAA]">
              Pre-Configured System Logins
            </span>
            <span className="text-[10px] font-mono bg-[#222] text-[#CCFF00] px-1.5 py-0.5 border border-[#333]">
              1-Click Ready
            </span>
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin(acc)}
                className="w-full text-left p-2.5 bg-[#161616] hover:bg-[#222222] border border-[#2e2e2e] hover:border-[#555555] transition-all group flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 border ${acc.color}`}>
                      {acc.badge}
                    </span>
                    <span className="text-xs font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                      {acc.roleName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#888] group-hover:text-white transition-colors">
                    Click to Log In →
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#888] mt-0.5">
                  <span>ID: <strong className="text-[#ccc]">{acc.email}</strong></span>
                  <span>Pass: <strong className="text-[#ccc]">{acc.password}</strong></span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

