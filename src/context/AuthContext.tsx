import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';

interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginWithLocalSession: (role: UserRole, email: string, name?: string) => Promise<void>;
}

const LOCAL_USER_KEY = 'nexustalent_active_session';

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
  loginWithLocalSession: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is an active local fallback session
    const savedSession = localStorage.getItem(LOCAL_USER_KEY);
    let fallbackUserData: UserData | null = null;
    if (savedSession) {
      try {
        fallbackUserData = JSON.parse(savedSession);
      } catch (e) {
        console.error('Failed to parse local session:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.uid);
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch user role from Firestore
        try {
          console.log("Fetching user doc...");
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          console.log("User doc fetched:", userDoc.exists());
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          } else if (fallbackUserData) {
            setUserData(fallbackUserData);
          } else {
            setUserData(null);
          }
        } catch (error: any) {
          if (fallbackUserData) {
            setUserData(fallbackUserData);
          } else {
            console.warn("Firestore access error:", error);
            setUserData(null);
          }
        }
      } else if (fallbackUserData) {
        setUserData(fallbackUserData);
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithLocalSession = async (role: UserRole, email: string, name?: string) => {
    const uid = 'local-' + role + '-' + Date.now();
    const sessionData: UserData = {
      uid,
      email,
      role,
      name: name || (email.split('@')[0] === 'admin' ? 'System Administrator' : email.split('@')[0])
    };

    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(sessionData));
    setUserData(sessionData);

    // Also attempt anonymous sign in if possible so Firebase is connected
    try {
      if (!auth.currentUser) {
        const anon = await signInAnonymously(auth);
        sessionData.uid = anon.user.uid;
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(sessionData));
        setDoc(doc(db, 'users', anon.user.uid), {
          ...sessionData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.warn('Anonymous auth unavailable, proceeding with local authenticated session:', e);
    }
  };

  const signOut = async () => {
    localStorage.removeItem(LOCAL_USER_KEY);
    setUserData(null);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut, loginWithLocalSession }}>
      {children}
    </AuthContext.Provider>
  );
};

