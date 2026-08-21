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
import { Sparkles, Loader2, ArrowRight, Mail, Lock } from 'lucide-react';
import { UserRole } from '../../types';

export interface AuthScreensProps {
  initialIsLogin?: boolean;
  onBack?: () => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ initialIsLogin = true, onBack }) => {
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [role, setRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          await firebaseSignOut(auth);
          setError('No account profile found. Please register first.');
          setIsLogin(false);
        }
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: email.split('@')[0], // simple default name
          role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Initialize corresponding entity profile
        if (role === 'employer') {
          await setDoc(doc(db, 'employers', user.uid), {
            id: user.uid,
            name: email.split('@')[0],
            industry: 'Technology',
            companySize: 'Startup',
            verified: true,
            tier: 'gold',
            contactEmail: user.email,
            hqLocation: 'Bengaluru',
            description: 'New employer account.',
            metrics: { activeRequirements: 0, totalHires: 0, joiningRatio: 0 }
          });
        } else if (role === 'institution') {
          await setDoc(doc(db, 'institutions', user.uid), {
            id: user.uid,
            name: email.split('@')[0] + ' University',
            code: 'UNI-NEW',
            type: 'University',
            tier: 'Tier 1',
            location: 'Bengaluru',
            contactEmail: user.email,
            verified: true,
            totalStudentSupply: 100,
            historicalOfferRatePercent: 85,
            historicalJoiningRatePercent: 90,
            overallRating: 4.5,
            responseRatePercent: 100,
            batches: [{ batchYear: 2027, totalStudents: 100, branches: [{ branchName: 'Computer Science', totalStudents: 100, highMatchCount: 50, placementSeeking: 90 }] }],
            publishedAvailability: []
          });
        } else if (role === 'student') {
          await setDoc(doc(db, 'students', user.uid), {
            id: user.uid,
            name: email.split('@')[0],
            email: user.email,
            avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=' + user.uid,
            institutionId: 'inst-1',
            institutionName: 'Partner University',
            institutionCode: 'UNI-01',
            state: 'Karnataka',
            program: 'B.Tech',
            branch: 'Computer Science',
            graduationYear: 2027,
            cgpa: 8.0,
            skills: [],
            projects: [],
            internships: [],
            assessments: [],
            preferences: { targetRoles: ['SDE'], preferredLocations: ['Bengaluru'], minSalaryLPA: 6, employmentTypes: ['Full-Time'] },
            availability: 'actively_seeking',
            globalDataPrivacy: { allowUnsolicitedPings: false, anonymizeProfileUntilConsent: false, shareVerifiedBadgesGlobally: true, autoDeclineBelowMinSalary: false }
          });
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'unavailable' || (err.message && err.message.toLowerCase().includes('offline'))) {
        console.warn('Auth offline warning:', err);
        setError('Network error: Unable to connect to the database. If you are in a preview, please try opening the app in a new tab.');
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
          await firebaseSignOut(auth);
          setError('No account found. Please register to set up your profile.');
          setIsLogin(false);
        }
      } else {
        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName || 'Unknown User',
            role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Initialize corresponding entity profile
          if (role === 'employer') {
            await setDoc(doc(db, 'employers', user.uid), {
              id: user.uid,
              name: user.displayName || 'New Employer',
              industry: 'Technology',
              companySize: 'Startup',
              verified: true,
              tier: 'gold',
              contactEmail: user.email,
              hqLocation: 'Bengaluru',
              description: 'New employer account.',
              metrics: { activeRequirements: 0, totalHires: 0, joiningRatio: 0 }
            });
          } else if (role === 'institution') {
            await setDoc(doc(db, 'institutions', user.uid), {
              id: user.uid,
              name: (user.displayName || 'New') + ' University',
              code: 'UNI-NEW',
              type: 'University',
              tier: 'Tier 1',
              location: 'Bengaluru',
              contactEmail: user.email,
              verified: true,
              totalStudentSupply: 100,
              historicalOfferRatePercent: 85,
              historicalJoiningRatePercent: 90,
              overallRating: 4.5,
              responseRatePercent: 100,
              batches: [{ batchYear: 2027, totalStudents: 100, branches: [{ branchName: 'Computer Science', totalStudents: 100, highMatchCount: 50, placementSeeking: 90 }] }],
              publishedAvailability: []
            });
          } else if (role === 'student') {
            await setDoc(doc(db, 'students', user.uid), {
              id: user.uid,
              name: user.displayName || 'New Student',
              email: user.email,
              avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=' + user.uid,
              institutionId: 'inst-1',
              institutionName: 'Partner University',
              institutionCode: 'UNI-01',
              state: 'Karnataka',
              program: 'B.Tech',
              branch: 'Computer Science',
              graduationYear: 2027,
              cgpa: 8.0,
              skills: [],
              projects: [],
              internships: [],
              assessments: [],
              preferences: { targetRoles: ['SDE'], preferredLocations: ['Bengaluru'], minSalaryLPA: 6, employmentTypes: ['Full-Time'] },
              availability: 'actively_seeking',
              globalDataPrivacy: { allowUnsolicitedPings: false, anonymizeProfileUntilConsent: false, shareVerifiedBadgesGlobally: true, autoDeclineBelowMinSalary: false }
            });
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/user-cancelled' || err.code === 'auth/cancelled-popup-request') {
        setError('Sign-in cancelled. Please try again.');
      } else if (err.code === 'unavailable' || (err.message && err.message.toLowerCase().includes('offline'))) {
        console.warn('Auth offline warning:', err);
        setError('Network error: Unable to connect to the database. If you are in a preview, please try opening the app in a new tab.');
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
            <div>
              <label className="block text-xs font-mono font-bold text-[#AAAAAA] uppercase mb-1 mt-2">
                Select Your Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-[#181818] text-xs font-mono text-white p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
              >
                <option value="student">Student Candidate</option>
                <option value="employer">Employer / Recruiter</option>
                <option value="institution">Institution / University</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-[#CCFF00] hover:bg-[#b3ff00] text-black font-sans font-bold text-sm transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Login to OS' : 'Initialize Account'}</span>
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
      </div>
    </div>
  );
};

