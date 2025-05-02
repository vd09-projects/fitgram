// src/store/authStore.ts
import { create } from 'zustand';
import { User } from 'firebase/auth';

export interface UserInfo {
  name: string;
  email: string;
  uid: string;
  createdAt: any;
  role: string;
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
  initialized: false,
  setUser: (user) => set({ user }),
  setUserInfo: (info) => set({ userInfo: info }),
  setInitialized: (value) => set({ initialized: value }),
}));