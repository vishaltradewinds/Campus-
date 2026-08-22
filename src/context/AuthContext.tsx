import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// Designated pre-authorized root administrators
const AUTHORIZED_ADMIN_EMAILS = [
  'admin@nexustalent.os',
  'system.admin@nexustalent.os',
  'admin@apex.com',
  'vkonline99@gmail.com'
];

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
        const data = userDocSnap.data() as UserData;
        setUserData(data);
      } else {
        // Document does not exist yet. Check if email is in the admin authorization whitelist
        const userEmail = currentUser.email || '';
        const isAdmin = AUTHORIZED_ADMIN_EMAILS.includes(userEmail.toLowerCase());

        if (isAdmin) {
          const adminUserData: UserData = {
            uid: currentUser.uid,
            email: userEmail,
            role: 'super_admin',
            name: currentUser.displayName || 'System Administrator',
          };
          await setDoc(userDocRef, {
            ...adminUserData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          setUserData(adminUserData);
        } else {
          // Normal user whose registration has not yet written a /users document
          setUserData(null);
        }
      }
    } catch (err) {
      console.error('Error fetching user document from Firestore:', err);
      if (err instanceof Error && (err.message.toLowerCase().includes('missing or insufficient permissions') || err.message.toLowerCase().includes('permission-denied'))) {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      }
      // Fallback check if user email is authorized root admin
      if (currentUser.email && AUTHORIZED_ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
        setUserData({
          uid: currentUser.uid,
          email: currentUser.email,
          role: 'super_admin',
          name: currentUser.displayName || 'System Administrator'
        });
      } else {
        setUserData(null);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchAndSetUserRecord(currentUser);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (auth.currentUser) {
      await fetchAndSetUserRecord(auth.currentUser);
    }
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


