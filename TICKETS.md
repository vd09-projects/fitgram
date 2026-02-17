# Fitgram - Rewrite & Feature Tickets

## Overview

This document outlines tickets for restructuring/cleaning up the existing codebase and upcoming feature work (Google Sign-In, Forgot Password, Active Workout Animations). The rewrite tickets are designed so that the upcoming features can be built on a clean foundation.

---

## PHASE 1: Codebase Rewrite & Cleanup

---

### ~~TICKET-001: Add ESLint + Prettier + Pre-commit Hooks~~ ✅ DONE

**Priority:** High | **Effort:** Small | **Status: COMPLETED**

**What was done:**
- Installed and configured ESLint with `@typescript-eslint`, `react`, `react-hooks` plugins
- Installed and configured Prettier (single quotes, trailing commas, 100 char width)
- Added Husky + lint-staged pre-commit hooks (auto-formats + lints staged files)
- Added `lint`, `lint:fix`, `format`, `format:check` scripts to `package.json`
- Ran formatter across the entire codebase
- Added `no-console` (warn) and `no-explicit-any` (warn) lint rules

**Files added/modified:**
- `.eslintrc.json` — ESLint config
- `.prettierrc.json` — Prettier config
- `.prettierignore` — ignore patterns
- `.husky/pre-commit` — runs `lint-staged`
- `package.json` — scripts + lint-staged config

**Current lint status:** 153 warnings (console statements + `any` types), 36 pre-existing errors (hooks rule violations — addressed in TICKET-006)

---

### TICKET-002: Eliminate All `any` Types

**Priority:** High | **Effort:** Small

**Problem:**
There are 13+ instances of `any` types (`error: any`, `obj: any`, `React.RefObject<any>`, `Record<string, any>`, `createdAt: any`). This defeats the purpose of TypeScript and hides bugs.

**Acceptance Criteria:**
- [ ] Replace every `any` with a proper type or `unknown` (for error catches)
- [ ] Define explicit interfaces for all Firebase document shapes
- [ ] Type `createdAt` properly in `UserInfo` (likely `Timestamp` or `Date`)
- [ ] Ensure no new `any` is introduced (enforce via ESLint rule `@typescript-eslint/no-explicit-any`)

**Key Files:**
- `src/types/` - all type definition files
- `src/services/db/userDB.ts`
- `src/components/` - components using `any` refs or props

---

### TICKET-003: Split `userDB.ts` into Domain-Specific Service Files

**Priority:** High | **Effort:** Medium

**Problem:**
`src/services/db/userDB.ts` is 490 lines and handles all Firestore operations — workouts, exercises, logs, user profile. This makes it hard to find things, test, and extend (especially when adding auth features).

**Acceptance Criteria:**
- [ ] Create `src/services/db/workoutService.ts` — workout plan CRUD
- [ ] Create `src/services/db/exerciseService.ts` — exercise CRUD within workouts
- [ ] Create `src/services/db/logService.ts` — workout log operations + historical queries
- [ ] Create `src/services/db/userService.ts` — user profile operations
- [ ] Keep `src/services/db/index.ts` as a barrel export for backward compatibility
- [ ] Each file should be under 150 lines
- [ ] All existing imports across the app must be updated

**Why This Matters for Upcoming Features:**
Google Sign-In and Forgot Password will add more auth/user operations. A clean `userService.ts` and `authService.ts` separation prevents this file from growing further.

---

### TICKET-004: Centralize Error Handling & Replace Console Statements

**Priority:** Medium | **Effort:** Medium

**Problem:**
Errors are handled via `console.error` with no user-facing feedback in many places. There are 46+ console statements with emoji prefixes (✅, ❌, 🔄) used for debugging that shouldn't be in production.

**Acceptance Criteria:**
- [ ] Create `src/utils/logger.ts` — a simple logger that can be toggled off in production (e.g., wraps `__DEV__` check)
- [ ] Replace all `console.log` / `console.error` with the logger or remove them
- [ ] For user-facing errors, use the existing Toast system (`react-native-toast-message`) consistently
- [ ] Add an `ErrorBoundary` component that catches React render errors gracefully

