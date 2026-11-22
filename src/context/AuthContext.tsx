import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fetchOwnAccount } from '../lib/accountClient';
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

  const generation = useRef(0);
  const fetchAndSetUserRecord = async (currentUser: User) => {
    const run = ++generation.current;
    try {
      const record = await fetchOwnAccount(currentUser);
      if (run !== generation.current || auth.currentUser?.uid !== currentUser.uid) return;
      setUserData(record?.uid === currentUser.uid ? record : null);
    } catch {
      if (run === generation.current) setUserData(null);
    } finally {
      if (run === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      generation.current++;
      setUserData(null);
      setUser(currentUser);
      setLoading(Boolean(currentUser));
      if (currentUser) void fetchAndSetUserRecord(currentUser);
    });
    return () => { generation.current++; unsubscribe(); };
  }, []);

  const refreshUserData = async () => {
    if (auth.currentUser) await fetchAndSetUserRecord(auth.currentUser);
  };
  const signOut = async () => {
    generation.current++;
    setUserData(null);
    setUser(null);
    setLoading(false);
    await firebaseSignOut(auth);
  };

  const safeUserData = user && userData?.uid === user.uid ? userData : null;
  const isSuperAdmin = safeUserData?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, userData: safeUserData, loading, isSuperAdmin, signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
