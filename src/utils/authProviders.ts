// src/utils/authProviders.ts
import { EmailAuthProvider, GoogleAuthProvider, User } from 'firebase/auth';

export type SignInMethod = 'email' | 'google';

// Firebase provider ids -> the names stored in users/{uid}/info/data.provider
const METHOD_BY_PROVIDER_ID: Record<string, SignInMethod> = {
  [EmailAuthProvider.PROVIDER_ID]: 'email', // 'password'
  [GoogleAuthProvider.PROVIDER_ID]: 'google', // 'google.com'
};

// Firebase Auth owns the truth about what is linked; Firestore only mirrors it
export const getLinkedMethods = (user: User): SignInMethod[] => {
  const methods = user.providerData
    .map((profile) => METHOD_BY_PROVIDER_ID[profile.providerId])
    .filter((method): method is SignInMethod => Boolean(method));

  return Array.from(new Set(methods));
};

// Accounts created before linking existed store a single string, not a list
export const normalizeSignInMethods = (value: unknown): SignInMethod[] => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.filter((item): item is SignInMethod => item === 'email' || item === 'google');
};