**Files Affected:** All files with `console.*` calls (spread across services, stores, components)

---

### TICKET-005: Centralize AsyncStorage Access

**Priority:** Medium | **Effort:** Small

**Problem:**
Direct `AsyncStorage.getItem` / `setItem` calls are scattered across multiple files. There's no consistent key naming, no error recovery, and no single place to see what's being persisted.

**Acceptance Criteria:**
- [ ] Create `src/services/storage/storageService.ts` with typed get/set/remove helpers
- [ ] Define all storage keys in a single `STORAGE_KEYS` constant
- [ ] Migrate all direct `AsyncStorage` calls to use the new service
- [ ] Add try/catch with fallback defaults for all reads

**Why This Matters for Upcoming Features:**
Google Sign-In tokens and session persistence will need storage. Having a centralized service prevents key collisions and inconsistent patterns.

---

### TICKET-006: Break Down Large Components

**Priority:** Medium | **Effort:** Medium

**Problem:**
Several components exceed 200 lines and mix multiple concerns:
- `SearchableInputDropdown.tsx` — 253 lines
- `WorkoutHistoricalLogsFilter.tsx` — 247 lines
- `TourStepOverlay.tsx` — 193 lines
- `EditableList.tsx` — 171 lines
- `TourGuideProvider.tsx` — 161 lines (mixes context + overlay rendering)

**Acceptance Criteria:**
- [ ] `SearchableInputDropdown` — extract search logic into a custom hook (`useSearchFilter`)
- [ ] `WorkoutHistoricalLogsFilter` — separate filter state logic from UI, extract filter chips into sub-component
- [ ] `TourGuideProvider` — split context logic from overlay presentation
- [ ] `EditableList` — extract inline form into a separate `EditableListItem` component
- [ ] No component file should exceed ~150 lines after refactor
- [ ] All existing functionality must remain unchanged (visual regression check)

---

### TICKET-007: Strengthen TypeScript Configuration

**Priority:** Low | **Effort:** Small

**Problem:**
`tsconfig.json` is nearly empty — just `{ "extends": "expo/tsconfig.base" }`. This relies on Expo defaults with no project-specific strictness.

**Acceptance Criteria:**
- [ ] Enable `strict: true` (enables `strictNullChecks`, `noImplicitAny`, etc.)
- [ ] Add `noUnusedLocals: true` and `noUnusedParameters: true`
- [ ] Add path aliases for cleaner imports (e.g., `@/components/*`, `@/services/*`)
- [ ] Fix any new type errors that surface from stricter settings

---

### TICKET-008: Add Barrel Exports for Clean Imports

**Priority:** Low | **Effort:** Small

**Problem:**
Imports are verbose with deep relative paths (e.g., `../../components/SomeComponent`). No `index.ts` barrel files exist.

**Acceptance Criteria:**
- [ ] Add `index.ts` barrel exports to: `components/`, `services/`, `stores/`, `hooks/`, `types/`, `utils/`, `constants/`
- [ ] If path aliases are set up (TICKET-007), update imports to use `@/components/X` style
- [ ] Ensure no circular dependencies are introduced

---

## PHASE 2: Upcoming Features

> These tickets assume the rewrite (Phase 1) is mostly complete. They reference the cleaner structure.

---

### TICKET-009: Google Sign-In / Sign-Up

**Priority:** High | **Effort:** Large

**Description:**
Allow users to sign in or create an account using their Google account, in addition to the existing email/password flow.

