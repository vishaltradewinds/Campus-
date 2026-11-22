import {createContext,useContext} from 'react';
import type {ClientPrincipal} from '../lib/clientIdentity';
import type {AccountRequest} from '../lib/accountClient';
import { UserRole } from '../types';

export interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface AuthContextType {
  user: ClientPrincipal | null;
  request:AccountRequest;
  currentPrincipal:()=>ClientPrincipal|null;
  userData: UserData | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
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
