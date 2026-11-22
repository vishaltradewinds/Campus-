import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type {ClientPrincipal} from '../lib/clientIdentity';
import {activeIdentity} from '../lib/activeClientIdentity';
import { fetchOwnAccount, type AccountRequest } from '../lib/accountClient';
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
  user: ClientPrincipal | null;
  request:AccountRequest;
  currentPrincipal:()=>ClientPrincipal|null;
  userData: UserData | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  request:async()=>{throw Error("Authentication required");},
  currentPrincipal:()=>null,
  userData: null,
  loading: true,
  isSuperAdmin: false,
  signOut: async () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ClientPrincipal | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const generation = useRef(0);
  const fetchAndSetUserRecord = async (currentUser: ClientPrincipal) => {
    const run = ++generation.current;
    try {
      const record = await fetchOwnAccount(currentUser);
      if (run !== generation.current || activeIdentity.currentUser?.uid !== currentUser.uid) return;
      setUserData(record?.uid === currentUser.uid ? record : null);
    } catch {
      if (run === generation.current) setUserData(null);
    } finally {
      if (run === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = activeIdentity.subscribe((currentUser) => {
      generation.current++;
      setUserData(null);
      setUser(currentUser);
      setLoading(Boolean(currentUser));
      if (currentUser) void fetchAndSetUserRecord(currentUser);
    });
    return () => { generation.current++; unsubscribe(); };
  }, []);

  const refreshUserData = async () => {
    if (activeIdentity.currentUser) await fetchAndSetUserRecord(activeIdentity.currentUser);
  };
  const signOut = async () => {
    generation.current++;
    setUserData(null);
    setUser(null);
    setLoading(false);
    await activeIdentity.signOut();
  };

  const request:AccountRequest=async(path,init)=>{const principal=activeIdentity.currentUser;if(!principal)throw Error("Authentication required");const token=await principal.getIdToken();if(activeIdentity.currentUser!==principal||!token)throw Error("Authentication changed");const headers=new Headers(init?.headers);headers.set("Authorization","Bearer "+token);const response=await fetch(path,{...init,headers});if(activeIdentity.currentUser!==principal)throw Error("Authentication changed");return response;};
  const safeUserData = user && userData?.uid === user.uid ? userData : null;
  const isSuperAdmin = safeUserData?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, request, currentPrincipal:()=>activeIdentity.currentUser, userData: safeUserData, loading, isSuperAdmin, signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