**Acceptance Criteria:**
- [ ] Install and configure `@react-native-google-signin/google-signin` (or Expo's `expo-auth-session` with Google provider)
- [ ] Set up Google OAuth credentials in Firebase Console (iOS + Android)
- [ ] Add "Sign in with Google" button to `SignIn` screen
- [ ] Add "Sign up with Google" button to `SignUp` screen
- [ ] On first Google sign-in, create a user profile document in Firestore (same shape as email sign-up)
- [ ] Handle account linking — if a user already signed up with email and tries Google (same email), link accounts or show clear error
- [ ] Update `authStore.ts` to handle Google auth state
- [ ] Update `authService.ts` with `signInWithGoogle()` and `linkGoogleAccount()` methods
- [ ] Test on both iOS and Android

**Technical Notes:**
- Firebase supports `GoogleAuthProvider` natively — use `signInWithCredential` after getting the Google ID token
- The new `userService.ts` (from TICKET-003) will handle profile creation
- Store the auth provider type in the user profile for future reference

**Dependencies:** TICKET-003 (service split), TICKET-005 (storage for tokens)

---

### TICKET-010: Forgot Password Flow

**Priority:** High | **Effort:** Small

**Description:**
Allow users who signed up with email/password to reset their password via a "Forgot Password?" link on the Sign-In screen.

**Acceptance Criteria:**
- [ ] Add "Forgot Password?" link/button below the password field on the `SignIn` screen
- [ ] Create a `ForgotPassword` screen with an email input field
- [ ] On submit, call Firebase `sendPasswordResetEmail()`
- [ ] Show success Toast: "Password reset email sent. Check your inbox."
- [ ] Show error Toast for invalid/unregistered emails
- [ ] Add the `ForgotPassword` screen to `AuthNavigator`
- [ ] Handle edge case: user signed up with Google only (no password to reset) — show appropriate message
- [ ] Add input validation (valid email format) before sending

**Technical Notes:**
- Firebase handles the actual email sending and reset link — no backend work needed
- Add `forgotPassword()` method to `authService.ts`
- Consider rate limiting or a cooldown to prevent spam

**Dependencies:** TICKET-003 (clean authService separation)

---

### TICKET-011: Active Workout Animation / Indicator

**Priority:** Medium | **Effort:** Medium

**Description:**
When a user has an active workout in progress, show a visible animated indicator so they can easily return to it from any screen. Currently, if a user navigates away, there's no visual cue that a workout is still running.

**Acceptance Criteria:**
- [ ] Add a floating animated indicator (e.g., pulsing bar, floating button, or banner) visible on all screens when `activeWorkout` is not null in `useWorkoutStore`
- [ ] Tapping the indicator navigates to the active workout (`LogWorkout` screen)
- [ ] The indicator should show basic info: workout name and elapsed time
- [ ] Add a subtle animation (pulse, glow, or breathing effect) using `react-native-reanimated` or `Animated` API
- [ ] The indicator should NOT appear on the `LogWorkout` screen itself (since user is already there)
- [ ] The indicator should respect the current theme (light/dark)
- [ ] Smooth entry/exit animations when workout starts/ends

**Technical Notes:**
- Place the indicator in `LayoutNavigator` so it appears across all main tabs
- Read state from `useWorkoutStore.activeWorkout`
- Use `useNavigation` to handle the tap-to-navigate action
- Consider using `react-native-reanimated` for performant animations (already may be included via Expo)

**Dependencies:** None (can be built independently, but benefits from TICKET-006 keeping components small)

---

## Recommended Execution Order

```
1. TICKET-001  (ESLint/Prettier)         — Foundation for all future code
2. TICKET-007  (tsconfig strictness)      — Catch issues early
3. TICKET-002  (Remove `any` types)       — Fix issues surfaced by strict mode
4. TICKET-003  (Split userDB.ts)          — Unblocks feature tickets
5. TICKET-004  (Error handling)           — Clean up console noise
6. TICKET-005  (AsyncStorage service)     — Unblocks Google Sign-In
7. TICKET-006  (Break large components)   — General cleanup
8. TICKET-008  (Barrel exports)           — Polish
9. TICKET-010  (Forgot Password)          — Quickest feature win
10. TICKET-009 (Google Sign-In)           — Largest feature
11. TICKET-011 (Active Workout Animation) — UX enhancement
```

---

*Generated on: 2025-02-17*
*Based on codebase analysis of the fitgram project*
