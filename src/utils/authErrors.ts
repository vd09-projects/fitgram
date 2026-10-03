// src/utils/authErrors.ts
//
// Started for the password flows in TICKET-012 Phase 2. TICKET-013 extends it to
// the sign-in, sign-up and logout call sites that still pass error.message into a
// toast verbatim — add their codes to MESSAGES rather than starting a second map.

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

const MESSAGES: Record<string, string> = {
  // Email-enumeration protection collapses wrong-password and no-such-account into
  // one code on purpose, so this stays vague — it must not reveal which happened
  'auth/invalid-credential': 'That password is not correct.',
  'auth/wrong-password': 'That password is not correct.',
  'auth/weak-password': 'Please choose a longer password (at least 6 characters).',
  'auth/requires-recent-login': 'Please sign in again, then try this once more.',
  'auth/provider-already-linked': 'This account already has a password.',
  'auth/credential-already-in-use': 'Those details already belong to another account.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};

// Firebase errors carry a code; the Errors our own services throw do not, and their
// messages are already written for users, so they pass through untouched.
export const describeAuthError = (error: unknown): string => {
  const code = (error as { code?: unknown })?.code;

  if (typeof code === 'string') {
    return MESSAGES[code] || GENERIC_MESSAGE;
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message ? message : GENERIC_MESSAGE;
};
