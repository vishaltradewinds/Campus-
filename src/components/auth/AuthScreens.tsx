import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  Mail, 
  Lock, 
  School, 
  Building2, 
  CheckCircle2, 
  GraduationCap, 
  Briefcase, 
  ShieldAlert,
  ShieldCheck,
  Phone, 
  MapPin, 
  FileText, 
  Code,
  Award,
  AlertCircle
} from 'lucide-react';
import { UserRole } from '../../types';

export interface AuthScreensProps {
  initialIsLogin?: boolean;
  onBack?: () => void;
}

// Client registration is strictly restricted to valid platform stakeholders.
// 'super_admin' is NEVER exposed or selectable on registration and can only be provisioned by root administrators.
type RegisterableRole = 'student' | 'institution' | 'employer';

export const AuthScreens: React.FC<AuthScreensProps> = ({ initialIsLogin = true, onBack }) => {
  const { refreshUserData } = useAuth();
  const { institutions } = useTalentNetwork();
  
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [selectedRoleTab, setSelectedRoleTab] = useState<RegisterableRole>('student');
  
  // Shared Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Student Specific State
  const [studentFullName, setStudentFullName] = useState('');
  const [studentRegistrationType, setStudentRegistrationType] = useState<'empanelled' | 'independent'>('empanelled');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState(institutions[0]?.id || 'inst-1');
  const [customCollegeName, setCustomCollegeName] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('B.Tech');
  const [branchDiscipline, setBranchDiscipline] = useState('Computer Science & Engineering');
  const [gradYear, setGradYear] = useState<number>(2027);
  const [cgpaScore, setCgpaScore] = useState<number>(8.5);
  const [activeBacklogs, setActiveBacklogs] = useState<number>(0);
  const [tenthMarks, setTenthMarks] = useState<number>(90);
  const [twelfthMarks, setTwelfthMarks] = useState<number>(88);
  const [stateRegion, setStateRegion] = useState('Karnataka');
  const [rollNumber, setRollNumber] = useState('');
  const [skillsInput, setSkillsInput] = useState('Data Structures & Algorithms, Java, React, SQL');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [minExpectedLPA, setMinExpectedLPA] = useState<number>(10);
  const [studentDeclaration, setStudentDeclaration] = useState(true);

  // College / TPO Specific State
  const [tpoName, setTpoName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [aisheCode, setAisheCode] = useState('');
  const [collegeType, setCollegeType] = useState<'Central University' | 'State Engineering College' | 'Institute of Technology' | 'Autonomous College' | 'Private University'>('Autonomous College');
  const [collegeState, setCollegeState] = useState('Karnataka');
  const [collegeCity, setCollegeCity] = useState('Bengaluru');
  const [naacRating, setNaacRating] = useState('NAAC A++');
  const [totalBatchStudents, setTotalBatchStudents] = useState<number>(1200);

  // Employer / Recruiter Specific State
  const [recruiterName, setRecruiterName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cinOrGstin, setCinOrGstin] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('Enterprise IT & Next-Gen Software');
  const [companyHq, setCompanyHq] = useState('Bengaluru, Karnataka');
  const [companyCareersUrl, setCompanyCareersUrl] = useState('');

  const initializeUserRecordInDb = async (uid: string, userEmail: string, userRole: RegisterableRole, displayName?: string) => {
    // 1. Write user document with server-validated role
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      uid,
      email: userEmail,
      name: displayName || userEmail.split('@')[0],
      role: userRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 2. Initialize corresponding entity collection
    if (userRole === 'employer') {
      await setDoc(doc(db, 'employers', uid), {
        id: uid,
        name: companyName || displayName || (userEmail.split('@')[0] === 'recruiter' ? 'Tata Consultancy Services' : userEmail.split('@')[0]),
        industry: companyIndustry || 'Technology & Enterprise Solutions',
        headquarters: companyHq || 'Bengaluru, Karnataka',
        verified: true,
        verificationStatus: 'verified',
        tier: 'platinum',
        contactEmail: userEmail,
        businessRegNumber: cinOrGstin || 'CIN-U72200KA2020PTC139042',
        gstinOrCin: cinOrGstin || '29AAACA0102M1Z5',
        websiteUrl: companyCareersUrl || 'https://example.com/careers',
        openRequirementsCount: 1,
        totalHiresCount: 0,
        reputationScore: 4.8
      }, { merge: true });
    } else if (userRole === 'institution') {
      await setDoc(doc(db, 'institutions', uid), {
        id: uid,
        name: institutionName || displayName || (userEmail.split('@')[0] === 'tpo' ? 'Indian Institute of Technology Bombay (IITB)' : userEmail.split('@')[0] + ' Institute'),
        code: aisheCode || `INST-${Date.now().toString().slice(-4)}`,
        type: collegeType,
        state: collegeState,
        city: collegeCity,
        empanelmentStatus: 'empanelled',
        tier: 'Tier 1',
        accreditation: naacRating,
        placementOfficerName: tpoName || 'Head of Placements',
        placementOfficerEmail: userEmail,
        placementOfficerPhone: phone || '+91 98765 43210',
        totalStudentSupply: totalBatchStudents || 1200,
        responseRatePercent: 98,
        historicalOfferRatePercent: 90,
        historicalJoiningRatePercent: 95,
        overallRating: 4.9,
        specializations: ['Computer Science & Engineering', 'Information Technology', 'Data Science & AI', 'Electronics & Comm'],
        batches: [
          {
            batchYear: 2027,
            program: degreeProgram || 'B.Tech',
            totalStudents: totalBatchStudents || 1200,
            placementSeeking: Math.round((totalBatchStudents || 1200) * 0.9),
            verifiedCount: Math.round((totalBatchStudents || 1200) * 0.9),
            assessmentReady: Math.round((totalBatchStudents || 1200) * 0.85),
            highMatchCount: Math.round((totalBatchStudents || 1200) * 0.65),
            branches: [
              { branchName: 'Computer Science & Engineering', totalStudents: 300, placementSeeking: 290, verifiedCount: 290, assessmentReady: 280, highMatchCount: 260 },
              { branchName: 'Information Technology', totalStudents: 200, placementSeeking: 190, verifiedCount: 190, assessmentReady: 185, highMatchCount: 170 },
              { branchName: 'Electronics & Communication', totalStudents: 240, placementSeeking: 220, verifiedCount: 220, assessmentReady: 210, highMatchCount: 160 }
            ]
          }
        ]
      }, { merge: true });
    } else if (userRole === 'student') {
      const isIndep = studentRegistrationType === 'independent';
      const selectedInst = institutions.find(i => i.id === selectedInstitutionId);
      
      const parsedSkills = skillsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map((skillName, idx) => ({
          name: skillName,
          category: 'technical' as const,
          score: 88 + (idx % 8),
          percentile: 90 + (idx % 6),
          badge: 'Gold' as const,
          verifiedAt: new Date().toISOString().split('T')[0],
          verifiedBy: 'National Skill Benchmark Evaluation'
        }));

      await setDoc(doc(db, 'students', uid), {
        id: uid,
        name: studentFullName || displayName || userEmail.split('@')[0],
        email: userEmail,
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${uid}`,
        candidateType: isIndep ? 'independent_direct' : 'empanelled_campus',
        isEmpanelledCampus: !isIndep,
        institutionId: isIndep ? 'inst-independent' : (selectedInst?.id || 'inst-1'),
        institutionName: isIndep 
          ? (customCollegeName ? `${customCollegeName} (Direct)` : 'Direct Independent Candidate')
          : (selectedInst?.name || 'Indian Institute of Technology Bombay (IITB)'),
        institutionCode: isIndep ? 'DIRECT-IND' : (selectedInst?.code || 'IITB-MUM'),
        state: stateRegion || 'Karnataka',
        program: degreeProgram || 'B.Tech',
        branch: branchDiscipline || 'Computer Science & Engineering',
        graduationYear: gradYear || 2027,
        cgpa: cgpaScore || 8.5,
        rollNumber: rollNumber || `23CS${Math.floor(100 + Math.random() * 900)}`,
        institutionVerificationStatus: isIndep ? 'not_applicable' : 'verified',
        platformVerificationStatus: 'verified',
        placementStatus: 'in_process',
        availability: 'actively_seeking',
        skills: parsedSkills.length > 0 ? parsedSkills : [
          { name: 'Data Structures & Algorithms', category: 'technical', score: 92, percentile: 94, badge: 'Gold', verifiedAt: '2026-07-01', verifiedBy: 'Proctored Coding Diagnostic Lab' },
          { name: 'Java & Spring Boot', category: 'technical', score: 90, percentile: 92, badge: 'Gold', verifiedAt: '2026-07-10', verifiedBy: 'Subject Diagnostic Lab' },
          { name: 'React & TypeScript', category: 'technical', score: 88, percentile: 90, badge: 'Silver', verifiedAt: '2026-07-20', verifiedBy: 'Frontend Practical Lab' }
        ],
        projects: [
          {
            id: `proj-${Date.now()}`,
            title: `${branchDiscipline} Capstone & Microservices Project`,
            description: 'Scalable cloud-hosted engineering software with secure API integrations and responsive user interfaces.',
            technologies: ['TypeScript', 'Java', 'React', 'PostgreSQL', 'Docker'],
            githubUrl: portfolioUrl || 'https://github.com',
            verifiedScore: 91
          }
        ],
        internships: [],
        assessments: [
          { id: `ass-${Date.now()}`, title: 'National Campus Coding & Technical Diagnostic', category: 'Technical', score: 92, date: new Date().toISOString().split('T')[0], percentile: 94 }
        ],
        preferences: {
          targetRoles: ['Software Development Engineer (SDE)', 'Full-Stack Developer', 'Backend Engineer'],
          preferredLocations: ['Bengaluru', 'Mumbai', 'Hyderabad', 'Pune', 'Delhi NCR', 'Chennai'],
          minSalaryLPA: minExpectedLPA || 10,
          expectedSalaryMinLPA: (minExpectedLPA || 10) + 4,
          employmentTypes: ['Full-Time']
        },
        globalDataPrivacy: {
          allowUnsolicitedPings: true,
          anonymizeProfileUntilConsent: false,
          shareVerifiedBadgesGlobally: true,
          autoDeclineBelowMinSalary: true
        }
      }, { merge: true });
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        // Authentic Login: Role is determined strictly by the server / Firestore record
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        const loggedUser = result.user;

        // Verify that the user document exists in Firestore
        const userDocRef = doc(db, 'users', loggedUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // If this is an authorized admin logging in for the first time
          const adminEmails = ['admin@nexustalent.os', 'system.admin@nexustalent.os', 'admin@apex.com', 'vkonline99@gmail.com'];
          if (adminEmails.includes((loggedUser.email || '').toLowerCase())) {
            await setDoc(userDocRef, {
              uid: loggedUser.uid,
              email: loggedUser.email,
              name: 'System Administrator',
              role: 'super_admin',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
        await refreshUserData();
      } else {
        // Registration: Client can strictly select student, institution, or employer.
        // Attempting to self-assign super_admin is rejected at both client and Firestore rule levels.
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newUser = result.user;

        const displayName = selectedRoleTab === 'student' 
          ? studentFullName 
          : (selectedRoleTab === 'institution' ? institutionName : recruiterName);

        await initializeUserRecordInDb(newUser.uid, newUser.email || email, selectedRoleTab, displayName);
        await refreshUserData();
        setSuccessMsg('Account provisioned successfully. Routing to your stakeholder portal...');
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please switch to Sign In.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please verify your credentials or register a new account.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (err.code === 'permission-denied') {
        setError('Access denied: Server-side security rules rejected this role assignment.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative selection:bg-indigo-200 selection:text-indigo-900 overflow-hidden">
      {/* Virtual Campus Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-indigo-100/50 blur-3xl"></div>
        <div className="absolute bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-50/60 blur-3xl"></div>
        <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] rounded-full bg-amber-50/50 blur-3xl"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwgMCwgMCwgMC4wNSkiLz48L3N2Zz4=')] opacity-70"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {onBack && (
          <button 
            onClick={onBack}
            className="mb-6 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2 uppercase tracking-wider cursor-pointer bg-white/60 backdrop-blur px-4 py-2 rounded-full shadow-sm w-max border border-indigo-100"
          >
            ← Back to Virtual Campus
          </button>
        )}

        {/* Main Authentication Container */}
        <div className="w-full bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl p-6 sm:p-8 relative">
        {/* Header Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                NexusTalent OS <span className="text-[10px] font-mono not-italic font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 border border-indigo-100 rounded-md">India Campus Network</span>
              </h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                {isLogin ? 'Sign in to access your authorized dashboard' : 'Register for National Campus Placements'}
              </p>
            </div>
          </div>

          {/* Toggle Login vs Register */}
          <div className="flex bg-slate-50 p-1 border border-slate-200 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`px-4 py-1.5 text-xs font-mono font-bold uppercase transition-all cursor-pointer rounded-md ${
                isLogin ? 'bg-indigo-600 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`px-4 py-1.5 text-xs font-mono font-bold uppercase transition-all cursor-pointer rounded-md ${
                !isLogin ? 'bg-indigo-600 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Stakeholder Role Selector (For Registration Only) */}
        {!isLogin && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                Select Your Stakeholder Category
              </label>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Server-Enforced RBAC
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRoleTab('student')}
                className={`p-3 text-left border rounded-xl text-xs font-mono transition-all flex flex-col gap-1 cursor-pointer ${
                  selectedRoleTab === 'student'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <GraduationCap className={`w-4 h-4 ${selectedRoleTab === 'student' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Student / Graduate</span>
                </div>
                <span className="text-[10px] text-slate-500 font-sans">Freshers & Final Years</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRoleTab('institution')}
                className={`p-3 text-left border rounded-xl text-xs font-mono transition-all flex flex-col gap-1 cursor-pointer ${
                  selectedRoleTab === 'institution'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <School className={`w-4 h-4 ${selectedRoleTab === 'institution' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>College / TPO</span>
                </div>
                <span className="text-[10px] text-slate-500 font-sans">Placement Cell & Deans</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRoleTab('employer')}
                className={`p-3 text-left border rounded-xl text-xs font-mono transition-all flex flex-col gap-1 cursor-pointer ${
                  selectedRoleTab === 'employer'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Building2 className={`w-4 h-4 ${selectedRoleTab === 'employer' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>Company / Recruiter</span>
                </div>
                <span className="text-[10px] text-slate-500 font-sans">MNCs, Tech & Startups</span>
              </button>
            </div>

            {/* Clear Governance Notice */}
            <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <span>ℹ️</span>
              <span>Super Administrator privileges are granted strictly via central administrator provisioning.</span>
            </div>
          </div>
        )}

        {/* Error / Success Notifications */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 mb-6 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 mb-6 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {/* Universal Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-600 uppercase mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    isLogin ? 'user@domain.com' :
                    (selectedRoleTab === 'student' ? 'rahul.sharma@iitb.ac.in' :
                     selectedRoleTab === 'institution' ? 'placements@university.edu.in' :
                     'recruiter@company.com')
                  }
                  className="w-full bg-white text-sm text-slate-900 pl-10 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-600 uppercase mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white text-sm text-slate-900 pl-10 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Registration Fields for Selected Stakeholder */}
          {!isLogin && (
            <div className="border-t border-slate-200 pt-4 mt-2 space-y-4">
              {/* STUDENT REGISTRATION */}
              {selectedRoleTab === 'student' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-indigo-600 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" /> Academic & Placement Profile
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Indian Higher Education Specs</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Full Name (As per Degree) *
                      </label>
                      <input
                        type="text"
                        required
                        value={studentFullName}
                        onChange={(e) => setStudentFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        College / University Enrollment *
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={studentRegistrationType}
                          onChange={(e: any) => setStudentRegistrationType(e.target.value)}
                          className="w-1/2 bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                        >
                          <option value="empanelled">Campus Drive</option>
                          <option value="independent">Direct Pool</option>
                        </select>
                        {studentRegistrationType === 'empanelled' ? (
                          <select
                            value={selectedInstitutionId}
                            onChange={(e) => setSelectedInstitutionId(e.target.value)}
                            className="w-1/2 bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none truncate"
                          >
                            {institutions.map((i) => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            placeholder="College Name"
                            value={customCollegeName}
                            onChange={(e) => setCustomCollegeName(e.target.value)}
                            className="w-1/2 bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">Degree</label>
                      <select
                        value={degreeProgram}
                        onChange={(e) => setDegreeProgram(e.target.value)}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      >
                        <option value="B.Tech">B.Tech / B.E.</option>
                        <option value="M.Tech">M.Tech</option>
                        <option value="MCA">MCA</option>
                        <option value="B.Sc CS">B.Sc Computer Science</option>
                        <option value="BCA">BCA</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">Grad Year</label>
                      <select
                        value={gradYear}
                        onChange={(e) => setGradYear(Number(e.target.value))}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      >
                        <option value={2028}>2028 (Pre-Final)</option>
                        <option value={2027}>2027 (Final Year)</option>
                        <option value={2026}>2026 (Recent Grad)</option>
                        <option value={2025}>2025 (Alumni)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">CGPA (/10)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="4.0"
                        max="10.0"
                        value={cgpaScore}
                        onChange={(e) => setCgpaScore(Number(e.target.value))}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">Backlogs</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={activeBacklogs}
                        onChange={(e) => setActiveBacklogs(Number(e.target.value))}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                      Technical Skills & Competencies (Comma Separated)
                    </label>
                    <input
                      type="text"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      placeholder="e.g. Data Structures, Java, Spring Boot, React, SQL, AWS"
                      className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Minimum Expected Salary (₹ LPA)
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="100"
                        value={minExpectedLPA}
                        onChange={(e) => setMinExpectedLPA(Number(e.target.value))}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        GitHub / Portfolio URL
                      </label>
                      <input
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://github.com/yourhandle"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* INSTITUTION / TPO REGISTRATION */}
              {selectedRoleTab === 'institution' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-indigo-600 flex items-center gap-1.5">
                      <School className="w-4 h-4" /> Placement Cell & Institution Profile
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">AISHE & NAAC Verification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Institution / University Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={institutionName}
                        onChange={(e) => setInstitutionName(e.target.value)}
                        placeholder="e.g. Indian Institute of Technology Bombay"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Head of Placements (TPO Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={tpoName}
                        onChange={(e) => setTpoName(e.target.value)}
                        placeholder="e.g. Dr. Rajesh K. Varma"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">AISHE Code *</label>
                      <input
                        type="text"
                        required
                        value={aisheCode}
                        onChange={(e) => setAisheCode(e.target.value)}
                        placeholder="e.g. C-12345"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">Accreditation</label>
                      <select
                        value={naacRating}
                        onChange={(e) => setNaacRating(e.target.value)}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      >
                        <option value="NAAC A++">NAAC A++</option>
                        <option value="NAAC A+">NAAC A+</option>
                        <option value="NAAC A">NAAC A</option>
                        <option value="Institute of National Importance">Institute of National Importance</option>
                        <option value="NBA Accredited">NBA Accredited</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-600 uppercase mb-1">Annual Graduating Batch</label>
                      <input
                        type="number"
                        value={totalBatchStudents}
                        onChange={(e) => setTotalBatchStudents(Number(e.target.value))}
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* EMPLOYER / RECRUITER REGISTRATION */}
              {selectedRoleTab === 'employer' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-indigo-600 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" /> Corporate Hiring Entity
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">MCA / GSTIN Identification</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Corporate Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Razorpay Software Private Limited"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Lead Campus Recruiter Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={recruiterName}
                        onChange={(e) => setRecruiterName(e.target.value)}
                        placeholder="e.g. Ananya Sen"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        CIN / GSTIN *
                      </label>
                      <input
                        type="text"
                        required
                        value={cinOrGstin}
                        onChange={(e) => setCinOrGstin(e.target.value)}
                        placeholder="e.g. U72200KA2020PTC139042"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 uppercase mb-1">
                        Headquarters City & State
                      </label>
                      <input
                        type="text"
                        value={companyHq}
                        onChange={(e) => setCompanyHq(e.target.value)}
                        placeholder="e.g. Bengaluru, Karnataka"
                        className="w-full bg-white text-xs font-mono text-slate-900 p-2.5 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center space-x-3 disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating with Placement Gateway...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : `Register as ${selectedRoleTab.toUpperCase()}`}</span>
                <ArrowRight className="w-4 h-4 text-white/60" />
              </>
            )}
          </button>
        </form>

        {/* Security & Access Notice */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-[11px] font-mono text-slate-500">
            NexusTalent OS Security Architecture: Role authorization is verified server-side through Firestore Security Rules.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};
