// src/store/authStore.ts
import { create } from 'zustand';
import { User } from 'firebase/auth';
import { SignInMethod } from '../utils/authProviders';

export interface UserInfo {
  name: string;
  email: string;
  uid: string;
  createdAt: any;
  role: string;
  // A list since TICKET-012; accounts created before that store a single string.
  // Read it through normalizeSignInMethods, never directly.
  provider?: SignInMethod | SignInMethod[];
}

interface AuthState {
  user: User | null;
  userInfo: UserInfo | null;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setUserInfo: (info: UserInfo | null) => void;
  setInitialized: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userInfo: null,
  initialized: false, // always starts false — initAuthIfNeeded sets it to true at runtime
  setUser: (user) => set({ user }),
  setUserInfo: (info) => set({ userInfo: info }),
  setInitialized: (value) => set({ initialized: value }),
}));