import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firebaseUtils';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';

export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isSuperAdmin: false,
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSetUserRecord = async (currentUser: User) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data() as UserData);
      } else {
        // Roles, especially super_admin, must be provisioned explicitly.
        // Never infer privileged access from an email address in the client.
        setUserData(null);
      }
    } catch (err) {
      console.error('Error fetching user document from Firestore:', err);
      if (err instanceof Error && (err.message.toLowerCase().includes('missing or insufficient permissions') || err.message.toLowerCase().includes('permission-denied'))) {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      }
      setUserData(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await fetchAndSetUserRecord(currentUser);
      else setUserData(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (auth.currentUser) await fetchAndSetUserRecord(auth.currentUser);
  };

  const signOut = async () => {
    setUserData(null);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const isSuperAdmin = userData?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, userData, loading, isSuperAdmin, signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
