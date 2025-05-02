// src/hooks/useAuthUser.ts
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { initAuthIfNeeded } from '../services/initAuth';

export const useAuthUser = () => {
  const { user, userInfo, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      initAuthIfNeeded();
    }
  }, [initialized]);

  return { user, userInfo };
};