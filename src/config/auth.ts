// src/config/auth.ts
//
// When a restored session is signed out. Rule for this folder:
// src/config/README.md.

/**
 * A session restored from storage is signed out when the user's
 * `lastActiveAt` (server time) is this many days old or more.
 */
export const INACTIVE_EXPIRY_DAYS = 10;

/**
 * A credential verified this recently is trusted whatever `lastActiveAt` says:
 * the expiry gate is for sessions restored from storage, not fresh sign-ins.
 */
export const FRESH_SIGNIN_WINDOW_MS = 5 * 60 * 1000;
