# Fitgram - Rewrite & Feature Tickets

## Overview

This document outlines tickets for restructuring/cleaning up the existing codebase and upcoming feature work (Google Sign-In, Forgot Password, Active Workout Animations). The rewrite tickets are designed so that the upcoming features can be built on a clean foundation.

---

## Pending Work

Everything still open, newest information first. Sizes are the ticket's own
estimate unless a note corrects it. **This list is the source of truth for what is
left**; a ticket's own `Status:` line further down may be stale.

Order is *not* decided here — see Recommended Execution Order at the end.

| # | What is left | Size | Note |
|---|---|---|---|
| 001 | ESLint + Prettier + pre-commit hooks | Small | **At risk:** `5d9189b` (100 files) is on no branch, only in `stash@{0}` of 16. Marked DONE in its section; it is not on `main` |
| 002 | Remove the remaining `any` types | Small | ~12 left across 8 files |
| 003 | Finish the `userDB.ts` split | Small | Substance done (userDB is 152 lines, logs moved to `workoutSessions.ts`); the named files and barrel export are not |
| 004 | Centralize error handling, replace console calls | Medium | Concrete cases recorded: `persistWorkout`'s `console.log`; `setSetEffort` (and `removeSet`/`restoreSet`) callers fire without a catch, so a failed save is an unhandled rejection (PR #15) |
| 005 | Centralize AsyncStorage access | Small | 9 files touch it directly |
| 006 | Break down large components | Medium | **Needs re-scoping:** its named targets are gone; the biggest files now are Phase 3's own (`StartWorkoutScreen` 405, `ExerciseLogger` 371) |
| 007 | Strengthen the TypeScript config | Small | |
| 008 | Barrel exports | Small | |
| 011 | Cross-screen active-workout indicator | Medium | **021 and 029 both defer their surface decision to this** |
| 012 | Account linking — Phase 2 | Small-Med | Phase 1 shipped; Phase 2 makes linking reachable |
| 013 | Human-readable auth error messages | Small | `describeAuthError` exists but has one call site; sign-in, sign-up and logout still pass raw Firebase messages |
| 014 | Reset email branding — Phase 1 | Small | Console-only; the template itself is locked by Firebase |
| 023 | Guided tour: press-to-continue steps | Medium | Shelved patch in `docs/patches/` |
| 025 | Footer highlight follows the current screen | Small | |
| 026 | Clear account-scoped state on sign-out | Small | **Privacy:** the next user sees the previous one's cached history and upload queue |
| 029 | Pending uploads view | Small-Med | A `TEMPORARY` debug screen is currently the only way to see the queue |
| 030 | Drop unit suffixes from catalogue field names | Small | **Silent data loss:** renaming a field nulls every past value for it, and the session stays `comparable` so nothing flags it |
| 031 | Contrast guards for the rest of the role palette | Small | Extends the `colors.test.ts` pattern |
| 032 | Edit or delete an already-uploaded set | Med-Large | Needs a rollup rebuild |
| 033 | Drop sets | Med-Large | Data-model change |
| 035 | Measures beyond weight x reps | Med-Large | "Which way is better" is a product decision |
| 036 | Put a unit on volume trend points | Small-Med | Today the trend over-suppresses; held by an invariant test, not a fix |
| 037 | Tell apart two sessions on the same day | Small | |
| 038 | Per-exercise rest duration, and a control | Medium | **Nothing can set a non-default rest today** |
| 039 | Decide whether the PR banner rewards rep progression | Small (decision) + Med (build) | |
| 043 | Exercise search and picker | Large | **Next.** Ports the prototype and its 91 cases; "Latpulldown", "squad", "bech press" return 0 today. Opens from today's Manage Workout. Split 2026-10-27 into 043 / 050 / 051 / 052, each done by a device test |
| 050 | Picker start page: recents, filters, last-used version | Medium | After 043 |
| 051 | Manage Workout: exercise list and Save changes | Medium | After 043; can run alongside 050 |
| 052 | Manage Workout: new plan and first plan | Small–Medium | After 051 |
| 053 | Guided tour: end-to-end pass after the catalog work | Medium | After 043, 050, 051, 052. The tour is not working and is no longer fixed per ticket (user, 2026-10-27) |
| 045 | Create a custom exercise again | Medium | Deferred 2026-10-24: catalog only for now. Reopen on evidence of a gap. Storage: per-plan copies today, library undecided |
| 047 | Switch an exercise's version mid-workout | Medium | Deferred 2026-10-24. For this workout only; the plan keeps its version |
| 049 | Move the client-SDK scripts to the admin SDK | Small | **Before the next real repair**: `rebuildExerciseStats` (the app's own log names it) already gets PERMISSION_DENIED; the open rule expired 2025-08-25 |

### Not tickets — verification owed

- **`WorkoutSessionDoc.volume` has never had a real Firestore write.** On `main`
  since TICKET-022, written on every Finish, and it feeds the Start screen's
  volume figures.
- **The guided tour has not been run since the scroll-buffer change** landed
  (PR #13). Both states are unit-tested; nobody has watched a bottom step scroll
  above its tooltip.
- **TICKET-034's set marks have never had a real Firestore write** (`setEffort`
  on the session doc and in the `exercise_stats` rollup), and the rules are
  untested for it. Merged in PR #15; unit-tested only.
- **TICKET-040's edit mode has never run on a device.** Merged in PR #16;
  unit-tested only. Unwatched: the layout at phone width (the three-button strip
  and its hint, the Editing label, Cancel/Save, the rest line), the rest line
  switching to "Rest done" mid-edit, and the guided tour over the card in edit mode.

One device session covers all four: start a workout, log two sets, mark one
easy or hard, edit the other during its rest and wait for the rest to end, Save,
Finish online, start the same workout again and check "last time" shows the mark
and the edited values, then run the tour from Profile (once with an edit open).

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

**Concrete case:** `persistWorkout` in `src/stores/useWorkoutStore.tsx` logs a failed
save with `console.log`, not `console.error` (TICKET-027). In a dev build,
`console.error` opened LogBox's red banner on top of the "Could not save workout" toast.
That also removed the only error-level record of a genuinely failed save. The logger
here should report it to the user *and* record it at error severity without the LogBox
double-up. Don't revert it to `console.error` blindly, and don't copy the `log` pattern
for errors that aren't expected.

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

### TICKET-012: Account Linking — one identity, multiple sign-in methods

**Priority:** High | **Effort:** Small | **Status: IN PROGRESS** — Phase 1 done, Phase 2 open

**Problem:**

`vikrantdhawan9@gmail.com` can sign in with Google but not with email/password —
Firebase returns `auth/invalid-credential`. The account exists with only a Google
provider; no password credential was ever created for it.

`linkGoogleAccount()` exists in `src/services/db/authService.ts:105` but is **never
called from anywhere**. So every account ends up with exactly one provider and can
never gain another. There is also no password reset flow anywhere in the app, so a
user in this state has no self-service route back in.

Firebase's email-enumeration protection (on by default) returns the same
`auth/invalid-credential` for *wrong password* and *no password credential*, so the
client cannot tell the user which one happened. The toast is therefore unhelpful by
construction.

**Hard requirement:** one email = one uid = one data tree. Every Firestore path in
`src/services/db/userDB.ts` is keyed by uid (`users/{userId}/workouts`,
`users/{userId}/workout_logs/.../logs`, `users/{userId}/info/data` — nine call
sites). Two uids for one person means two disjoint sets of workouts and history
that diverge permanently. Linking must therefore attach providers to the existing
uid; it must never create a second account or move data between uids.

**Before starting:** check Firebase Console → Authentication → Settings → User
account linking. If it is set to *Multiple accounts per email address*, duplicate
uids can already exist and Phase 3 is required. If it is *One account per email*
(the default), Phase 3 is almost certainly unnecessary — switch it to one-account
either way to stop new duplicates, noting that this does not merge existing ones.

---

**Phase 1 — DONE (2026-10-03). Unblocks the reported problem.**

- [x] `sendPasswordReset(email)` wrapping `sendPasswordResetEmail`, with a
      "Forgot password?" link on `SignInScreen`
- [x] `setPasswordForCurrentUser(password)` using
      `linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password))`
      so a Google-only user can add a password
- [x] Handle `auth/requires-recent-login` by re-authenticating before linking —
      Firebase rejects credential changes on an old session
- [x] Update `users/{uid}/info/data.provider` once a second method is linked; the
      field is currently a single value (`'email' | 'google'`) and should become a
      list of linked methods

`setPasswordForCurrentUser` has no caller yet — the screen that calls it is the
Phase 2 "Sign-in methods" section. The locked-out user is unblocked by the reset
link alone: completing it attaches a password to the existing uid.

Phase 1 notes:
- `src/utils/authProviders.ts` is the one place that maps Firebase provider ids to
  the stored `'email' | 'google'` names. `getLinkedMethods(user)` reads
  `user.providerData` (auth is the source of truth); `normalizeSignInMethods(value)`
  reads the Firestore field and tolerates the legacy single-string form
- `provider` is written as a list on every new account and re-synced from
  `providerData` after any link, so it can never drift to a stale single value
- The sync write is best-effort (`console.warn` on failure): the credential change
  has already committed by then, and reporting a failed link would be a lie
- Re-authentication can only use a provider the account already has. A Google-only
  account has no password to re-enter, so Google is the only usable path; an
  email-only account hitting `requires-recent-login` is told to sign in again

**Phase 2 — Small/Medium. Makes linking reachable and automatic.**

- [x] Profile → "Sign-in methods" section listing linked providers, with an action
      to add the missing one — `src/components/SignInMethodsSection.tsx`. Covers the
      password half: sets one on a Google-only account (the Phase 1 function finally
      has a caller) and changes an existing one
- [ ] Wire up the existing `linkGoogleAccount()` from that same section, so an
      email-only account can add Google. The section already renders the method
      list it belongs next to
- [ ] Handle `auth/account-exists-with-different-credential` in the Google path:
      look up existing methods for the email, sign in with the known method, then
      `linkWithCredential` the Google credential instead of erroring
- [ ] Fix `signUpWithGoogle` (`authService.ts:84-87`), which calls `setUser(user)`
      and *then* throws "Account already exists" — signing the user in and showing
      them an error at the same time
- [ ] Never leave an account with zero sign-in methods: block unlinking the last one

Phase 2 notes (password half, 2026-10-03):
- `changePasswordForCurrentUser` re-authenticates up front with the password the
  user typed rather than waiting for `auth/requires-recent-login`. That both
  satisfies Firebase and verifies they know the current password, which is the
  only check standing between a borrowed unlocked phone and a stolen account
- The section re-renders off `info/data.provider`, not `user.providerData`: the
  store holds one `User` instance that `linkWithCredential` mutates in place, so
  it never triggers a render. The Firestore mirror arrives through the existing
  `onSnapshot` in `initAuth.ts` and flips the UI from "Set" to "Change" by itself
- Setting a password on a Google-only account can open the Google picker, since
  that is the only way to re-authenticate an account with no password. The copy
  in the section warns about this before the user taps
- Changing a password asks for the current one even though Firebase would accept
  a fresh session without it. Sessions here persist for `INACTIVE_EXPIRY_DAYS`,
  so being signed in proves possession of the phone, not of the account; without
  that field anyone holding an unlocked phone could take the account over. A
  "Forgot your current password?" link in the same section sends a reset mail to
  the signed-in address, so the requirement has an escape hatch rather than a
  dead end — proof of inbox access instead of proof of password

**Phase 3 — NOT NEEDED (confirmed 2026-10-03).** Firebase Console → Authentication
→ Settings → User account linking is set to *Link accounts that use the same
email*, so one email always resolves to one uid and duplicate accounts cannot be
created. Kept below only as a contingency if that setting is ever changed.

- [ ] Detect duplicates by email and pick a surviving uid
- [ ] Migrate `info/data`, `workouts/*` (incl. nested `exercises`) and
      `workout_logs/*/logs/*` — recursive, idempotent, resumable
- [ ] Delete the dead auth user via a Cloud Function; the client SDK cannot delete
      another user
- [ ] Dry-run mode and a verification pass before any destructive step

**Technical Notes:**
- Linking is `linkWithCredential` on the *currently signed-in* user; it fails with
  `auth/credential-already-in-use` if that credential belongs to another uid —
  which is exactly the Phase 3 signal
- `src/scripts/` already holds one-off Firestore scripts; a migration script fits
  there, but deletion of auth users still needs Admin credentials
- Phases 1 and 2 are independently shippable; Phase 3 is confirmed dead scope
- Because the project links accounts on matching email and Google emails are
  verified, Firebase auto-links Google onto an existing email/password account.
  The unhandled direction is the reverse: a Google-only account has no password
  and no sign-in path creates one, so it needs an explicit linkWithCredential

**Dependencies:** None. Phase 1 can ship on its own.

---

### TICKET-013: Human-readable auth error messages

**Priority:** Medium | **Effort:** Small | **Status: OPEN**

**Problem:**

Raw SDK errors are shown straight to users. Signing in with a wrong or
non-existent password produces:

> **Login Failed** — Firebase: Error (auth/invalid-credential).

That string is meaningful to a developer and useless to a user. It names a
vendor, exposes an internal error code, and says nothing about what to do next.

Five call sites pass `error.message` directly into a toast:

- `src/screens/auth/SignInScreen.tsx` — Login Failed, Google Sign-In Failed
- `src/screens/auth/SignUpScreen.tsx` — Sign Up Failed, Google Sign-Up Failed
- `src/screens/ProfileScreen.tsx` — Logout Failed

**Goal:** map error codes to plain-language messages that tell the user what
happened and what to do. Keep the raw error for developers via `console.warn`,
never on screen.

**Progress:** `src/utils/authErrors.ts` now exists — TICKET-012 Phase 2 needed it
for the password flows and added the codes those produce. What remains is the
other call sites and the codes only they can raise, including the Google Sign-In
status codes. Extend `MESSAGES` in that file; do not start a second map.

**Acceptance Criteria:**
- [x] Add `src/utils/authErrors.ts` mapping `error.code` to a user-facing message
- [ ] Replace every `error.message` in a toast with the mapped message; unknown
      codes fall back to a generic "Something went wrong. Please try again."
- [ ] Log the original error with `console.warn` so debugging is not lost
- [ ] No user-facing string contains "Firebase", "auth/", or a stack trace

**Codes to cover (at minimum):**

| Code | Suggested message |
|---|---|
| `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` | "Incorrect email or password." |
| `auth/invalid-email` | "That email address doesn't look right." |
| `auth/email-already-in-use` | "An account with this email already exists. Try signing in." |
| `auth/weak-password` | "Please choose a longer password (at least 6 characters)." |
| `auth/too-many-requests` | "Too many attempts. Please wait a few minutes and try again." |
| `auth/network-request-failed` | "No connection. Check your internet and try again." |
| `auth/requires-recent-login` | "Please sign in again to change your account settings." |
| `DEVELOPER_ERROR` (Google Sign-In) | "Google Sign-In isn't set up correctly for this build." |
| `SIGN_IN_CANCELLED` | suppress the toast entirely — the user chose to cancel |

**Technical Notes:**
- Firebase's email-enumeration protection deliberately returns
  `auth/invalid-credential` for both *wrong password* and *no such account*, so
  the message must stay deliberately vague — do not try to distinguish them, and
  do not reveal whether an email is registered
- `@react-native-google-signin` throws `error.code` values from `statusCodes`,
  not Firebase codes; handle both shapes
- `SIGN_IN_CANCELLED` currently shows an error toast when the user simply backs
  out of the Google picker; it should show nothing

**Related:** TICKET-012 — once account linking exists, `auth/invalid-credential`
on an account that only has Google should ideally say "This account uses Google
Sign-In. Tap Sign in with Google." That needs linking to land first.

**Dependencies:** None.

---

### TICKET-014: Password reset email lands in spam and is branded as a project number

**Priority:** High | **Effort:** Small (console) / Medium (own sender) | **Status: OPEN**

**Problem:**

The reset email TICKET-012 Phase 1 added works, but Gmail filed it under Spam
("This message is similar to messages that were identified as spam in the past")
and every user-facing string names the project number instead of the app:

> **Subject:** Reset your password for project-367435954102
> **From:** noreply@gymexerciselogger-fb.firebaseapp.com
> Follow this link to reset your **project-367435954102** password…
> Thanks, Your **project-367435954102** team

Two separate causes:

1. **`%APP_NAME%` is unset.** Firebase substitutes the public-facing project name
   into the default templates; with none set it falls back to `project-<number>`.
2. **The default sender is a shared domain.** `firebaseapp.com` sends for every
   Firebase project on earth, so its reputation is not ours to fix, and a generic
   body signed by a numeric project name matches the spam profile exactly.

Nothing here is reachable from app code — Firebase owns template rendering and
delivery. The only client-side lever is `actionCodeSettings`, which controls the
continue URL, not the branding or the sender.

**BLOCKER (found 2026-10-03).** The template editor refuses to save:

> Email template updates are currently unavailable for this project. For
> assistance with template changes, contact Firebase support

Google gates template editing on projects that send through the default
`firebaseapp.com` sender; the exact trigger for this project is unknown. Subject,
message body, sender name and reply-to are therefore all **unreachable**. The one
console lever still available is the public-facing name, which lives on a
different screen and feeds `%APP_NAME%` in the locked template.

**Phase 1 — the only console change still possible. Free, no domain.**

- [ ] Project settings → General → **Public-facing name** = `Fitgram`, and set the
      support email. The locked template still interpolates `%APP_NAME%`, so this
      alone replaces `project-367435954102` in the subject, body and signature
- [ ] Re-send to a Gmail account and confirm the rendered name changed
- [ ] Check whether **SMTP settings** on the Templates page is blocked by the same
      gate or is independently editable — it is a separate control, and if it
      opens, Phase 2 becomes reachable without a support ticket
- [ ] File a Firebase support ticket for template editing. Free, and the error
      message explicitly invites it; it may simply be restored on request

**Phase 2 — own sender domain. The actual deliverability fix.**

- [ ] Authentication → Templates → **SMTP settings**: point at a transactional
      provider (Resend, SendGrid, Mailgun, SES) on a domain we control
- [ ] Publish SPF, DKIM and DMARC for that domain — without all three, a custom
      sender is no better than the shared one
- [ ] Optional: custom **Action URL** domain via Firebase Hosting, so the link is
      not a bare `firebaseapp.com` URL with a visible `apiKey` query parameter

**Phase 3 — now the only route to custom copy, given the blocker above.**

- [ ] Cloud Function calling Admin SDK `generatePasswordResetLink(email)` and
      sending our own HTML mail through the provider. Needs the Blaze plan and a
      `functions/` directory, neither of which exists yet
- [ ] `sendPasswordReset` switches from `sendPasswordResetEmail` to a callable;
      the "Forgot password?" handler on `SignInScreen` does not change
- [ ] That path must return an identical response for a registered and an
      unregistered email — `generatePasswordResetLink` throws `user-not-found`,
      and surfacing that would undo the email-enumeration protection the client
      currently respects
- [ ] Firebase never sends anything on this path, so the template gate stops
      applying — subject, body and sender are all ours

**Unverified alternative:** the Identity Platform admin REST API
(`identitytoolkit.googleapis.com/admin/v2/projects/{id}/config`) exposes
`notification.sendEmail.resetPasswordTemplate`. It is likely behind the same gate
as the console, but a read-only GET would settle it cheaply. Needs `gcloud`
installed and authenticated; neither is present on this machine.

**Technical Notes:**
- `sendPasswordReset` in `src/services/db/authService.ts` needs no change for
  Phases 1 and 2; the template and transport are entirely server-side
- The reset toast on `SignInScreen` tells users to check their spam folder. That
  line is a workaround for this ticket and should be dropped once Phase 2 lands
- Changing the sender domain rotates the reputation back to zero, so expect a few
  days of warm-up before judging the result

**Dependencies:** TICKET-012 Phase 1 (shipped). Phase 2 needs a domain we own.

---

## PHASE 3: Workout Flow Redesign

> Rebuilds the start → log → compare → rest path around one idea: the number you
> need while deciding your next set is the number you lifted last time, and it
> should already be on screen. Today that number exists only on `WorkoutLogsScreen`
> behind a filter, so it is unreachable mid-set.
>
> Design reference: https://claude.ai/artifact/GaUZBuTFSKNhd7RxKqu9GN
>
> **Open decisions.** Needed before TICKET-019 and TICKET-021; they do not block 015-018.
>
> 1. ~~Rest duration has no home.~~ **Resolved in TICKET-021:** one global
>    preference (`restPreferenceStore`, AsyncStorage). Per exercise, falling back
>    to it, is TICKET-038.
> 2. ~~A mistyped set cannot be removed.~~ **Resolved in TICKET-019:**
>    `removeSet` / `restoreSet` on the active workout, before Finish, with an
>    inline undo. Deleting or editing an *uploaded* set is TICKET-032.
> 3. ~~Rest timer while the app is backgrounded.~~ **Resolved in TICKET-021:**
>    resume from timestamp only. No rest-end notification (`expo-notifications`
>    is not installed: native dependency, rebuild, permission prompt).
>
> A user-facing display-font selector is deliberately **not** ticketed. The decision
> is to ship one tuned face and keep the option cheap by making the font a theme
> token in TICKET-015.

---

### TICKET-015: Workout Flow Design Tokens (palette, type, numerals)

**Priority:** High | **Effort:** Medium | **Status: OPEN**

**Description:**
The redesigned workout flow needs a token foundation before any screen is rebuilt:
a deeper ground with real elevation layers, one accent for action, one signal colour
for "you beat last session", a neutral display face, and a monospace face for every
number. Tokens only — no screen layout changes land in this ticket.

**Acceptance Criteria:**
- [ ] Add Archivo (Regular, Bold) and IBM Plex Mono (Regular, Medium) ttf files to `assets/fonts/`
- [ ] Restructure `FONT_FAMILY` in `src/constants/styles.ts` into a per-face record that carries its own `letterSpacing`, replacing the single global pair
- [ ] Load all four faces in `App.tsx`
- [ ] Expose the font family through `ThemeContext` as a token, alongside the existing size scale
- [ ] `TextBase` reads family and letterSpacing from theme tokens; add a numeric variant that renders in the mono face; keep the `isDefaultFontFamilyRequired` escape hatch working
- [ ] Add the new role keys to **both** schemas in `src/constants/colors.ts`: `ground`, `surface`, `raised`, `hairline`, `hairlineStrong`, `accent`, `accentDeep`, `signal`, `signalDeep`, `danger`, `textGhost`
- [ ] Dark (`L: Death Note`) values: ground `#121414`, surface `#1A1D1F`, raised `#222628`, hairline `#2A2F31`, hairlineStrong `#3A4245`, accent `#5FA8B8`, accentDeep `#1E3A41`, signal `#D8A13B`, signalDeep `#241D0E`, danger `#D4757E`, textGhost `#6E7A78`
- [ ] Derive the `Hinata: Naruto` equivalents from its own lavender hues — same roles, contrast verified, not a copy of the dark hexes
- [ ] Migrate the nine files that import `FONT_FAMILY` directly to the theme token
- [ ] `npx tsc --noEmit` clean; both schemas render with no missing-token crash; schema switching in Profile still works

**Technical Notes:**
- `AllColorSchemas` is typed `Record<string, typeof LDeathNoteColors>`, so any key
  added to one schema must exist on the other or the build breaks
- Add role keys; do not rename or remove existing ones (`primary`, `secondary`,
  `cardBackground`, `button`, `tableHeader`, `collapsed`, …). Many screens read them
  and this ticket must stay non-breaking
- `TextBase.tsx:28` hardcodes `letterSpacing` 0.4 / 0.6, tuned for ComicRelief's wide
  metrics. Archivo at 0.6 reads loose, which is why letterSpacing becomes per-face
- Monospace digits align by construction. Do not rely on `fontVariant: ['tabular-nums']`,
  which is unreliable on Android
- `textGhost` is only ever used on large prefilled numerals, where 3:1 contrast is
  permitted. Never use it for body copy
- `danger` shipped as `#D4757E`, not the originally specified `#C9636C`. The spec hex
  measured 4.43:1 on `surface` and 3.99:1 on `raised`, below the 4.5:1 this ticket
  requires for text under 24px. `#D4757E` measures 5.36 / 5.85 / 4.83 against
  surface / ground / raised and is shared by both schemas
- The role keys are nested under `role` rather than added flat, because `accent`,
  `textPrimary` and `textSecondary` already exist flat with different values and ~90
  consumers. Note the consequence: `t.colors.accent` still compiles and still renders
  the legacy `#5A3E62`, so a mistyped token fails silently. Needs a follow-up — either
  a lint rule banning the flat three in new workout-flow files, or renaming them once
  their consumers are migrated
- Direct `FONT_FAMILY` importers: `components/TextBase.tsx`, `constants/toastConfig.tsx`,
  `components/SearchableInputDropdown.tsx`, `components/CompactTextSwitch.tsx`,
  `components/LoadingData.tsx`, `components/PrimaryInputField.tsx`,
  `screens/ProfileScreen.tsx`, `screens/auth/SignInScreen.tsx`, `screens/auth/SignUpScreen.tsx`
- Putting the family behind a theme token is what makes the deferred display-font
  selector cheap later. No selector UI in this ticket
- Screens may shift slightly because Archivo's metrics differ from ComicRelief's.
  Expected, and corrected from TICKET-017 onward

**Dependencies:** None. Blocks TICKET-017 through TICKET-022.

---

### ~~TICKET-016: Previous-Session Lookup for the Active Exercise~~ ✅ DONE

**Priority:** High | **Effort:** Medium | **Status: COMPLETED**

**Description:**
Nothing in the active workout flow could see what the user did last time. Add one
hook that answers, for the exercise being logged: what did I do last session set by
set, what were my last few sessions, what is my best set at each rep count, and how
has volume trended. Four later tickets read from it.

**What was done:**
- Re-keyed workout history from workout to **exercise**. The old
  `workout_logs/{workoutId}/logs/{logId}/exercises/{exerciseId}` tree could only
  answer "what did I do last time *in this plan*", so bench press in two plans was
  two histories with no way to join them. Storage is now
  `users/{uid}/sessions`, `users/{uid}/exercise_sessions` (canonical) and
  `users/{uid}/exercise_stats` (derived rollup)
- `useExerciseHistory(exerciseId)` returning `lastSession` addressable by set
  number, `sessions` (last 3, each naming the workout it was done in), `best`
  (all-time, per rep count), `volumeTrend` (last 6) and `loading`
- Session-lifetime cache keyed by exercise. `startWorkout` issues one batched
  prefetch for the whole plan; readers cannot fetch at all
- Replaced name-guessing with declared semantics: `Exercise.fields` is now
  `ExerciseField { name, role, unit? }`, set in Manage Workout
- Canonical exercise ids, so a typed "Bench Press" lands on the catalog's
  `bench_press` instead of shadowing it with `Bench_Press`
- No backfill: pre-launch, so `workout_logs` is abandoned in place

**Decisions pinned:**
- **best** = heaviest weight at equal reps, all-time, keyed per (reps, unit)
- **volume** = sum of weight x reps, **all or nothing**: one unparseable set yields
  null rather than a partial sum that would understate the session
- Units are reported, never converted. A kg session and an lb session of the same
  exercise are marked not comparable

**Deviations from the original plan:**
- Signature is `useExerciseHistory(exerciseId)`, not `(workoutId, exerciseId)`.
  Keying by workout would have reproduced the bug this ticket exists to fix;
  `lastSession.workoutName` carries the plan instead
- The field resolver was replaced by typed roles rather than built. Guessing
  semantics from user-authored strings degrades silently and cannot tell kg from lb
- Scope grew to UI. Changing `Exercise.fields` forced Manage Workout, the logger
  and the log tables. `EditableList` became `ExerciseFieldEditor`

**Files:** `types/{exerciseHistory,workoutSession,workoutType}.ts`,
`utils/{exerciseFields,exerciseStats,exerciseHistory}.ts`,
`services/db/workoutSessions.ts`, `stores/useExerciseHistoryStore.ts`,
`hooks/useExerciseHistory.ts`, `components/ExerciseFieldEditor.tsx`,
`scripts/{verifyHistoryReads,rebuildExerciseStats}.ts`, `firestore.indexes.json`

**Verification:** `npx tsx src/scripts/verifyHistoryReads.ts` — 77 checks, counting
reads at the Firestore boundary rather than asserting the cache works. Starting a
workout issues one fetch; 300 exercise reads and 100 logged sets issue zero.

**Operational:** one composite index, `exercise_sessions` on (exerciseId ASC,
performedAt DESC). `firestore.rules` is a proposal, never reconciled with the
console. Re-run `scripts/uploadExercises.ts` to put roles on the catalog; it drops
`"Sets"` from all 42 entries.

**Known gaps, deferred to the optimisation pass:**
- ~~Resuming a workout after an app restart does not prefetch — needs an auth-ready
  trigger, belongs with TICKET-017's resume path~~ Fixed in TICKET-017
- Firestore has no `persistentLocalCache`, so write promises never resolve offline
  and pending writes die with the app. Pre-existing
- The rollup only raises records; editing a set downward needs
  `scripts/rebuildExerciseStats.ts`. Ties into open decision 2 on `removeSet`
- `ExerciseHistoryDebugScreen` is temporary, kept until 018-022 build the real UI.
  Every piece is marked `TEMPORARY`; removal is four edits

**Dependencies:** None. Ran in parallel with TICKET-015. Unblocks 018, 019, 020, 021, 022.

---

### TICKET-017: Active Workout Shell — exercise pager, header, progress

**Priority:** High | **Effort:** Medium | **Status: OPEN**

**Description:**
Replace the exercise dropdown with a focused one-exercise-at-a-time pager: prev/next
controls plus horizontal swipe, workout name and elapsed time in the header, and a
segment bar showing position in the workout. Also moves the destructive Discard action
out of the main action row.

**Acceptance Criteria:**
- [ ] `ActiveWorkoutScreen` drops `SearchableInputDropdown` in favour of prev/next buttons and a swipeable pager
- [ ] Header shows workout name plus elapsed time derived from `activeWorkout.startTime`
- [ ] One progress segment per exercise; completed, current (partially filled by sets logged) and untouched states distinguished by lightness, not hue alone
- [ ] "Exercise N of M" always visible
- [ ] Add `setCurrentExerciseIndex` to `useWorkoutStore`
- [ ] Swiping or tapping prev/next updates `currentExerciseIndex`
- [ ] A `···` header menu holds Discard workout; `Finish workout` stays in the bottom bar as the only footer action
- [ ] Discard confirms before destroying the session
- [ ] Hit targets at least 44px
- [ ] Tour steps in `src/tour_steps/activeWorkout.ts` still resolve, or are updated to the new anchors

**Technical Notes:**
- `currentExerciseIndex` is currently written only as a side effect of logging a set
  (`useWorkoutStore.tsx:69` and `:99`), so today it means "last exercise I logged into",
  not "exercise I am viewing". The explicit setter is what separates those two meanings
- `ActiveWorkoutScreen` mirrors `activeWorkout` into local `selectedExercise` state via
  `useEffect`. With the store owning the index, that mirror should go
- Discard currently sits beside Save at equal weight in the footer button row, so an
  accidental tap loses the session
- One accent fill per screen: `Log set` owns it, so `Finish workout` is outlined

**Implementation notes (deviations and decisions):**
- **Progress fill has no denominator in the data model.** The ticket says "partially
  filled by sets logged", but nothing records a planned set count (`Exercise` is id,
  name, fields). Fill is `setsLogged / last session's set count` for the exercise, read
  from the history cache via `useExerciseHistory` (zero network reads). With no
  history it assumes `DEFAULT_TARGET_SETS` = 3. The first build drew one 3px tick per
  set instead, to avoid a guessed target; on device 2 sets read as ~3% progress, so
  the guess won. A real planned set count would be a new field on `Exercise`
- **"Done" means "not in view and at least one set logged"**, not "before the current
  index". A skipped exercise stays untouched; one logged out of order shows done.
  Definitions are pinned on `ProgressSegment` in `src/utils/workoutProgress.ts`
- **Swipe: gesture-handler `Fling`, no new dependency.** A discrete left/right fling
  changes the index; content swaps, it does not slide (no animation library). A fling
  does not compete with the vertical ScrollView or with 018's text inputs, which a
  tracked pan or a horizontal `FlatList` would. `react-native-pager-view` was rejected
  for now: best feel, but a native dependency for one screen whose content 018 is about
  to rebuild. Device-checked: the instant swap is accepted. A sliding pager is an
  optimisation, not ticketed; pick it up only if the swap becomes a real problem
- **`ExerciseLogger` is keyed by exercise id from the screen.** Pre-existing bug (the
  dropdown version had it too): typed-but-unlogged values survived an exercise switch
  and would be logged against the new exercise, since field names like "Reps" repeat.
  Keying from outside keeps the component's internals untouched; cost is that unlogged
  input is dropped on navigation
- **Resumed sessions now prefetch history** (closes TICKET-016's known gap).
  `loadWorkoutFromStorage` runs at app start, before `initAuth` has set the user, so a
  plain prefetch there would see no uid and do nothing. It prefetches immediately if
  the user is known, otherwise on the first user to appear, then stops watching.
  Rejected: fetching from the screen on mount, which breaks "screens never fetch" and
  makes the progress bar jump from the default target to the real one
- **Finish is guarded against a double tap** while `endWorkout` is in flight, which
  would otherwise save the session twice
- **`WorkoutNavigator.tsx` was not edited** (the brief assumed it would be), so
  `ExerciseHistoryDebugScreen` is left as is: still `TEMPORARY`, still reachable, removal
  stays with 018-022 as TICKET-016 planned
- Shell uses role tokens only. `ExerciseLogger` internals still use legacy flat
  tokens; those belong to 018, which rebuilds that card. Its hardcoded `#ddd` bottom
  border was removed here: a divider left over from the dropdown layout, separating nothing
- **Verification:** typecheck plus device testing during review. A throwaway local
  harness was used while building and then deleted; no committed test covers this
  ticket. TICKET-024, next after this one, adds a test runner and these tests

**Dependencies:** TICKET-015.

---

### TICKET-018: Set Logger Card with Ghost Targets

**Priority:** High | **Effort:** Medium | **Status: OPEN**

**Description:**
Rebuild the set input as the focal point of the screen: large numeric fields prefilled
with last session's values for this set index as ghost placeholders, coarse steppers so
the keyboard is optional, a one-tap repeat of last session's set, and a pill showing
where the target came from.

**Acceptance Criteria:**
- [ ] Replace `ExerciseLogger`'s plain `PrimaryInputField` row with large numeric fields (~62px tall, ~30px mono digits)
- [ ] Each field's placeholder is last session's value for the current set index, in `textGhost`
- [ ] Stepper buttons per field, step size appropriate to the field, 44px targets
- [ ] A "repeat last set" control fills every field from last session's matching set
- [ ] A `Last time — <weight> × <reps>` pill in the card header, which is the trigger for TICKET-020
- [ ] Works when the exercise has no history, and when its fields are not weight/reps
- [ ] Logging still calls `addSetToExercise` and clears the inputs
- [ ] Current set number shown, and advances after each logged set

**Technical Notes:**
- `exercise.fields` is a dynamic `string[]`, so the card lays out N fields rather than
  assuming two. Design the two-field case well and degrade predictably for 1, 3 or more
- `ExerciseLogger` holds `inputValues` as `Record<string, string>` and returns early when
  it is empty. With placeholders present, decide deliberately whether an untouched field
  means "log the ghost value" or "incomplete" — those are different products, pick one
  and state it in the PR
- Ghost text must never be mistaken for a logged value: placeholder, not value
- Steppers operate on a parsed number and write back a string, since `ExerciseSet.fields`
  is `Record<string, string | number>`
- Decide the input's visual boundary explicitly rather than inheriting it. With
  TICKET-015's tokens, `raised` vs `surface` is only a 1.11:1 fill step (1.12 in Hinata)
  and `hairlineStrong` vs `raised` is 1.49:1 (1.55 in Hinata), so these fields have no
  boundary meeting the 3:1 WCAG 1.4.11 asks of a control. The fill steps themselves are
  fine; it is specifically the input that needs either a stronger border token or an
  accent-bordered focus state carrying the affordance

**Dependencies:** TICKET-015, TICKET-016.

**Implementation decisions and deviations (branch `TICKET-018`):**
- Two technical notes above are stale: `exercise.fields` is `ExerciseField[]`
  since TICKET-016, and ghosts come from `useExerciseHistory().setAt(sets.length + 1)`
- An untouched field is **incomplete**, not "log the ghost". Log set refuses and
  names the missing fields; the repeat control is the explicit way to take the
  target. Fields with role `other` are optional and never block logging
- Deviation: "no ghost on unit mismatch" is decided by `lastSession.comparable`,
  not `history.unitMismatch`. The latter is true when any session in the window
  mismatched, and would hide a valid ghost from a same-unit last session
- Boundary: new `role.fieldEdge` token, ≥3:1 against `raised` and `surface` in
  both schemas (asserted in `colors.test.ts`). Not named `inputBorder`: a flat
  legacy key of that name exists with another value. Focus is 2px `accent`;
  accent is under 3:1 against `fieldEdge`, so the width change carries focus too
- Steppers: 2.5 kg, 5 lb, reps 1. Unitless weight, time, distance and other get
  no stepper. An empty field steps from its ghost (60 → 62.5 / 57.5); taking the
  ghost exactly is repeat's job. Steps that would go below 0 or start from
  unparseable text are disabled rather than writing 0
- Only weight and reps fields get a ghost; raw values of other roles are not
  shown as targets
- "Last time" pill is inert until TICKET-020: no button role, and the design's
  chevron is omitted so it offers no action that does nothing
- Repeat is hidden, not dimmed, when there is nothing to repeat: a dimmed
  icon-only button gave no reason, and the notice line already says why
- When there is no ghost the card says why: not loaded / loading / failed,
  first time, no weight+reps, different unit, or "last time stopped at N sets"

---

### TICKET-019: Today's Sets with Per-Set Deltas

**Priority:** High | **Effort:** Small-Medium | **Status: OPEN** (implemented on branch `TICKET-019`)

**Description:**
Make this session's sets permanently visible under the input card, each row carrying how
it compares with the same set last time, plus session volume against the previous session.
Replaces the collapsed log-history table.

**Acceptance Criteria:**
- [ ] Replace `ActiveExerciseLogHistory`'s `CollapsibleSection` + `CollapsibleTable` with an always-visible list of this session's sets for the current exercise
- [ ] Each row shows set number and logged values in mono digits
- [ ] Each row shows its delta against the same set index last session: improved, matched, or down
- [ ] Improvement and decline differ in lightness as well as hue, so the comparison does not depend on colour vision
- [ ] Footer shows set count and session volume, plus percentage against the previous session
- [ ] Renders correctly with no history, and with no sets logged yet
- [ ] Volume computed only from fields that actually parse as numbers

**Technical Notes:**
- `ActiveExerciseLogHistory` shows only the in-progress session and starts collapsed, so
  the data most needed mid-set takes a tap to reach. Always-visible is the point here
- `TableControls` column toggling is dropped for the active flow; it stays on
  `WorkoutLogsScreen`
- Volume only means something when weight and reps both parse. For other field shapes,
  show set count and omit volume rather than printing a meaningless number
- Blocked on open decision 2 at the top of this phase: with no `removeSet` in the store,
  a mistyped set cannot be corrected from this list

**Dependencies:** TICKET-015, TICKET-016.


**Implementation decisions and deviations (branch `TICKET-019`):**
- Four verdicts per set. `improved` / `down` from set volume (weight × reps);
  `even` when volume is equal but the numbers differ (60×10 → 50×12), labelled
  with both changes; `matched` only when weight and reps are both identical.
  When volume ties at a 0 factor (0 kg bodyweight), the dimension that moved
  decides. The label names what moved: "+1 rep", "+2.5 kg", or both,
  "+2.5 kg · −1 rep". Rejected: comparing weight and ignoring reps (calls
  67.5×8 an improvement on 65×12), and any composite score
- Colour: improved is `signal`; down, even and matched are `textSecondary`,
  told apart by glyph (caret down, equals bar, none) and text. **Measured:**
  signal is lighter than textSecondary by only 1.34:1 (L) / 1.27:1 (Hinata), so
  lightness by itself is a weak cue. The caret and the +/− sign carry the
  colour-blind case. `colors.test.ts` pins the direction and 4.5:1 on surface
- Deviation from "percentage against the previous session": compared with last
  session's **first N** sets while today has fewer sets, and full totals once
  today has as many. Today's running total against a finished session reads as
  −60% until the last set. The footer names its base: "vs first 2 sets" or
  "vs 26 Sep"
- Gating shares `resolveGhostTarget` with the card, so a row has a delta exactly
  when the card would have a ghost. Gated on `lastSession.comparable`, not
  `unitMismatch`. A past set with null weight or reps gets no delta, not 0
- Today's volume reads the live exercise's fields, not `history.numericFields`
- No volume line for an exercise with no weight+reps pair. "volume unavailable
  (N of M sets)" when a set does not parse, never a partial sum
- Open decision 2 resolved here: `removeSet` / `restoreSet` on the active
  workout. Committed at once to store and AsyncStorage; undo re-adds by
  position. Sets are renumbered 1..n, so `ExerciseSet.id` is now documented as
  an ordinal, not an identity. `RemovedSet` carries its `exerciseId` and
  `restoreSet` refuses a mismatch, so a wrong-exercise restore is impossible
  even if the logger stops being keyed by exercise (PR #10 review)
- Remove is a 44px × per row, not a swipe (it would fight the pager's
  horizontal fling). Undo is an inline row in the removed set's place, not a
  toast. One at a time. Cleared by logging a set, and by changing exercise or a
  successful Finish (both unmount the logger). A refused Finish keeps the undo,
  because nothing was saved
- The list is below the card. `LOG_HISTORY`'s tour step is re-anchored, and
  moved after Save set to match. `ActiveExerciseLogHistory` is deleted (its only
  caller was the logger); `TableControls` stays on `WorkoutLogsScreen`
---

### TICKET-020: Exercise History Sheet

**Priority:** Medium | **Effort:** Medium | **Status: OPEN**

**Description:**
A bottom sheet, opened from the "Last time" pill, holding the full comparison: pick one of
the last few sessions and see it set by set beside today's, plus the best set for this
exercise and a volume trend. Available during the exercise, never on screen by default.

**Acceptance Criteria:**
- [ ] Sheet opens from the pill in the set card and closes without leaving the active workout
- [ ] Session chips for the last 3 sessions with dates; selecting one switches the table
- [ ] Table aligns the selected session's sets against today's by set index
- [ ] Best set for this exercise shown distinctly
- [ ] Volume trend over the last several sessions
- [ ] Scrollable and usable at 390px width
- [ ] Empty state for an exercise with no history
- [ ] Logging is not blocked while the sheet is open; dismissing returns to the same set in progress

**Technical Notes:**
- Reads the same `useExerciseHistory(exerciseId)` data as 018 and 019. No new fetching
- This is the in-flow replacement for navigating to `WorkoutLogsScreen` mid-set. That
  screen stays as the full browser
- `WorkoutHistoricalLogsFilter` is not reused: its filter state is for browsing, not for a
  fixed exercise. TICKET-006 already flags it for decomposition
- Needs a real focus trap and a labelled close control, not just a tappable backdrop

**Dependencies:** TICKET-015, TICKET-016, TICKET-018.

**Implementation decisions and deviations (branch `TICKET-020`):**
- "Logging is not blocked while the sheet is open" is read as: dismissing returns
  to the same set with nothing lost. The sheet is a modal RN `Modal`
  (`animationType="slide"`), rendered as a sibling inside `ExerciseLogger`, so typed
  values, the set number and the Today list survive it. A `Modal` sits outside the
  pager's `GestureDetector`, so there is no fling conflict. No bottom-sheet library
- Deviation from the design board: the volume trend is a row of `View` bars, not a
  sparkline. A polyline needs `react-native-svg`, a native dependency and a
  dev-client rebuild. A null volume is a dashed empty slot, never a 0-height bar
- One delta vocabulary: every sheet delta comes from `setDelta`, with the selected
  session standing in as "last session". For the actual last session that is the
  Today list's exact call; `DeltaBadge` is extracted and shared by both
- Past sessions are read through their own `fields` (`sessionSets`), so a renamed
  field still shows its value, volume and delta in the sheet before TICKET-030
  fixes the hook. Consequence: after a rename the sheet can show a delta for the
  last session where the Today list shows none. Verdicts never disagree; the
  sheet only has more of them
- Comparability is per session (`session.comparable`), not `unitMismatch`. An
  incomparable session shows its numbers in its own unit, no deltas, and says
  "Logged in lb, today in kg, so not compared"
- The pill is always shown: "LAST TIME 65 × 8" with a target, "HISTORY" without.
  Shown only with a target, a first-time exercise, a plank or a unit change could
  never reach the sheet. Target is 44px through `hitSlop`; visual height stays 34
- "Best" = heaviest weight at one rep count: the reps of the set about to be
  logged when last session gives a target, else the heaviest record at any reps
  (ties to more reps, then more recent). Rejected: best volume set, estimated 1RM.
  The design's "Target" button on the best card is not built
- The trend is hidden while `unitMismatch` is set: `VolumePoint` carries no unit
  and the hook does not say which point is the other-unit one. Over-cautious when
  the mismatched session is outside the trend window; see known gaps
- No tour step for the sheet: the existing steps still resolve

**Known gaps:**
- `VolumePoint` has no unit, so the trend cannot drop just the incomparable point.
  Needs a rollup change: TICKET-036. Until then `HISTORY_TREND_SESSION_COUNT` must not
  exceed `STATS_RECENT_SESSION_CAP`; a comment and a test hold that
- Two sessions on the same day show identical chips: TICKET-037
- No drag-to-dismiss; close control, backdrop and Android back dismiss
- Untested on a device: slide animation, VoiceOver focus trap
  (`accessibilityViewIsModal`), safe-area padding, the table's horizontal scroll
  at narrow widths

---

### TICKET-030: Drop Unit Suffixes from Catalogue Field Names

**Priority:** Medium | **Effort:** Small | **Status: OPEN**

**Description:**
Catalogue exercises carry the unit twice: in the field name ("Weight (kg)") and in
`ExerciseField.unit`. TICKET-018's set card labels a field `name · unit`, so every catalogue
exercise reads **"WEIGHT (KG) · KG"**. Make `unit` the only home of the unit and rename the
catalogue fields to plain names, without losing the history already logged under the old ones.

**Acceptance Criteria:**
- [ ] Past sessions are read by role from their own field snapshot, so a renamed field keeps its history (see notes — this lands first)
- [ ] `src/scripts/uploadExercises.ts` field names carry no unit: "Weight (kg)" → "Weight", "Total Time (min)" → "Total Time", "Total Distance (m)" → "Total Distance"
- [ ] "Box Height (cm)" is decided explicitly: it is role `other` with no `unit` (and `FieldUnit` has no `cm`), so stripping the suffix would lose the unit entirely. Either keep the name or add `cm` to `FieldUnit`
- [ ] Re-upload run with `--dry-run` first and its output shown; the real upload is triggered by the user
- [ ] A test: a session logged as "Weight (kg)" still gives a ghost, volume and best when the exercise's field is now "Weight"
- [ ] The set card shows "WEIGHT · KG" for a newly added catalogue exercise

**Technical Notes:**
- Load-bearing: set values are keyed by field **name**, and `buildHistorySession`
  (`src/utils/exerciseHistory.ts`) parses every past session with the **current** field
  names (`numeric` comes from today's definition). After a rename, every earlier session's
  weight parses to `null` — no ghost, no volume — and nothing reports it. Fix by resolving
  the numeric pair from that session's own `entry.fields` (role-based, already stored per
  session) when the session is comparable. This also covers a user renaming a custom field
- Why it is silent (PR #9 review, confirmed with a probe): `areFieldsComparable` compares
  only the unit, so a renamed session stays `comparable: true` and `unitMismatch` false.
  `resolveGhostTarget` returns `available` with `weight: null, reps: 8`; the card shows a
  reps ghost, no weight ghost, no pill and no notice. None of TICKET-018's "say why" cases fire
- The read-side fix is real, not just a write-side guard: the probe's session snapshot still
  names "Weight (kg)", and `parseSet` with `resolveNumericFields(entry.fields)` returns
  `{ weight: 60, reps: 8 }`. It does not cover a set keyed by a name its own session's
  snapshot does not contain (a field renamed mid-workout); that is the write-side case
- Until this lands, the warning lives at the rename sites: `ExerciseField.name` in
  `workoutType.ts` and the catalogue in `uploadExercises.ts`
- `bestByReps` stores values, not names, so records survive the rename unaffected
- Plans copy an exercise's fields when it is added, so existing plans keep "Weight (kg)"
  until the exercise is re-added. Pre-launch: no migration or backfill of plans or sessions
- Do not strip suffixes in the label by matching on the name ("ends with (kg)"); that is
  inferring meaning from user-authored text. The data is what is wrong
- Found during TICKET-018 device testing

**Dependencies:** TICKET-016, TICKET-018.

---

### TICKET-031: Contrast Guards for the Rest of the Role Palette

**Priority:** Low | **Effort:** Small | **Status: OPEN**

**Description:**
TICKET-015's role palette was contrast-checked by hand across three reviews, and only
`fieldEdge` and `textGhost` are asserted (`src/constants/colors.test.ts`, TICKET-018). A
future token tweak can break any other pair silently. Extend the same `describe.each` over
`AllColorSchemas` so the checks stop living only in review comments.

**Acceptance Criteria:**
- [ ] `textPrimary` and `textSecondary` ≥ 4.5 on `ground`, `surface` and `raised`
- [ ] `ground` text on an `accent` fill (Log set) ≥ 4.5
- [ ] `signal` and `danger` ≥ 4.5 on `surface` (they carry small text: deltas, Discard)
- [ ] Each assertion states the rule (threshold and why) in a comment, not the measured number
- [ ] Each new assertion seen red with its token dimmed, then restored

**Technical Notes:**
- Measured at filing (L / Hinata), all passing: textSecondary on raised 4.94 / 5.12, on
  surface 5.49 / 5.72; ground on accent 6.85 / 8.15; signal on surface 7.33 / 7.24; danger
  on surface 5.36 / 5.30. textSecondary on raised has the least headroom
- Raised in PR #9 review

**Dependencies:** TICKET-015.

---

### TICKET-032: Edit or Delete a Set That Has Already Uploaded

**Priority:** Medium | **Effort:** Medium-Large | **Status: OPEN**

**Description:**
TICKET-019 lets a mistyped set be removed before Finish. After Finish, the set
is in `workout_sessions` and folded into `exercise_stats`, and there is no way
to correct it from the app.

**Why it matters:** `applyBest` is a strict max. A `650 kg` typo becomes a
`bestByReps` entry that no later real set displaces, and it feeds every future
ghost target, "last time" pill and volume trend for that exercise. Today the
only repair is running `rebuildExerciseStats.ts` by hand.

**Acceptance Criteria:**
- [ ] A logged set in a past session can be edited or deleted from history
- [ ] The exercise's `exercise_stats` rollup is rebuilt from its sessions after
      the change (`rebuildStatsFromSessions`), not patched incrementally:
      `bestByReps` cannot be decremented
- [ ] The cached history for that exercise is invalidated, so the set card
      stops ghosting the old value
- [ ] Offline behaviour decided: queue the edit, or refuse it while offline

Editing a set in the *active* workout, before Finish, is TICKET-040 — no rollup
involved there.

**Dependencies:** TICKET-019, TICKET-020 (the history sheet is where a past set
is visible).

---

### TICKET-035: Measures Beyond Weight × Reps — Time, Distance, and Which Way Is Better

**Priority:** Medium | **Effort:** Medium-Large | **Status: OPEN**

**Description:**
Every derived number in the workout flow comes from one derived pair,
`NumericFieldMap = { weight, reps }` (`resolveNumericFields`,
`src/utils/exerciseFields.ts`). An exercise without that pair gets `null` everywhere:
no ghost target, no per-set delta, no best, no volume. That is the correct absence
for today's model, but 8 catalogue exercises measure time or distance (6 timed, 2
weighted carries), and for them the workout flow shows nothing about last time.

TICKET-022 needed a last top set for a plank and added a one-off:
`bestOnFirstMeasuredField` in `src/utils/startWorkout.ts` takes the highest value of
the first time / distance / reps field and checks its unit by name match. It is
correct for the catalogue today, but it duplicates `areFieldsComparable` for one
field, and a second consumer must not copy it. This ticket replaces it with a shared
model.

**Load-bearing fact:** which direction is better cannot be read from the role. More
time is better on a plank and worse on a 5 km run; more distance is better on a
throw and meaningless on a fixed course. Inferring it from role or field name is the
guess CLAUDE.md 2.5 says to stop at. The definition needs to say it.

**Proposed shape** (settle first; the rest depends on it):

```ts
// ExerciseField (the definition, set by the catalogue or the user)
better?: "higher" | "lower";

// derived; replaces NumericFieldMap
type MeasureShape =
  | { kind: "load"; weight: ExerciseField; reps: ExerciseField }   // today's pair
  | { kind: "single"; field: ExerciseField; better: "higher" | "lower" }
  | null;                                                          // nothing measurable
```

Rejected: separate parallel `timeFields` / `distanceFields` objects. Combinations
exist (distance + time for a run, time + reps for an EMOM, weight + distance for
Farmer's Walk), and parallel objects multiply into special cases.

**Acceptance Criteria:**
- [ ] Decided and written down before any code:
      - where `better` comes from: catalogue defaults only, or also a control in
        the plan editor (new UI); and what a field without `better` means
        (recommend: no comparison, never a guessed direction)
      - weight + distance with no reps (Farmer's Walk, Sled Push): a `load` variant,
        or `single` on one field. Today TICKET-022's fallback shows the distance
        and ignores the weight, because distance is listed first
      - whether single-field exercises get logger deltas and ghosts
      - whether single-field exercises get stored bests (a new rollup entry next to
        `bestByReps`, and `rebuildExerciseStats` updated)
- [ ] One comparability check: units match on every field of the shape. It replaces
      `areFieldsComparable` and the name-match check in `bestOnFirstMeasuredField`
- [ ] `lastTopSet` (TICKET-022) uses `MeasureShape`; `single` honours `better`;
      `bestOnFirstMeasuredField` is deleted
- [ ] Whatever the decisions above include, delivered in stages that each typecheck
      and run (CLAUDE.md 3.4):
      1. types, resolver and `lastTopSet` (no visible change for `load`)
      2. logger: deltas (`setDeltas.ts`) and ghosts (`ghostValues`, `setLogger.ts`)
         for `single`
      3. rollup: single-field bests and their rebuild
- [ ] Pure tests: `better: "lower"` picks the lowest; no `better` gives no
      comparison; a unit change on a single field gives `unit_changed`; a `load`
      exercise behaves exactly as before. Each seen red

**Technical Notes:**
- Consumers of `NumericFieldMap` today, all weight × reps by construction: session
  and total volume (`exerciseStats.ts`), `bestByReps`, `setDeltas.ts`, `ghostValues`,
  `TodaySets.tsx`, `areFieldsComparable`, `lastTopSet`, `verifyHistoryReads.ts`
- Volume stays `load`-only. A sum of seconds or metres is not volume
- `MeasureShape` is derived, not stored. `better` is stored on the field definition
  and so on every session's field snapshot. The app is pre-launch, so no backfill
- Coordinate with TICKET-030: it changes history to read each session's fields by
  role from that session's own snapshot. The shape resolver should be the thing
  both use
- Raised in the PR #11 review (TICKET-022), when the plank top set showed "—"

**Dependencies:** TICKET-016, TICKET-022. Coordinate with TICKET-030.

---

### TICKET-036: Put a Unit on Volume Trend Points

**Priority:** Medium | **Effort:** Small-Medium | **Status: OPEN**

**Description:**
`VolumePoint` (and the stored `StatsVolumePoint`) carries a session's volume but not the
unit it was computed in. A reader cannot tell a kg session's volume from an lb session's,
so the history sheet hides the whole trend whenever `unitMismatch` is set. Store the unit
per point so only the other-unit points drop out.

**Acceptance Criteria:**
- [ ] `StatsVolumePoint` and `VolumePoint` carry the weight unit the volume was computed in
- [ ] `rebuildStatsFromSessions` and the incremental rollup write it
- [ ] The sheet's trend shows same-unit points and leaves a gap, with a reason, for the
      others, instead of hiding the trend
- [ ] A test: one lb session among five kg sessions shows five bars and one gap
- [ ] The invariant at `HISTORY_TREND_SESSION_COUNT` (must not exceed
      `STATS_RECENT_SESSION_CAP`) and its test are removed, since it no longer protects anything

**Technical Notes:**
- Today's suppression over-hides: `unitMismatch` scans `recentSessions` (cap 10), so a
  unit change in sessions 7–10 hides a trend whose six shown points are all one unit
- And it only works because 6 ≤ 10. Raise the trend window past 10 and a shown point can
  come from a session `unitMismatch` never scanned, mixing kg and lb bars with no notice.
  Guarded for now by a comment and a test (PR #12 review)
- Third appearance of the `unitMismatch`-versus-per-session class (018, 019, 020 all gate
  per session); the trend is the one consumer that structurally cannot
- Pre-launch: no backfill needed, rebuild the rollups

**Dependencies:** TICKET-020.

---

### TICKET-037: Tell Apart Two Sessions on the Same Day in the History Sheet

**Priority:** Medium | **Effort:** Small | **Status: OPEN**

**Description:**
The history sheet's chips are labelled with the date only, so two sessions on one day
show as two identical "16 Oct" chips. In a picker that is not cosmetic: the user cannot
tell which session they are selecting. Seen on the emulator during TICKET-020.

**Acceptance Criteria:**
- [ ] When two chips in the row share a date, each shows its time as well ("16 Oct · 18:05");
      otherwise the date alone, as now
- [ ] The chip's spoken label includes the time whenever the visible label does
- [ ] A test with two sessions on one day: the chips' labels differ

**Technical Notes:**
- Time only on collision keeps the common case short in a 3-chip row at 390px
- Format in local time, alongside `formatSessionDate` in `setDeltas.ts`
- If the times also collide (a re-saved session), fall back to the workout name

**Dependencies:** TICKET-020.

---

### TICKET-038: Per-Exercise Rest Duration, and a Control to Set It

**Priority:** Low | **Effort:** Medium | **Status: OPEN**

**Description:**
TICKET-021 shipped one global rest duration (default 1:30). Squats and curls want different
rests. Let an exercise carry its own, falling back to the global, and give the user a way to
set both — 021 has no settings UI, so the global value is the default until this lands.

**Acceptance Criteria:**
- [ ] Optional `restSeconds` on `Exercise`, carried onto `LoggedExercise`; missing means the
      global preference
- [ ] A control to set the global duration (`restPreferenceStore.setRestDurationMs`, already
      persisted and range-checked), and one per exercise in `ExerciseFieldEditor` or the plan
- [ ] `ExerciseLogger.logSet` starts the rest with the exercise's value when present
- [ ] Test: an exercise with its own duration rests for it; one without rests for the global

**Technical Notes:**
- Recorded as 021's open decision 1. Adding the field later costs nothing: absent falls back,
  so no migration — unlike `WorkoutSessionDoc.volume`, which had to be decided up front
- Touches the catalogue seed if catalogue exercises get defaults; optional otherwise

**Dependencies:** TICKET-021.

---

### TICKET-039: Decide Whether the PR Banner Rewards Rep Progression

**Priority:** Low | **Effort:** Small (decision) + Medium (build) | **Status: OPEN**

**Description:**
TICKET-021's banner compares against the heaviest weight at the *same* rep count, so a
user who progresses by adding reps (65 × 8 → 65 × 10) never sees one: there is no 10-rep
record to beat. Decide whether the banner should cover that, and with which record.

**Acceptance Criteria:**
- [ ] A decision recorded here: rep PRs (most reps at a weight), a volume or estimated-1RM
      record, or "weight at equal reps only" kept on purpose
- [ ] If a new record is chosen: computed in the rollup next to `bestByReps`, one definition
      shared by the banner and the history sheet, with its own banner copy
- [ ] Tests for the chosen record's degenerate cases (ties, unit change, bodyweight 0 kg)

**Technical Notes:**
- Do not fall back to "heaviest at any reps": it calls 65 × 10 a loss to 70 × 8
- The sheet's `sheetBest` pins "best" today; a second record must not let the sheet and
  the banner disagree about one set (the reason `DeltaBadge` exists)
- Raised in the PR #14 review

**Dependencies:** TICKET-021.

---

### ~~TICKET-040: Edit a Set in the Active Workout, Before Finish~~ ✅ DONE

**Priority:** Medium | **Effort:** Small-Medium | **Status: DONE** — merged in PR #16;
device run still owed (see Pending Work → verification owed)

**Description:**
A mistyped set (56 for 65) can today only be removed and re-logged. Let the user correct
a logged set in place, from the Today list, while the workout is still active. Editing a
set that has already *uploaded* is TICKET-032, not this ticket: that needs the rollup
rebuild.

**Why edit, not remove + re-log + reorder** (decided before this ticket):
every set comparison — ids, `setAt`, ghosts, deltas — is positional (`ExerciseSet.id` is
an ordinal, `src/types/zustandWorkoutType.ts`). Edit never moves a set. Re-log would
start a rest (`ExerciseLogger` `logSet` → `startRest`), drop the TICKET-034 effort mark,
and need a new `moveSet` action plus reorder UI (no drag library is installed).

**Triage:** Tier 1 + 2. No stored shape changes and nothing else reads its output, but it
has design choices. Tier 3 skipped: nothing to measure end to end, and the user can judge
it by using the app.

**Acceptance Criteria:**
- [x] "Edit" in the row strip TodaySets already opens (TICKET-034), beside Easy / Hard
- [x] The card switches to edit mode: "EDIT SET N", inputs prefilled with that set's
      values, "Save set N" and Cancel. Same missing/empty-field refusals as logging
- [x] Save *replaces* the set's fields; clearing an optional field clears it
- [x] Saving does not start, restart or end a rest, and does not move the set or drop its
      effort mark
- [x] Deltas, the Today volume and the PR banner re-derive from the edited values
- [x] An open edit cannot land on a different set after a remove or Undo
- [x] A pending Undo row survives an edit

**Verified before design (CLAUDE.md 2.1):**
1. `updateSet` (`src/stores/useWorkoutStore.tsx`) has no caller and no test (grep: only
   its definition and a comment on `ExerciseSet.id`). It *merges* —
   `{ ...set.fields, ...updatedFields }` — so a field left out keeps its old value; an
   optional field cleared in the form would survive the edit. **Decision: replace.** The
   form holds every field, so its output is the whole set.
2. `updateSet` writes `currentExerciseIndex` and `lastUpdated`. **Decision:** drop the
   `currentExerciseIndex` write, as `removeSet` does — editing is not logging, and the row
   is only reachable on the exercise on screen. Keep `lastUpdated`: it "tracks logged
   data", and `removeSet` / `restoreSet` bump it too. (Nothing in `src/` reads it today.)
3. What an edit leaves alone: `id`/position (replace `fields` only), `effort` (spread the
   set), `rest` (no rest call), the pending `removed` (not cleared, unlike `logSet`).
   Ordinal hazard: `ExerciseLogger` is keyed by exercise id (`ActiveWorkoutScreen`), so a
   swipe unmounts it and drops the edit. Logging is impossible while editing (the card is
   in edit mode). Remove and Undo are the two that would renumber under an open edit.

**Design** (canvas boards 9–12, `design/workout-flow/project/Edit*.dc.html`):
- **Entry: board 9b (chosen).** The row strip becomes three equal buttons, Easy / Hard /
  Edit. Clear is dropped: tapping the chosen mark already clears it (`toggleEffort`,
  TICKET-034), and a one-line hint says so. Rejected: board 9 (Edit added beside
  Easy / Hard / Clear, four controls, cluttered) and board 9c (no strip; the row opens the
  edit card with the mark inside: one place for everything, but changing only a mark
  becomes tap, tap, Save, and it replaces 034's shipped strip).
- **Board 10.** Edit mode: accent border and header, a line "Logged 56 × 10 · mark and
  position stay". Ghosts and the Last-time pill are last session's set N, not the next
  set. The repeat button gives way to Cancel. The in-progress draft for the next set is
  kept separately and comes back after Save or Cancel.
- **While editing, the Today list is read-only:** no ×, no strip, and a pending Undo row
  reads "Undo after this edit" instead of offering Undo. Chosen over "remove/undo cancels
  the edit" (silently drops what was typed) and over "the edit follows its set through a
  renumber" (more state for a rare path). The removal is still undoable after.
- **Board 11.** During a rest the edit card takes the rest panel's slot; the rest keeps
  counting ("Rest keeps running · 0:58 left"). Refusals read "Enter Weight to save set 4".
- **Rest during an edit.** The rest is stored as `startedAt` + `durationMs` and every
  countdown is derived from the clock, so the edit only hides the panel: nothing calls
  `startRest` / `endRest` / `addRestTime`. Save or Cancel with 20 s left shows the panel
  at 0:20, still counting. If the rest runs out mid-edit, the card's line reads "Rest
  done" and the panel comes back as REST DONE / Next set, which stays until tapped
  (TICKET-021's rule). The card's line uses `restCountdown`, the panel's own derivation,
  so the two cannot disagree. No alert at rest end: `expo-notifications` is not installed.
- **Board 12.** Save returns to the rest; banner, delta and volume re-derive; the H mark
  and the set's position stay.

**Technical Notes:**
- Validation and field-building move out of `logSet` into one pure function in
  `src/utils/setLogger.ts`, used by both log and save, not copied.
  `missingFieldsMessage` takes the verb ("log" / "save").
- Tests, few: save replaces values; clearing an optional field clears it; mark and
  position survive an edit; an open edit cannot land on a different set after
  remove/Undo.

**Deviation from TICKET-034:** the strip's Clear button is gone (board 9b). Tapping the
chosen mark again still clears it; a hint line says so once a set is marked.

**Built** (decisions also in code comments at each site):
- `buildSetFields` / `editInputValues` (`src/utils/setLogger.ts`): one builder for Log
  set and Save set; `missingFieldsMessage` takes the verb. `logSet` now uses it.
- `updateSet` (`src/stores/useWorkoutStore.tsx`): replaces fields, keeps id and mark, no
  `currentExerciseIndex` write, no-op for a missing set.
- `TodaySets`: Easy / Hard / Edit strip; read-only list while `editingSetId` is set.
- `ExerciseLogger`: edit mode on the card, edit values held apart from the next set's.
- `EditRestLine` (new): the card's rest line. `useNow` moved out of `RestPanel` into
  `src/hooks/useNow.ts` so both read the same clock.

**Verified:** typecheck clean; 180 unit tests pass in each of 3 full runs (173 before;
the PR #15 flake did not show). 7 new, each seen failing against a deliberate break of the
line it covers: `buildSetFields` leaves a blanked optional out / refuses with the action's
verb; `updateSet` replaces, keeps id and mark, leaves `currentExerciseIndex`; card edit
saves in place with mark, position, no rest and the next set's typing back; clearing an
optional field in the edit clears it; read-only list while editing so the edit lands on
its own set and Undo works after; during a rest the card takes the panel's slot, the
stored rest is the same object after Save, refusals say "save".

**Unverified (device run owed):**
- Layout at phone width: the three-button strip and its hint, the Editing label, the
  Cancel/Save row, the rest line.
- The rest line ticking live and switching to "Rest done" mid-edit (unit-tested only
  through `restCountdown`; the switch itself is not tested).
- The guided tour over the card in edit mode (tour steps wrap the same fields and button).

**Known gaps (accepted):**
- Finish with an edit open saves what is stored; the unsaved edit is dropped, like a
  half-typed next set today.
- Swiping to another exercise drops an open edit.
- A failed storage write on Save leaves the edit open but surfaces as an unhandled
  rejection, like `setSetEffort` and `removeSet` today (TICKET-004).

**Dependencies:** TICKET-019, TICKET-021, TICKET-034 (the row strip).

---

### TICKET-021: Rest Timer, Personal-Best Banner, Next-Set Target

**Priority:** Medium | **Effort:** Medium | **Status: IN PROGRESS** — built on branch `TICKET-021`, awaiting device run

**Description:**
After a set is logged, the input card gives way to a rest countdown with the next set's
target already shown, and a set that beats the user's previous best is called out.

**Acceptance Criteria:**
- [ ] Rest timer state in `useWorkoutStore`, started when a set is logged
- [ ] Countdown with add-time and skip controls
- [ ] Timer survives navigating away and back, computed from a timestamp rather than a tick counter
- [ ] Next set's target from last session shown beneath the timer
- [ ] A set that beats the stored best for its rep count shows a banner naming what was beaten
- [ ] Timer and banner both render correctly for an exercise with no history
- [ ] Implement the chosen answers to open decisions 1 and 3 at the top of this phase

**Technical Notes:**
- Timestamp-based, not interval-based: an interval stops when the JS thread is suspended,
  and the remaining time will be wrong on return
- Personal-best comparison uses `best` from `useExerciseHistory`. "Best" needs a
  definition — heaviest at equal reps is what the design assumes
- The banner is a signal, not a celebration. It shares `signal` / `signalDeep` with the row
  deltas so the vocabulary stays one thing
- Overlaps TICKET-011 (active workout indicator) if the timer should be visible outside this
  screen. Decide before building; do not build both

**Dependencies:** TICKET-015, TICKET-016, TICKET-018.

**Implementation decisions and deviations (branch `TICKET-021`):**
- Open decision 1: one global duration, `restPreferenceStore` (zustand + AsyncStorage,
  `colorSchemaStore`'s shape), default 1:30, range 5 s–30 min. Not in `useWorkoutStore`:
  it is a preference. Per exercise is TICKET-038. **No UI sets it yet** — see gaps
- Open decision 3: resume from timestamp only. `useWorkoutStore.rest` holds
  `{ exerciseId, startedAt, durationMs }`; `restCountdown` derives what is left from
  `Date.now()` on each render. The 500 ms interval only re-renders and holds no count.
  `expo-keep-awake` not used
- The running rest is in `useWorkoutStore` (the AC) but memory only, not AsyncStorage:
  it survives navigation and backgrounding, not the OS killing the app. After a kill
  the workout resumes on the card with nothing logged lost
- The timer replaces the card, as designed. Skip is the filled control, one tap, no
  confirm; `+30s` is outlined. `RestPanel` takes the card's slot inside
  `ExerciseLogger`, so typed values, the undo row and the Today list are not remounted
- The rest shows only on the exercise that started it. Another exercise shows its card
  (a superset is not blocked); coming back shows the same rest, still counting
- A rest that ran out stays on screen as "Rest done" / "Next set" until tapped, so
  coming back from the background shows done, not a vanished timer
- Clock moved backwards reads **done**, not 0 elapsed (`formatElapsed`'s choice): for a
  countdown, 0 elapsed would show the full rest again and withhold the card for as
  long as the clock moved. Add-time on a finished rest adds 30 s from now
- **PR rule, not in the original AC:** the bar is `max(bestAtReps(reps), today's
  heaviest at those reps before this set)`, strictly greater. The rollup only moves on
  Finish, so against the stored best alone the second set of a PR session is
  announced even when worse. "Best" is `bestAtReps`, the same record `sheetBest` uses,
  not a second definition
- **No stored record at those reps → no banner**, even if the set beats an earlier set
  today. Otherwise every heavier set of a first-ever session is announced. The brief
  listed "today's best only" as a case; this is the reading taken
- The banner is for the last set in today's list; removing it while resting re-derives
  for the new last one
- Next-set target and its absence reasons are `resolveGhostTarget` / `ghostNotice`, the
  card's own calls. The row opens the history sheet
- Cross-screen timer: not built, left to TICKET-011

**Known gaps:**
- No control to change the rest duration: TICKET-038. Until then everyone rests 1:30
  plus add-time
- A finished workout still in the upload queue is absent from `best`, so the next
  session can re-announce its PRs. TICKET-028's accepted gap, not reopened
- Rep progression is never bannered. `best` is per exact rep count, so 65 × 10
  against an 8-rep record of 65 is `noRecord`. Follows from "heaviest at equal reps"
  (020's definition, deliberately reused); the Today list still shows `+2 reps` in
  gold. Falling back to "heaviest at any reps" is worse (65 × 10 would "beat"
  70 × 8). A rep or volume record is a product decision: TICKET-039
- The tour's log-fields and log-button steps are not on screen while resting; the tour
  runs before the first set, so untouched
- Viewed on the Android emulator (PR #14 review): panel replaces the card, Skip
  prominent, `+30s` extends, rest done after backgrounding past its end, survives
  navigating to Profile and back, banner with stored and "set 1 today" copy, no
  banner on a worse set, both schemas legible, Skip and `+30s` measured 47dp
- Untested: screen lock on hardware, iOS, VoiceOver reading of the countdown (no
  live region, so it is not announced each second)

---

### TICKET-022: Start Workout Redesign and Resume Banner

**Priority:** High | **Effort:** Medium | **Status: IN PROGRESS** — built on branch `TICKET-022`, awaiting device run

**Description:**
Rebuild the plan picker so a plan can be judged before it is started — exercise count, when
it was last done, recent volume — and expand the selected plan to show each exercise's last
top set. Replace the modal alert that fires when a workout is already running with an inline
resume banner.

**Acceptance Criteria:**
- [x] Plan cards become rows showing name, exercise count, time since last performed, and recent volume
- [x] Selecting a plan expands it to list its exercises with each one's last top set
- [ ] A trend indicator per plan — **deferred**, see Decisions
- [x] Search still filters plans
- [x] The blocking `AlertBase` on mount is replaced by an inline banner naming the in-progress workout, its elapsed time and sets logged, with Resume and Discard
- [x] Discard from the banner confirms first
- [x] Primary action is a single bottom-bar button naming the plan being started
- [x] Empty state for a user with no plans
- [x] Tour steps in `src/tour_steps/startWorkout.ts` still resolve, or are updated

**Technical Notes:**
- `StartWorkoutScreen.tsx:19` sets `showAlert` from `activeWorkout` in a mount-time
  `useEffect`, so the user is met by a modal before seeing the screen. The banner carries the
  same information without the interruption
- Per-exercise last top sets for a whole plan means history for every exercise in it. Batch
  through TICKET-016's cache rather than one fetch per row. `prefetchExerciseHistory`
  takes a list of exercise ids and batches them into one query
- The list currently reflows between 2-column grid and horizontal when a plan is selected
  (`numColumns` keyed off `selectedWorkout`), which remounts it. Rows avoid that entirely
- Overlaps TICKET-011 (active workout indicator): the banner is the in-screen case, the
  indicator is the cross-screen case. Same state, so decide the split once

**Dependencies:** TICKET-015, TICKET-016.

**Decisions pinned:**
- **Session volume is stored**, as `WorkoutSessionDoc.volume: SessionTotalVolume`,
  computed in `buildSessionDocs`. Aggregating exercise stats on read would cost
  one read per exercise per plan; adding the field after launch would mean migrating
  every session. Pre-launch, it is free
- ~~**Mixed units null the total**~~ **Superseded by TICKET-044 (user, 2026-10-24):**
  one total per weight unit (`SessionTotalVolume.totals`), "1,955 kg · 115 plates".
  Once plates existed, nulling any mix hid the volume of most plans
- **An exercise with no weight+reps pair is excluded, not treated as a failure.** Under
  strict all-or-nothing, any plan with a plank would never show a volume. Counted
  in `exercisesTotal` and not in `exercisesWeighted`, and the row shows "1 not weighted"
- **One unparseable lift nulls the total** (`"unparseable"`), with counts alongside
  ("2 of 3 lifts readable"). Precedence when several apply: no weighted lifts,
  then unparseable
- **last done** = the newest session of the plan, from one recent-sessions query
  (20) plus this user's pending uploads. Joined on `workoutId` and compared on
  start time on both sides. On a tie the uploaded copy wins. The volume always
  comes from the same session as the date. If the sessions query fails, no plan
  shows a date, pending included. A pending date gets a "not uploaded yet" label
- **last top set** = the heaviest weight in the last session, ties going to more
  reps. An exercise without a weight+reps pair (a plank in minutes, reps-only
  burpees) shows its highest value on its first measured field instead, e.g.
  `1.5 min`. A session in a different unit than today's definition shows "unit
  changed". This needed `ExerciseHistorySession.fields` (the session's own field
  snapshot); the addition is additive, and `buildHistorySession` is its only producer
- **Selection is derived**: a plan hidden by the search is not selected. It is not
  cleared by remount or an effect, but it is cleared explicitly after Start
- **`startWorkout` refuses while any workout is in progress** (PR #11 review), the
  same plan included, and returns `{ status: "refused", reason }`. It overwrote
  `activeWorkout` unconditionally, so a press past the disabled button deleted every
  logged set. The screen keeps its disabled button and explanation; the store is
  what stops the data loss, for every entry point

**Deviations:**
- Trend indicator deferred. The stored field now makes it possible, but plan
  composition drifts between sessions ("volume up" can mean an exercise was added),
  and most plans have fewer than 2 points in the 20-session window
- Pending uploads count toward last-done. Not in the original ticket: without them,
  a workout finished offline yesterday reads "8 days ago"
- Banner adds Discard next to Resume (the design board shows Resume only), and both
  are 44px (the board's 38px is under the target)
- `START_WOURKOUT` misspelling left as is: `MANAGE_WOURKOUT` has the same typo, and
  renaming one of them would be a half fix

**Files:** `types/workoutSession.ts`, `utils/{exerciseStats,startWorkout}.ts`,
`hooks/useRecentSessions.ts`, `components/start_workout/{PlanRow,ResumeBanner,PartsText}.tsx`,
`screens/workout_management/StartWorkoutScreen.tsx`, `tour_steps/startWorkout.ts`,
`components/active_workout/DiscardWorkoutDialog.tsx` (shared with the active workout),
`stores/useWorkoutStore.tsx`

**Verification:** 16 pure tests (`utils/startWorkout.test.ts`), 5 screen tests and
1 store test (`startWorkout` refusal); 116 in the suite. The PR #11 review's mutation
run found 2 survivors in what this work first claimed was fully mutated: the
`blockedBy` guard (now backed by the store refusal and its test, seen red with the
check removed) and the uploaded-wins tie clause (redundant by loop order, now labelled
as such in the code). The screen-level guard itself is still untested: the disabled
button makes it unreachable from a press. Opening the screen issues one
`getWorkoutSessions` and no history read; selecting a plan issues one
`getExerciseStats` for its exercises. Untested: a real Firestore write of the new
field, and either schema on a device.

---

### TICKET-023: Guided Tour — Explicit Press-to-Continue Steps and Full-Width Targets

**Priority:** Medium | **Effort:** Medium | **Status: OPEN** — after Phase 3 work is done

**Description:**
Tour steps that say "tap/press this button" should wait for that button to be pressed
instead of offering Next. Today the tour has no field for this. It infers "wait" from
the next step not being registered yet (`TourStepOverlay.tsx`, `isNextStepDefinedButMissing`),
and any `TouchableOpacityBase` press anywhere advances it (`buttonPressed`). Both are
guesses that hold only in the screen layouts they were written against.

**Two device reports this must fix (found during TICKET-017):**
- "Explore Workout Options" (footer Workout tab, seen from Manage Workout) offers Next.
  Workout home is still mounted under Manage Workout, so its next step counts as present
- "Begin Workout" offers Next. The Log Workout tab's step stayed registered after an
  earlier workout ended: `MultiTourSteps` registers on mount and never unregisters

**Tried and reverted in TICKET-017:** registering a step only while its screen is
focused (`useIsFocused` in `MultiTourSteps`) and unregistering on blur/unmount. It
introduced another bug on device and was removed; the regression was not captured in
detail. Any unregister-on-unmount/blur approach in the patch below needs the same
device scrutiny.

**Already in TICKET-017:** three tour-wrapped buttons (Save Set, Finish workout, `···`)
got an unstyled `View` between the wrapper and the touchable to dodge the style-split
bug below.

**What remains (this ticket):**
- [ ] Fix both device reports above
- [ ] `waitForPress` on step definitions; overlay hides Next and shows "Tap the highlighted
      button to continue" on those steps
- [ ] Advance only when the highlighted element is pressed, not on any
      `TouchableOpacityBase` press; no double advance where both fire
- [ ] Mark the navigation-handoff steps: footer Workout tab (manage and start chains),
      Log Workout tab, Add/Update, Start a Workout, Begin, header Home and Profile.
      Leave in-place actions (Save Set, Finish, Save Workout) and Feed with Next
- [ ] Decide the search box and the dropdown New button (reveal, not navigate) explicitly
- [ ] Fix the `MultiTourSteps` style split at the source: it moves background, padding,
      border and `justifyContent` (plus a copy of `alignItems`) to an outer measuring View,
      so a wrapped touchable shrinks to its content and off-centre taps miss. 63 call sites;
      then remove the three `View` workarounds from TICKET-017
- [ ] Device-test the full tour on both chains, including a waiting step where an
      unrelated button is tapped (must not advance)

**Reference implementation — `docs/patches/tour-wait-for-press.patch`:**
A complete first pass written during TICKET-017 and shelved as too large for that ticket.
Covers `waitForPress`, press-only advance, the step marks, and unregister-on-unmount;
not the style split, not device-tested. Applies cleanly on the TICKET-017 branch head:
`git apply docs/patches/tour-wait-for-press.patch`. Design notes:
- Press detection uses `onTouchStart`/`onTouchEnd` on the measuring View (raw touch events
  bubble from children) with a 10px slop, so it works for any wrapped element without
  replacing its `onPress`. Unverified on device that the events bubble as expected
- Advance is delayed 500ms like `TouchableOpacityBase`, so the screen a press navigates to
  can mount the next step first; re-checks the current step so a double tap advances once
- `buttonPressed` returns early on a `waitForPress` step to avoid a second advance
- Unregisters a step when its element unmounts (ref-checked so a newer instance keeps its
  registration). Untested on device; see the reverted focus attempt above

**Dependencies:** TICKET-017.

---

### TICKET-024: Test Runner — Set Up Jest and Write the Example Tests

**Priority:** High | **Effort:** Small-Medium | **Status: IN REVIEW** — next, ahead of TICKET-018

**Description:**
The repo had no test runner; TICKET-016 and TICKET-017 verified with hand-rolled
scripts instead. Set up Jest so tests are cheap to write, then write one screen's tests
as the worked example that 018-022 copy. Not "test every screen": the point is the
harness plus a pattern, proven on real code.

**Acceptance Criteria:**
- [x] `jest`, `jest-expo` ~52, `@types/jest`, `@testing-library/react-native`,
      `react-test-renderer` 18.3.1 (exact) as dev dependencies; `jest.config.js` on the
      `jest-expo` preset with the gesture-handler and AsyncStorage mocks the libraries
      ship; `babel.config.js` with `babel-preset-expo`; `npm test` and `npm run test:watch`
- [x] One render helper, `src/test/renderScreen.tsx`: theme and tour providers, a real
      navigator, store reset plus seeding (auth `initialized: true`, workout, history),
      and per-test replacement of store actions
- [x] Logic tests for `src/utils/workoutProgress.ts`, written first as the runner smoke
      test: current-segment fill with and without history, the cap at 1, `targetSource`,
      `clampExerciseIndex` at both ends and the empty workout, `formatElapsed` across the
      hour and from a future start
- [x] Five `ActiveWorkoutScreen` tests: next then previous returns and the store index
      follows; arrows disabled at each end via `accessibilityState`; back with nothing
      behind opens the Workout tab (the TICKET-017 `WorkoutHome` bug); Discard deletes
      only after the confirmation's Discard; a second Finish tap while saving does not
      call `endWorkout` again
- [x] `src/test/README.md`: where files go, how to render a screen, what to seed
- [x] `npm test` passes from a clean `npm ci`; `npx tsc --noEmit` clean with the test
      files present (and proven to typecheck them)
- [x] Every logic test seen to fail (7/7). Screen tests: 4/5 seen red on a regression
      of their own guard; the Finish test goes red only when the busy flag is never set
      or all three of its guards are removed (see Verification). Its same-frame race is
      uncovered and fails today: TICKET-027

**Decisions pinned:**
- **Navigation is real, not a fake object.** The screen is the only route on a real
  stack; every other route is a stub rendering its own path. Back is asserted by where
  it lands (`route:Workout/WorkoutHome`), not by the arguments passed to `navigate`
- **Store actions that reach Firestore are replaced per test** (`workoutActions`), not
  Firebase. Everything else runs for real, including `setCurrentExerciseIndex` and
  AsyncStorage through the library's mock
- **Fake timers in every test file.** A stack card's open animation ends on a timer
  that otherwise fires after the test returns, outside `act()`

**Deviations from the original plan:**
- **Firebase's init module is replaced, despite "do not mock Firebase".** That
  instruction was about `useAuthUser` initialising auth during render, which seeding
  `initialized: true` handles. It did not cover import time:
  `services/firebase/firebase.ts` calls `initializeAuth` on import, and under Jest the
  config is empty, so importing any store threw `auth/invalid-api-key` before a test
  ran. Only that module is replaced; the SDK still loads, and the replacement's handles
  throw "Test reached Firebase …" on first use, so nothing can pass by touching it
- **`AppControlProvider` is left out of the helper's provider stack.** Nothing calls
  `useAppControl`, and its mount effect runs `loadWorkoutFromStorage()`, which would
  race the seeded workout
- **`expo-font` reports fonts as loaded.** jest-expo 52's native mock returns undefined
  from `getLoadedFonts`, which crashed every icon
- `@testing-library/react-native` is 13.x, not the current 14, which needs React 19
- Firebase is added to the preset's `transformIgnorePatterns`, plus a `.mjs` transform;
  the pattern is copied from jest-expo and has to be kept in sync by hand

**Files:** `babel.config.js`, `jest.config.js`, `src/test/{jest.setup.ts,renderScreen.tsx,
fixtures.ts,README.md}`, `src/utils/workoutProgress.test.ts`,
`src/screens/workout_management/ActiveWorkoutScreen.test.tsx`

**Verification:**
- 12 tests (7 logic, 5 screen), 0 console warnings, ~2 s warm
- Mutation runs, one regression at a time, each red on the assertion it names unless
  stated:
  - Logic tests: 7/7 red
  - Screen tests 1-4 (paging, arrows, back, discard): red
  - Finish test: Finish has **three** guards, `if (finishing) return`,
    `disabled={finishing}`, and `accessibilityState.disabled`, which
    `TouchableOpacity` also reads as disabled (RN `TouchableOpacity.js:141-144`).
    Removing any one or two leaves the test green; removing all three, or deleting
    `setFinishing(true)` which feeds them all, turns it red. It pins "a second tap
    after a re-render is ignored", not any single guard
- Two Finish taps inside one frame (both presses in one `act()`) call `endWorkout`
  **twice**. All three guards read `finishing` from the last render, so none can stop
  it, including the in-handler check that exists for exactly this race. Present
  since TICKET-017 (`dbaa0a0`); fix belongs in the store, TICKET-027
- A sixth screen test (a logged set lands on the exercise in view) was written and
  passed with no new mocking, then removed
- `babel.config.js` changes nothing for the app: `expo export --platform android
  --no-bytecode` produces a byte-identical bundle with and without it

**Known gaps:**
- The helper's `history` option seeds the cache but no test reads it back through a
  screen: nothing on `ActiveWorkoutScreen` exposes history except the progress fill,
  which is layout. TICKET-018 is its first consumer and should add a stats-doc builder
  to `fixtures.ts` then
- `renderScreen` only places the screen with nothing behind it. The canGoBack-true
  path (opened from the Workout stack) is untested; add a `behind` option when a
  test needs it
- Not ported: `src/scripts/verifyHistoryReads.ts` (77 checks). It works; move it when
  a ticket next touches the history layer

**Dependencies:** TICKET-017.

---

### TICKET-025: Footer Highlight Follows the Current Screen

**Priority:** Low | **Effort:** Small | **Status: OPEN**

**Description:**
The footer highlights the last tab TAPPED, not the screen being shown. `LayoutScreen`
keeps `activeTab` in local state and updates it only in `onChangeTab` (footer) and
`onPressTab` (header). Any other navigation leaves it stale: Workout → Start → begin a
workout lands on the active workout screen with "Workout" still highlighted; the
active workout's back button (TICKET-017) can open the Workout tab with "Log Workout"
still highlighted. Pre-existing; surfaced while testing TICKET-017.

**Acceptance Criteria:**
- [ ] The highlighted tab is derived from navigation state (the focused Layout route),
      not stored separately, so every navigation path updates it
- [ ] Entering the active workout from the Workout stack highlights "Log Workout", or
      the rule for which tab owns that screen is decided and written down — it is
      registered in both the Layout and Workout stacks
- [ ] Header Home/Profile and footer taps still highlight correctly

**Dependencies:** None.

---

### TICKET-026: Clear Account-Scoped State on Sign-Out and Account Switch

**Priority:** High | **Effort:** Small | **Status: OPEN** — privacy; do before launch

**Description:**
Signing out leaves the previous account's data in memory, and a different account
signing in without an app restart can see it. Pre-existing since TICKET-016; found
while reviewing TICKET-017's resume prefetch.

- `useExerciseHistoryStore` holds `exercise_stats` keyed by exercise id only, with no
  record of whose they are. `clearExerciseHistory()` exists (`useExerciseHistoryStore.ts:164`)
  but nothing calls it. Sign-out (`ProfileScreen.tsx:29`) runs only `signOut(auth)`
- `prefetchExerciseHistory` skips any entry already `ready`, regardless of user. So after
  A signs out and B signs in, B's start or resume prefetch skips A's cached exercises
  and B's progress bar, and from 018-020 the ghost targets, deltas and history sheet,
  show A's numbers
- The same class applies to the saved active workout: AsyncStorage key `activeWorkout`
  is not per account. B signing in on A's device resumes A's in-progress workout, and
  Finish saves it under B's uid

**Acceptance Criteria:**
- [ ] The history cache is cleared whenever the signed-in uid changes, including to
      `null`. Hook it to the auth state (`initAuth`'s `onAuthStateChanged`, or a
      `useAuthStore` subscription), not only to the Profile logout button, so session
      expiry (`initAuth.ts:72`) and any future sign-out path are covered
- [ ] An in-flight prefetch for the old uid cannot write into the cache after the
      switch (`clearExerciseHistory` already clears `inFlight`, but a request already
      awaiting `getExerciseStats` still calls `set` when it resolves — guard on uid)
- [ ] Decide what happens to an active workout on sign-out or account switch: discard,
      keep only for the same uid (store the uid with it), or ask. Overlaps TICKET-022's
      resume banner, so decide the rule once
- [ ] Device check: log in as A, start a workout with an exercise that has history, sign
      out, sign in as B without restarting; B sees no A data on the progress bar or the
      History Debug screen (fetch counter goes up for B's prefetch)

**Dependencies:** None. Touches the resume prefetch from TICKET-017
(`prefetchHistoryOnResume` in `useWorkoutStore.tsx`), which subscribes to the auth store.

---

### ~~TICKET-027: One Save per Session, and Discard Cannot Race a Save~~ ✅ DONE

**Priority:** High overall: Medium for the double save, High for the discard race.
Filed as High for "a double save is a data bug", which was wrong. See below.
**Effort:** Small

Filed as one bug, delivered as two. The filed premise came from the TICKET-024 review
without being checked, and the filed note "`cancelWorkout` racing a save is the same
shape" undersold the worse one.

#### A. Double save (Medium)

Two Finish taps inside one frame called `endWorkout` twice. The screen's guards all
read `finishing` from the last render, so none could see the first tap.

**Corrected premise:** this was **not** data corruption. The write path is idempotent
by construction: `buildSessionId` derives from `workoutId` + `startTime`, not
`endedAt`, so both saves write the same doc ids; `applySessionToStats` folds by
replacement (`recentSessions` and `volumeHistory` filter the session out before
prepending, `lastPerformedAt` is a max, `applyBest` only raises); there is no running
total. The real cost was a duplicate batch commit, a duplicate rollup transaction, and
two "Workout saved successfully!" toasts.

**Why it was still worth doing:** that idempotency is accidental, and no test asserted
it. A future `totalSessions + 1` or `lifetimeVolume +=` in the rollup would turn the
double save into silent corruption. The guard makes one save per session a property of
the store, whatever the rollup does.

#### B. Discard during an in-flight save (High)

`cancelWorkout` only cleared AsyncStorage and nulled `activeWorkout`. It never touched
Firestore. While a save was in flight, Finish read "Saving…" but the `···` menu was
still live: Discard → confirm cleared local state, then the save resolved against the
workout it had captured, wrote it to history, and toasted success. **A workout the user
explicitly discarded ended up in their history.** The window is a server round trip (the
rollup is a transaction), not one frame. This is a separate bug from A, not "the same
shape": A wastes writes, B produces the wrong outcome.

#### Decisions pinned

- **Guard:** `savesInFlight`, a `Map<sessionId, Promise<void>>` at module scope in
  `useWorkoutStore.tsx`, outside zustand state. A zustand update is invisible to a
  second caller in the same frame, and that was the bug. A caller arriving mid-save
  gets the same promise back. Cleared in `finally` with an identity check (the
  `useExerciseHistoryStore` `inFlight` pattern), so a failed save can be retried
- **Discard semantics: Finish wins.** `cancelWorkout` is refused while a save for the
  current session is in flight, with a "Still saving" toast. Rejected, "discard wins":
  phase 1 is a `writeBatch` that queues in Firestore's cache and cannot be recalled
  once started, and compensating means deleting the session docs *and* rebuilding
  `exercise_stats`, because `applySessionToStats` cannot un-fold a session. Both touch
  `saveWorkoutSession` and the rollup, which are non-goals. The refusal also covers
  StartWorkoutScreen's "Cancel Workout", which calls the same action
- **Screen guard `if (finishing) return` deleted.** It could not stop the same-frame
  race, `disabled` already blocks a cross-frame tap, and its comment ("would write the
  session twice") was no longer true. `finishing` now only drives the busy look
- The save body moved unchanged into `persistWorkout`, which never rejects. That is
  what lets the guard clear and accept a retry

- **Save failure logged with `console.log`, not `console.error`** (found in the device
  test). In a dev build, `console.error` opens LogBox's red banner over the "Could not
  save workout" toast: two messages for one expected failure. The toast is the user's
  message. The line was already on `main`; changed here because it got in the way of
  this ticket's retry test

**Deviation:** the store test mocks `saveWorkoutSession` at its module, against
README's "replace the store action". That rule is for screens; when the action under
test is `endWorkout`, replacing it tests nothing. README now says when this applies.

**Files:** `src/stores/useWorkoutStore.tsx`, `src/stores/useWorkoutStore.test.ts` (new),
`src/screens/workout_management/ActiveWorkoutScreen.tsx` (comment + guard removal),
`ActiveWorkoutScreen.test.tsx`, `src/test/README.md`

**Verification:**
- `npx tsc --noEmit` clean; `npm test` 16/16 (was 12), 0 console output
- New: store, two unawaited calls → 1 save, 1 success toast; store, failed save then
  retry → 2 saves, 1 success; store, discard refused mid-save, allowed after the
  save fails; screen, two Finish taps in one `act()` → 1 save
- Renamed: "ignores a second Finish tap…" → "disables and relabels Finish while a save
  is in flight", now also asserting the "Saving…" label and the disabled state
- Mutation runs, each red for the reason named:
  - drop the join (`return pending`): unawaited-calls + same-frame screen tests
  - never clear the entry: retry test (1 save, not 2) + discard test
  - never refuse discard / always refuse discard: discard test, each half
  - never register the save: three tests
  - drop the "Saving…" relabel: renamed test
  - drop `disabled` alone: **green**, because `accessibilityState.disabled` is
    `TouchableOpacity`'s fallback. Dropping both: red
  - the new tests against `main`'s store: same-frame, unawaited-calls and discard all red

**Known gaps:**
- **Offline: Discard stays refused until the save settles, and that can take a long
  time.** `batch.commit()` resolves on server ack, and `db` uses the default memory
  cache. Offline, Finish already showed "Saving…" until reconnect (pre-existing). Now
  Discard is refused for the same stretch. That is honest, since the queued write
  will land, but the user has no way out short of reconnecting or killing the app.
  Not tested: needs a device with networking off. Deferred because the fix lives in
  `saveWorkoutSession` (resolve after phase 1's local write, not the server ack),
  which is a non-goal here. Filed as **TICKET-028** and sequenced next, so the dead
  end is fixed before any other ticket builds on it (TICKET-022's resume banner adds a
  second Discard that would inherit it)
- The "Still saving" toast is the only feedback for a refused discard. The confirm
  dialog has already closed. Adequate for a rare race, and a disabled menu item would
  be a UI change outside scope
- Rollup idempotency is still untested directly. This ticket protects it, it does not
  assert it. A test on `applySessionToStats` applied twice belongs with the next change
  to that function

**Dependencies:** TICKET-024.

---

### TICKET-028: Offline Finish — Save on the Phone, Upload Later, Show What Is Pending

**Priority:** High | **Effort:** Medium-Large | **Status: IN REVIEW — device test pending**

Sequenced next after TICKET-027 (PR #6 review). In a gym, having no signal is the
normal case, and TICKET-027 left offline Finish with no way out.

**Description:**
Finishing a workout offline does not lose data today, but it leaves the user stuck.
`endWorkout` awaits `saveWorkoutSession`, whose `batch.commit()` resolves only when the
server acknowledges the write. So with no connection:

- Finish sits on "Saving…" until the connection returns
- Discard is refused for that whole time (TICKET-027's "Finish wins")
- the workout stays the active one, so the next workout cannot be started
- nothing tells the user what is waiting to upload

The data itself is safe: the workout stays in AsyncStorage (`activeWorkout`) until a
save succeeds, and survives an app restart. Firestore's own queued copy does not
survive one: `db` uses the default memory cache.

Wanted (from the TICKET-027 device test): **Finish always completes once the workout is
saved on the phone.** Finished workouts that have not reached the server wait in a
local queue, upload when the connection returns, and are visible in the app as "saved
on this phone, not uploaded yet" until they do.

**Acceptance Criteria:**
- [ ] Finish completes on a local write: offline, the workout leaves the active slot,
      the user gets a "saved on this phone, will upload when online" message, and a
      new workout can be started
- [ ] Finished-but-not-uploaded workouts are kept in a local queue that survives an app
      restart, separate from the single `activeWorkout`
- [ ] The queue uploads on its own when the connection returns and on app start, in
      finish order, and an entry is removed only after its upload succeeds
- [ ] The user can see pending workouts: at least a count ("2 workouts waiting to
      upload") and a list. Where it lives is decided in this ticket
- [ ] A failed upload stays queued and is retried, and repeated failure is visible,
      not silent
- [ ] Tests (store-level, no React, as in TICKET-027): finish offline → queued, not
      lost; upload succeeds → removed; upload fails → kept and retried; restart →
      queue reloaded. Each seen failing first

**Verify first (load-bearing, all unconfirmed):**
- **`batch.commit()` hangs offline rather than rejecting.** Inferred from the SDK's
  semantics and TICKET-027's code reading; confirm with TICKET-027's device step D
- **Firestore's persistent (on-disk) cache is unavailable in React Native** (it relies
  on IndexedDB). If true, the queue has to be ours, in AsyncStorage. If false, the
  design may shrink to "resolve Finish after the local write" plus a pending view
- How connectivity is detected. No connectivity library is installed
  (`@react-native-community/netinfo` is the usual choice and is a native dependency,
  so the dev client needs a rebuild). Alternative: no detection at all, just retry the
  queue on app start, on foreground, and after each successful save

**Technical Notes:**
- **Uploading the same entry twice is safe.** `buildSessionId(workoutId, startTime)`
  fixes the session's ids when the workout starts, and the rollup folds by
  replacement, so a retried upload overwrites rather than duplicates. TICKET-027 keeps
  one upload per session in flight; the queue should reuse that guard, not add a
  second one
- **The queue must be per account.** An upload must use the uid of the user who did
  the workout, not whoever is signed in when the connection returns. Store the uid on
  each entry, and decide with TICKET-026 what sign-out does to someone else's pending
  workouts
- **History will be stale for pending workouts.** "Last time" and ghost targets
  (TICKET-016/018) read the server rollup, so a workout still in the queue is missing
  from them. Decide whether to fold pending entries into the cache locally or accept
  the gap and say so on screen
- Groundwork already in the code, none of it working: `isPersisted` on
  `ActiveWorkout`, the `useSyncWorkout` hook (not used by any screen), and the
  offline branch in `persistWorkout`, which never runs because `isOnline` is
  hard-coded `true`. Reuse or delete each, but do not leave them half-alive
- **`endWorkout` cannot report failure today.** `persistWorkout` never rejects, so
  `endWorkout` always resolves, and a caller cannot tell a saved workout from a failed
  one except by watching `activeWorkout` go null. The queue needs a result to branch
  on: change it to return something like `Promise<{ saved: boolean }>` at the start of
  this ticket, before writing the queue against it (PR #6 review)
- With Finish completing on the local write, the window where TICKET-027 refuses
  Discard shrinks to the local write itself, which closes its offline gap
- Out of scope unless needed: editing or deleting a pending workout before it uploads

**Dependencies:** TICKET-027. Coordinate with TICKET-026 (account scoping) and
TICKET-011 (a cross-screen pending indicator may be the same component).

#### Delivery (branch `TICKET-028`)

**Split.** This ticket ships the dead-end fix and the queue. The pending count and
list moved to **TICKET-029**, because it may be TICKET-011's cross-screen indicator
and building it here risks building it twice. The "user can see pending workouts"
criterion is TICKET-029's.

**Step 0 — what `batch.commit()` does offline.** Measured with the app's
`firebase@11.4.0`, memory cache, from Node, **not on a device**:

| Run | `batch.commit()` | `runTransaction` |
|---|---|---|
| `disableNetwork` | pending at 60 s | rejected, 1.1 s |
| backend unreachable (connection refused) | pending at 60 s | rejected `unavailable`, 8.5 s |
| control: emulator, online | resolved, 496 ms | — |
| control: offline 10 s, then `enableNetwork` | resolved on reconnect | — |

So it **hangs**, and the ticket's large design holds. The write-ack path
(`__PRIVATE_syncEngineWrite`) is the same code in the React Native bundle
(`dist/index.rn.js`), but RN uses the WebChannel transport where Node uses gRPC.
**Still owed: the same observation on a device in airplane mode.**

**Design:**
- `endWorkout` validates (≥ 1 set), then moves the workout from the active slot to
  the queue **synchronously, before its first await**. Disk write of the queue first,
  then `activeWorkout` is removed; a failed queue write rolls back. It then waits up to
  `UPLOAD_GRACE_MS` (3 s) on the upload, only to pick the message: "Workout saved",
  "Saved on this phone… won't show in your history until it uploads", or "upload
  failed, will be retried"
- Returns `EndWorkoutResult`: `uploaded` | `queued` | `refused` (still active)
- Queue: `pendingUploads` in `useWorkoutStore`, mirrored to AsyncStorage key
  `pendingUploads`, writes serialised. An unreadable stored queue is copied to
  `pendingUploads.corrupt.<ts>`, never overwritten
- Drain (`drainPendingUploads`): app start, sign-in, foreground, after every successful
  upload. Sequential in finish order; each entry once per drain; one toast per drain
  with the count still waiting. Entry removed only after its upload succeeds. No
  netinfo: an offline attempt just stays pending and completes on reconnect
- `savesInFlight` (TICKET-027) now guards uploads; Finish and drain join each other
- `saveWorkoutSession` takes `endedAt` from the entry: an upload hours later must not
  record the upload time as the end of the workout

**Deviations:**
- **Per-account: an entry is attempted only while its own uid is signed in.** The
  ticket asks for "upload under the entry's uid, not the signed-in one". The rules
  (`request.auth.uid == userId`) make that impossible, so tagging alone would fail on
  every retry. Other users' entries wait, untouched. Sign-out behaviour is TICKET-026's
- **Discard refusal removed** (TICKET-027's "Finish wins"). The active workout can no
  longer have an upload in flight, so the guard was unreachable. Removed rather than
  left half-alive, with its test
- A workout with no sets is refused **before** queueing. Queued, it would be rejected
  on every retry forever
- A crash between queue write and slot clear leaves the workout in both;
  `loadWorkoutFromStorage` drops the active copy if its session is queued

**Accepted gap, said on screen:** a queued workout is missing from "last time" and
ghost targets until it uploads (they read the server rollup). The "Saved on this phone"
toast says so. Not folded into the history cache.

**Removed:** `useSyncWorkout` (gated on `navigator.onLine`, which RN never defines),
`isPersisted`, `persistWorkout`'s dead offline branch, and firebase.ts's
`cacheSizeBytes` (never enabled persistence; now `memoryLocalCache()`, stated).

**Verification:**
- `npx tsc --noEmit` clean; `npm test` 20/20 (was 16)
- Store tests: offline Finish → queued, on disk, slot cleared; success → removed;
  failure → kept with count, next drain retries; drain during Finish's upload → one
  save; another user's entry not attempted, uploads when its user signs in; restart →
  reloaded from disk, uploads on sign-in
- Mutation runs, each red for the reason named: no queue write at Finish; no removal
  on success (4 red); failure drops entry (3 red); no join (1 red); drain ignores uid
  (1 red); queue not loaded at start (1 red). Moving the slot clear after an await is
  **green** alone because the join still catches the second call; with the join also
  removed, red. Uploading under the signed-in uid instead of the entry's is
  **green**, and cannot be otherwise: the drain gate makes the two equal. The test
  pins the gate
- **Untested, needs a device:** commit hang over WebChannel; airplane-mode Finish →
  new workout starts; kill and reopen keeps the queue; reconnect + foreground uploads
  and empties the queue; Firestore's own memory-queued write and our retry landing
  together (expected harmless: same ids, same `endedAt`)

**Known gaps:**
- No retry timer. A workout stays queued until start, sign-in, foreground or another
  upload. Deferred: reachable only if the app stays foregrounded across a whole
  reconnect, and the next foreground fixes it
- A rejected upload toasts once per drain, and drains are infrequent, so a
  permanently-rejected entry nags at each foreground. Acceptable until TICKET-029 gives
  it a place to live
- Rollup idempotency is relied on more now (every retry re-folds), still asserted
  nowhere. Same note as TICKET-027

**Device test plan** (corrected after the first device run):
1. Online: log a set, Finish → "Workout saved", Pending Uploads 0
2. Online: start, log a set, **airplane mode on**, Finish → slot cleared at once,
   "Saved on this phone" after ~3 s, Pending Uploads 1 (on disk 1)
3. Still offline: kill and reopen → Pending Uploads still 1. On the emulator, load the
   bundle over adb so airplane mode does not cut Metro:
   `adb reverse tcp:8081 tcp:8081` + `npx expo start -c --localhost`, open
   `http://localhost:8081`
4. Airplane off, touch nothing for 2 min → "Workout saved" on its own, count 0. The
   waiting upload completes when Firestore's own reconnect (backoff up to ~90 s)
   gets through; Retry/foreground is only needed after a *rejected* upload
5. Finish with no sets → refused, workout stays active

Not testable today: starting a workout offline (plans are read from Firestore and not
kept on the phone), so in practice the queue holds at most one workout per account
unless an upload was rejected. Offline plans would be their own ticket.

**Device result (Android emulator, 2026-10-17):** user reports every scenario above
passes.

**Debug screens behind a build flag.** History Debug and Pending Uploads (tiles and
routes) show only when `SHOW_DEBUG_SCREENS=true` at bundle time (`.env` locally, an
EAS environment variable for a build). Unset means hidden, so a build that forgets it
ships without them. Read once at bundle time; there is no runtime toggle.

---

### TICKET-029: Pending Uploads — Show What Is Waiting to Upload

**Priority:** Medium | **Effort:** Small-Medium | **Status: OPEN**

Split from TICKET-028. The queue exists (`useWorkoutStore.pendingUploads`, each entry
with `failedAttempts` and `lastError`); nothing shows it.

**Acceptance Criteria:**
- [ ] Replace TICKET-028's TEMPORARY `PendingUploadsDebugScreen` (delete the file, its
      route, Stack.Screen and Workout tile — all marked `TEMPORARY`)
- [ ] A count ("2 workouts waiting to upload") visible outside the workout screens
- [ ] A list: workout name, date, and for a failing entry its last error
- [ ] Repeated failure shown here, so drain toasts can stop repeating
- [ ] Decide where it lives, with TICKET-011

**Dependencies:** TICKET-028. Coordinate with TICKET-011 (may be the same component)
and TICKET-026 (whose entries show after an account switch).

---

## PHASE 3B: Exercise Catalog

The goal: the catalog is big enough that nobody types a new exercise, and search finds
an exercise by what it trains, not only by its name ("chest" finds Bench Press).

The research is done. It lives in `research/exercise-catalog/`, which is
**git-ignored and exists only on the machine it was made on**. Copy anything a ticket
needs into the repo as part of that ticket.

- `catalog_src.py` is the source of truth. `python3 -I build.py` regenerates
  `catalog.json`, `catalog.csv` and `CATALOG.md`
- `python3 -I build.py "query"` runs the prototype search
- `python3 -I search_cases.py` runs 91 search regression cases
- `README.md` has the findings. Its counts say 875; the catalog is now 878

What the research produced: 878 flat entries, one per equipment version ("Barbell
Bench Press", "Dumbbell Bench Press", ...). Each has 29 muscles in 9 groups (primary
vs secondary, ordered), equipment, category, movement pattern, compound/isolation,
unilateral, aliases, and one of 11 measure templates. Every exercise in the user's
own Back, Chest and Leg notes (84 versions) is present.

**Decided by the user (2026-10-24): the catalog is movement first.** Bench Press is
one exercise; barbell, dumbbell, Smith or machine is an option chosen under it, not
five list entries. TICKET-042 has the model and why history still splits by version.
A rough name grouping of the 878 gives about 573 movements; 98 of them have more
than one entry (re-measured 2026-10-24, TICKET-046). The grouping is a heuristic, and
TICKET-046 settles the real one.

Four tickets at first: the design for every screen this changes (041, first), the
catalog's model (042), finding an exercise (043), and plates as a weight unit (044;
its other details were dropped or superseded on 2026-10-24). Added the same day: the
catalog's content (046; the research catalog is reference only), a live name-rule
bug to fix first (048), and two deferred ones, custom exercises (045) and switching
a version mid-workout (047).

---

### ~~TICKET-041: Design Every Screen the Catalog Changes~~ ✅ DONE

**Priority:** Medium | **Effort:** Medium | **Status: DONE** — all groups
approved 2026-10-24; merged in PR #17

**Description:**
TICKET-042 to TICKET-044 change what the user sees in several places, and some of
their open decisions are easier to make by looking at them than by reading about
them (incline as a version or its own exercise; whether a close-grip set compares
with a normal one). Design all of it on the Workout Flow canvas
(https://claude.ai/artifact/GaUZBuTFSKNhd7RxKqu9GN) before any of those tickets
writes UI code. Each board is mirrored in `design/workout-flow/project/` and
committed once the user approves, the same as TICKET-034 and TICKET-040.

This ticket covers design only. The code for each screen stays in the ticket that
needs it, built against the chosen board.

**Screens to design, and which ticket builds each:**

| # | Screen | Today | What changes | Built in |
|---|---|---|---|---|
| A1 | Exercise search, empty query | `AddExerciseScreen` → `SearchableInputDropdown`: a dropdown that searches names | Recent and frequent exercises first, then filter chips (muscle group, equipment, category) | 043 |
| A2 | Exercise search, results | Name matches only | One row per movement. Decide what a row shows: name, main muscles, number of versions ("4 versions") | 043 |
| A3 | Pick a version | none | Bench Press → Barbell / Dumbbell / Smith / Machine, the one used last preselected. Skipped when there is one version. Covers angle (flat / incline / decline) and cable attachment (rope / bar / V-bar) | 043 |
| A4 | No results | Offers a custom exercise | A typo still matching ("bech press") needs no special state. Decide whether "did you mean" is shown, and how creating a custom exercise is reached | 043 |
| B1 | Exercise name with its version | `PlanRow`, `CollapsibleExerciseList`, the `ExerciseLogger` header, `ExerciseHistorySheet`, `WorkoutHistoricalLogsFilter` | One format everywhere, e.g. "Bench Press · Dumbbell". Check that it fits at phone width with long names ("Kneeling High-to-Low Cable Fly · Rope") | 042 |
| B2 | Change version mid-workout | none | Only if TICKET-042 decides the logger offers it. The machine was taken, so the user switches to dumbbells: where is that, and what happens to the sets already logged | 042 |
| C1 | Weight unit picker | `ExerciseFieldEditor`: kg / lb | kg / lb / plates | 044 stage 1 |
| C2 | Set card in plates | Stepper and labels assume kg or lb | "4 plates", stepper by 1, the last-time pill and deltas in plates, the notice when last time was in kg | 044 stage 1 |
| C3 | ~~Machine setting~~ | none | **Dropped 2026-10-24 (MVP).** Boards drawn, marked dropped | — |
| C4 | ~~Per-side reps~~ | none | **Dropped 2026-10-24 (MVP).** Reps stay plain | — |
| C5 | ~~Variation tags~~ | none | **Superseded 2026-10-24:** grip is a version (042), extras not offered. Boards kept, labelled | — |

**Acceptance Criteria:**
- [x] Every row above has a board, or a written reason it is not needed (e.g. B2 if
      the logger does not offer a version change)
- [x] Each board uses the role tokens from `src/constants/colors.ts` and real catalog
      names, including the longest ones
- [x] For each screen with real alternatives, the chosen board and the rejected ones
      are recorded with the reason, in the ticket that builds it (format:
      TICKET-040's **Design** section)
- [x] The decisions that boards settle are written back into TICKET-042 to TICKET-044:
      at least incline as a version or a movement, the version line format, and
      whether a tagged set compares with an untagged one (answered: grip became a
      version, so nothing compares across it; tags superseded)
- [x] Boards mirrored in `design/workout-flow/project/` and committed after the user
      approves
- [x] Delivered in groups that can each be approved alone, so a build ticket is not
      waiting on the whole design: **C1–C2 first** (plates; TICKET-044 stage 1 has
      no other dependency), then **A** (finding), then **B** (version shown), then
      **C3–C5**

**Progress:**
- **C1–C2 approved 2026-10-24** (boards `Plates*`, `Manage*`; canvas row "TICKET-041 ·
  C1–C2"). Recorded in TICKET-044's **Design, stage 1** and TICKET-043's **Design,
  Manage Workout**. Committed in PR #17.
- **Scope growth, stated:** C1 grew into the whole Manage Workout screen (plan list,
  Add exercise, custom exercise, New plan, no plans yet). The first C1 board showed
  only the unit chip and hid today's New switches, which the user caught. Proposed
  to build it in TICKET-043 stage 3; user to confirm.
- Found while designing: plan save refuses any exercise name with a character
  other than a letter or space; written into TICKET-042.
- **A1–A4 approved 2026-10-24** (boards `Find*`): A1, A2, A3 chosen; A1b, A2b, A3b
  rejected. Recorded in TICKET-043's **Design, the picker**; incline as an angle
  written into TICKET-042.
- **Deviation from A4 as written:** the row said to decide "how creating a custom
  exercise is reached". The user decided it is not reached, for now: no new custom
  exercises. Recorded in TICKET-043 and TICKET-042; reopened by TICKET-045.
- ~~Open, raised by group A: Close-Grip and Reverse-Grip Bench Press, movements or
  grip tags.~~ Tags (user, 2026-10-24). The research catalog became reference only;
  the real one is TICKET-046 (new).
- **B1–B2 decided 2026-10-24** (boards `Name*`, `Switch*`). B1: format A chosen on
  the user's request to decide on user-experience grounds: Hevy's convention
  ("Bench Press (Barbell)", movement first) and NN/g's finding that people scanning
  a list read about two words. B1b and B1c rejected. Recorded in TICKET-042. B2:
  wanted but deferred, as TICKET-047 (new), for this workout only.
- ~~**C5 approved 2026-10-24:** compare, and say the tags differed~~; superseded by
  grip as a version (below). All groups done. Still open: TICKET-042's "incline 19 versions" and other counts
  wait for TICKET-046's real catalog.
- **PR #17 review, the two High comments, decided (user, 2026-10-24, after the PR #17 review):** stored per
  combination, shown per movement. Grip is a version axis (own history, bests,
  targets), so bench and close-grip bench can share a plan and no load-changing
  choice enters another's records. Search and recents show movements only; a
  combination is named only where it is logged or planned. Nothing about the
  version is editable in Manage Workout (equipment, angle and grip alike; remove
  and add instead). Extras dropped for the MVP. Boards P1–P5 (`Version*.dc.html`)
  draw it; the user rejected the first P2 (grip editable in Manage) and P5 (recents
  per combination), both redrawn. C5 and the tags board are superseded. Recorded in
  TICKET-042, 043, 044, 046 and 047
- **Manage Workout redesign confirmed for TICKET-043 stage 3** (user, 2026-10-24)
- **C3 and C4 dropped** (user, 2026-10-24): MVP with about 5–10 users, so no
  machine settings and no per-side reps. Boards drawn and kept, marked dropped.
  Recorded in TICKET-044.
- ~~**Tags are plan-level and part of A3**~~ (2026-10-24), superseded the same day by
  grip as a version, above.

**Technical Notes:**
- Marks only where data exists: a set with no tag shows nothing, not an empty chip
  row (the user pushed back on placeholder boxes in TICKET-034)
- The picker likely cannot stay a `react-native-element-dropdown` dropdown: a version
  step and filter chips need their own screen or sheet. Design for the right
  screen, and leave the component choice to TICKET-043
- The guided tour has steps on today's picker (`MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE`
  in `AddExerciseScreen`). Mark which tour steps each new screen breaks or needs
- Not in scope: a movement-wide "all bench press" history view. TICKET-042 adds the
  movement id that would make it possible; design it when it is a ticket

**Dependencies:** none. Blocks the UI parts of TICKET-042, TICKET-043 and TICKET-044.

---

### TICKET-042: Exercise Catalog — Movements with Versions, Loaded into the App

**Priority:** Medium | **Effort:** Large | **Status: DONE** — open decisions
settled 2026-10-24; stage 1 merged in PR #20; stage 2 merged in PR #22 (e230264):
2A (808d490), 2B (b584798), 2C (c96b510), rules reconciled (000fcac), debug screen
removed (7007ad0). Wipe and catalog upload done 2026-10-26 (version 889393c5…,
`predefined_exercises` gone); device checks passed 2026-10-27; rules deployed
2026-10-27, so the console now matches `firestore.rules`

**Description:**
Replace today's 42 exercises (`src/scripts/uploadExercises.ts`) with the research
catalog, reshaped as movements with versions. The user sees "Bench Press" once and
picks Barbell / Dumbbell / Smith / Machine below it, defaulting to the one used last.

**Load-bearing fact:** history joins on `exerciseId`. Ghost targets, per-set deltas,
personal bests (`bestByReps`), volume and the history sheet all read "last time" by
that id. 40 kg on a dumbbell bench and 40 kg on a barbell bench are different
numbers, so **the history key must stay one per version, not one per movement.**

- Rejected: one id per movement, equipment as a tag on the set. A barbell day's
  60 kg would become the ghost on a dumbbell day, and a Smith best would beat a
  barbell best. Every consumer would need the same equipment filter; one missed
  is a plausible wrong number nobody sees (CLAUDE.md 2.4)
- Chosen: the movement is how the catalog is **shown**; the version is what is
  **logged**. `Exercise.id` stays the history key, one per version
  (`bench_press__dumbbell`), so the history layer does not change. The movement id
  is added next to it, for grouping in search and in a future "all bench press"
  view

**Which differences make a version, and which are only details** (rule: a version is
anything that changes the numbers):

| Version (own history) | ~~Detail (same history)~~ Not offered in the MVP (2026-10-24) |
|---|---|
| Equipment: barbell, dumbbell, Smith, machine, cable, band, kettlebell | Stance, tempo, pause, partial range |
| Angle, where it changes the load: flat, incline, decline | Belt, straps, bands or chains on a bar |
| Cable attachment: rope, straight bar, V-bar | ~~Machine seat or pin setting~~ (dropped, MVP: TICKET-044) |
| One arm or leg vs both | |
| **Grip:** close, reverse, neutral (moved here 2026-10-24, after the PR #17 review) | |

Cable attachment as a version settles the open question on cable lateral raise with
a rope: it is one more option, not a new exercise.

**Proposed shape** (settle first):

```ts
interface Movement {
  id: string;                    // "bench_press"
  name: string;                  // "Bench Press"
  primaryMuscles: MuscleId[];    // ordered: the first one is the main target, and search ranks by it
  secondaryMuscles: MuscleId[];
  category: CategoryId;          // strength, cardio, stretch, mobility, ...
  pattern?: PatternId;           // push, pull, hinge, squat, carry, ...
  mechanic: "compound" | "isolation";
  aliases: string[];             // "bench", "flat bench"
  versions: MovementVersion[];   // one entry for a movement with no options
}

interface MovementVersion {
  id: string;                    // "bench_press__barbell__incline__close_grip": the exerciseId history joins on (format below)
  equipment: EquipmentId;
  angle?: "flat" | "incline" | "decline";
  attachment?: "rope" | "straight_bar" | "v_bar" | "d_handle";
  grip?: "close" | "reverse" | "neutral";   // absent = normal grip (2026-10-24)
  unilateral: boolean;
  fields: ExerciseField[];       // what a plan copies when this version is added
  aliases: string[];             // "db bench"
  primaryMuscles?: MuscleId[];   // override only where the version changes the target (incline: upper chest first)
}
```

**The version id is a stored contract** (PR #17 second review). It is the history
key, so it never changes once a version ships:
- **format:** `{movement}__{equipment}[__{angle}][__{attachment}][__{grip}_grip][__one_side]`,
  parts in that fixed order, lower snake case: `bench_press__barbell`,
  `bench_press__dumbbell__incline`, `bench_press__barbell__close_grip`,
  `triceps_pushdown__cable__rope`, `lateral_raise__cable__one_side`
- **one arm and one leg share one suffix, `__one_side`** (PR #17 third review): one
  rule instead of a per-movement choice. The display name still says "one arm" or
  "one leg", from the catalog's label for that movement (Single-Leg Leg Press,
  Single-Leg RDL: "one leg")
- **defaults are left out** (flat, normal grip, both arms, no attachment), as they
  are in the name. So adding an axis later leaves every existing id unchanged: old
  versions simply have the new axis at its default
- **generated once, then frozen:** the catalog stores each id as a literal. Renaming
  a movement or a part changes the display name, never the id. A test pins every
  shipped id (a snapshot), so a regenerated catalog that renames one fails
- the research catalog's ids do not carry over; today's 42 are the "old ids"
  decision below

**Acceptance Criteria:**
- [ ] Decided and written down before any code:
      - ~~is incline its own movement or an angle of Bench Press?~~ **Decided
        (user, 2026-10-24, TICKET-041 board A3): an angle**, with a muscle override
        (incline: upper chest first). Bench Press then has 19 equipment × angle
        versions (8 flat, 6 incline, 5 decline), 20 with single-arm dumbbell. A
        heuristic count: TICKET-046 settles it. The picker shows Equipment × Angle and disables
        combinations that do not exist. Rejected: board A3b, incline as its own
        movement
      - ~~grip: movements of their own, or tags?~~ **Decided (user, 2026-10-24, after the PR #17 review): grip is a
        version axis, like angle. There are no tags.** Stored per combination,
        shown per movement:
        - **stored:** equipment + angle + attachment + grip together are one
          version, with its own id, history, ghost targets and bests. Close-grip
          bench never compares with normal-grip bench, and a plan can hold both
          (they are different ids). This fixes the two High review comments: the
          duplicate refusal and a load-changing choice entering `bestByReps`
        - **shown:** outside logging and the plan, the user sees movements only.
          Search and recents show "Bench Press" once; the combination is chosen in
          A3's sheet (TICKET-043). It appears by name only where it is logged or
          planned ("Bench Press · Barbell, close grip")
        - **extras dropped for the MVP:** pause, bands, chains, belt, deficit,
          stance, partial range, straps are not offered (TICKET-046 lists the
          research entries this drops). Tempo was already out (free text)
        - search: a grip version may override muscles (close grip: triceps first),
          like incline does, so "triceps" still finds Bench Press
        - rejected: grip and extras as tags that never split history (the earlier
          decision, boards C5 and `ManageTags.dc.html`): a close-grip set would
          compare with a normal one, a banded set could become the heaviest
          record, and bench plus close-grip bench could not share a plan
      - ~~**storage:** ship the catalog in the app bundle (research measured 21 KB
        gzipped for the search fields; offline search, zero Firestore reads) or keep
        `predefined_exercises` in Firestore. Recommend the bundle: Firestore then
        holds only custom exercises. Today `usePredefinedExercises` re-reads the
        whole collection every time a screen using it mounts~~ **Decided (user,
        2026-10-24): Firestore, cached on the phone, refetched only when its
        version changes.** Built in stage 2:
        - a new collection `exercise_catalog`, not `predefined_exercises`, so the
          42 old docs never mix with the new ones: one `meta` doc (`version`, a
          content hash; `updatedAt` for display only) and 2–3 `chunk_N` docs, each
          a list of movements with their versions nested. Not one doc per
          version: that is ~878 reads per phone per catalog change. The research
          catalog is 628 KB raw (35 KB gzipped); grouped by movement it is smaller,
          but a Firestore doc is capped at 1 MiB, hence chunks
        - the phone keeps the catalog and its `version` in AsyncStorage, loads it
          into memory at app start, and reads `meta` (1 read) at app start and
          when Manage Workout opens. Same `version`: use the cache. Empty cache or
          a different `version`: fetch the chunks again. A content hash, not a
          date: re-uploading the same content refetches nothing, and phone clocks
          do not matter
        - **every screen needs it, not only Manage Workout:** names are built from
          the catalog (below), so the logger header, history sheet, Start row and
          logs filter read it too, offline included. Safe because the first
          sign-in needs a network anyway, so the catalog is fetched then. **Sign-out
          must not clear it** (it is not account data; TICKET-026)
        - a fetched catalog runs through `loadCatalog`; invalid means keep the
          previous cache, never apply part of one
        - **the vocabulary stays in code** (user, 2026-10-24, MVP): muscles,
          groups, equipment, categories, patterns, measures and the axes live in
          `catalogVocabulary.ts`, not Firestore. Search, the picker and
          TICKET-035 are written against exact values (`"cable"` shows the
          Attachment row, `hammies` → `hamstrings`, `assisted` is "lower is
          better"), and `MuscleId` / `EquipmentId` let `tsc` catch a typo in
          them. Consequence: a catalog that uses a new equipment or muscle needs
          an app build **before** its upload, or older builds refuse the whole
          catalog and keep their cache. Stage 2 logs that refusal loudly, so it
          is never a silent "the update did not show". Rejected for now: muscle
          and equipment labels in the catalog's `meta` doc (no build for a new
          equipment). Revisit if that build-first order becomes a real cost
        - an unknown id while online triggers a refetch (a plan made on a phone
          with a newer catalog)
        - rules: `exercise_catalog` readable when signed in, no client writes.
          `firestore.rules` is an unreconciled proposal: diff with the console
          before the user deploys. No new indexes (reads are doc gets by id)
        - why not the bundle: `expo-updates` is not installed (`eas.json` has no
          update channel), so every catalog fix during TICKET-046 would be a new
          EAS build and a reinstall for every tester
        - evidence: `usePredefinedExercises` has one caller
          (`AddExerciseScreen.tsx`); `addPredefinedExercise` has none, so custom
          exercises live only inside plan docs, not in a catalog collection (the
          recommendation's "Firestore then holds only custom exercises" was off)
      - ~~**old ids:** today's 42 use `deadlifts`, `pull_ups`, `bicep_curls`. Map them to
        versions, or accept losing device test history (pre-launch: no migration
        owed, but it should be a choice, not a surprise)~~ **Decided (user,
        2026-10-24): not mapped. The test data is wiped when stage 2 lands**: plans,
        `sessions`, `exercise_sessions`, `exercise_stats`, the 42
        `predefined_exercises` docs, and the phone's active workout and pending
        uploads. A script with `--dry-run`, run by the user (CLAUDE.md 1.3). Not
        now: until stage 2 nothing reads the new catalog. Why mapping was a
        migration, not a lookup: the id is inside doc ids
        (`exercise_stats/{exerciseId}`, `exercise_sessions/{sessionId}__{exerciseId}`)
        and inside every plan doc; and mapped history would still read
        `weight: null`, because old sets are keyed "Weight (kg)" and the new
        fields are "Weight" (TICKET-030 open)
      - ~~**old ambiguous names:** "Bicep Curls", "Squats", "Lunges", "Rowing" and
        "Cycling" are movements now; pick which version each old id becomes~~
        **Moot (2026-10-24):** nothing is mapped. For the record, "Rowing" has
        Weight × Reps fields, so it was a row lift, not the erg, and which row was
        not recoverable from the data
      - ~~a plan stores the version, so changing the version mid-workout means
        swapping the exercise. Decide whether the logger offers that~~ **Decided
        (user, 2026-10-24): yes, later, as TICKET-047.** A switch is for this workout
        only; the plan keeps its version. What this ticket must not rule out: a
        session holding an exercise its plan does not have (the switched-to version,
        beside the one already logged)
      - **name format, decided (TICKET-041 board B1, 2026-10-24):** "Movement ·
        version parts", flat and normal grip left out: "Bench Press · Dumbbell,
        incline", "Bench Press · Barbell, close grip", "Triceps Pushdown · Rope",
        and only "Pec Deck (Machine Fly)" for a single version. Names never cut to
        one line; they wrap to two (Start plan row and history sheet title change)
      - **the name is built, not stored** (decided after PR #17 review). Plans and
        sessions store the version id; every name
        site, including the history sheet and `WorkoutHistoricalLogsFilter`, builds
        the string from the catalog. An old session builds its name from its own
        stored version id, not the plan's current one. A catalog rename
        then updates old names too, which is wanted: the exercise did not change.
        `Exercise.name` stays stored only for custom exercises, which have no
        catalog entry (TICKET-045). So plan save never sees "·" and the name rule
        does not apply to catalog exercises. Rejected: storing the joined string,
        which goes stale when a version is renamed
      - **when the id is not in the catalog** (PR #17 second review): today's 42 old
        ids, research entries TICKET-046 drops (Pause Bench Press, the banded
        ones), a version removed later. Plans and sessions also keep the name as
        it read when the exercise was added or logged, a **fallback snapshot** in
        its own field, `nameSnapshot` (PR #17 third review; on the session doc it
        is the existing `exerciseName`, decided 2026-10-24), read only when the
        catalog has no entry. It is never validated, so the "·" in it never meets
        the name rule; `Exercise.name` stays for custom exercises only, and the
        line above holds. The name site then shows the snapshot
        with a small "no longer in the catalog" line, so it never looks current.
        With no snapshot either (data older than this), it shows "Exercise no
        longer in the catalog" and the id: an explicit absence, never a blank
        (CLAUDE.md 2.4). Tests: an unknown id with and without a snapshot; a plan
        holding a catalog version ("Bench Press · Dumbbell, incline") saves
      - ~~a custom exercise: a movement with one version and no muscles, or plain
        `Exercise` only~~ **No new custom exercises for now** (user, 2026-10-24; see
        TICKET-043 Design). What remains here: existing custom exercises in plans and
        history keep resolving, as plain `Exercise`, and are searchable by name.
        Reopened by TICKET-045
- [ ] The app loads the catalog TICKET-046 builds. **Changed 2026-10-24:** the
      research catalog is reference only, not the source (user). This ticket owns
      the shape (types, ids, storage, loading); TICKET-046 owns the content. The
      loader fails on a duplicate version id, an unknown muscle, equipment or
      measure, or a field without a role
- [ ] Every version's fields fit today's model, or the gap is explicit. 523 entries
      are weight × reps and 6 weighted bodyweight; the other 349 are:

      | Measure | Count | Today |
      |---|---|---|
      | Bodyweight reps, optional added weight | 149 | Check: does an empty added weight resolve, or give `null` everywhere? |
      | Hold for time | 79 | No ghost, delta or best (TICKET-035) |
      | Reps only | 39 | No weight, so no pair |
      | Distance + time | 28 | No single "better"; pace is derived (TICKET-035) |
      | Duration (+ level) | 28 | TICKET-035 |
      | Weight × distance | 17 | TICKET-035 decides `load` or `single` |
      | Weight × time | 5 | TICKET-035 |
      | **Assisted** | 2 | **Wrong, not just missing:** with role `weight`, less assistance (progress) reads as a regression and adds to volume. Use role `other` until TICKET-035's `better` exists |
      | Jump/throw distance | 2 | Needs a `cm` unit (TICKET-030) |

      These can still be logged; they show no comparisons, which is the correct
      absence. The assisted ones are the exception
- [ ] Field names carry no unit ("Weight", not "Weight (kg)"), so this does not repeat
      the rename TICKET-030 fixes
- [ ] Catalog names are not run through the custom-name rule (names are built,
      see above). The live bug in that rule is split out as TICKET-048 (PR #17
      review), so it does not wait for this Large ticket
- [ ] Storage is Firestore (`exercise_catalog`, decided above): the upload runs
      with `--dry-run` first and its output is shown; the user triggers the real
      write (CLAUDE.md 1.3). Today's 42 `predefined_exercises` docs go in the
      user-triggered wipe, not in the upload
- [ ] The user's own exercises resolve: the 84 versions from their Back, Chest and
      Leg notes each map to a movement + version
- [ ] Delivered in stages that each typecheck and run (CLAUDE.md 3.4):
      1. types and the generated catalog, no visible change
      2. the app reads the new catalog; the exercise picker still lists by name
         (TICKET-043 replaces it)

**Implementation, stage 1 (2026-10-24):** types, rules and a hand-made catalog;
nothing in the app imports them yet, so the app behaves as before.
- `src/types/catalog.ts`: `Movement`, `MovementVersion` as proposed.
  `src/constants/catalogVocabulary.ts`: the closed sets (29 muscles in 9 groups,
  37 equipment, 11 categories, 24 patterns, 11 measures, the axes), from the
  research with its short codes spelled out (`bb` → `barbell`). Equipment keys
  are inside version ids, so they are stored values: never renamed
- `src/utils/catalog.ts`: `buildVersionId` (checks ids, never makes them),
  `buildVersionName`, `resolveExerciseName` (catalog → snapshot with "No longer
  in the catalog" → "Exercise no longer in the catalog" + id), `validateCatalog`
  / `loadCatalog` (all errors at once; invalid is never a partial catalog)
- `src/constants/exerciseCatalog.ts`: 6 movements, 18 versions. Bench Press
  (equipment × angle + close grip), Triceps Pushdown (attachments), Lateral Raise
  (cable one arm), Pec Deck (single version), Plank (time only), Pull-Up
  (assisted). `exerciseCatalog.test.ts` pins all 18 ids; replaced wholesale,
  deliberately, by TICKET-046's
- `nameSnapshot?` on `Exercise` and `LoggedExercise`; `ExerciseSessionDoc.exerciseName`
  documented as the session's snapshot. Nothing writes them yet (stage 2)
- **Choices made while building, each with a comment at the code:**
  - **names show equipment only when the movement's versions differ in it**, so
    "Triceps Pushdown · Rope". Rejected: "an attachment implies cable", a special
    case. Cost: a band pushdown added later renames the rope one "Cable, rope"
  - **changed by TICKET-046 (2026-10-25): one side follows the same rule**, shown
    only when the movement's versions differ in it ("Lunge · Dumbbell", every lunge
    being one leg; "Lateral Raise · Cable, one arm"). Ids unchanged
  - a single version shows the movement name even with a non-default axis (a
    rope-only Face Pull reads "Face Pull")
  - **deviation: `angle` has no `"flat"` value**; absent is flat, so a flat version
    has one spelling and the id rule has nothing to drop
  - **deviation: assisted is equipment `assisted_machine`**, not a new id axis:
    "Pull-Up · Machine" would not say the number is assistance. Its field is
    "Assistance", role `other`, unit kg (the set card still says kg; nothing sums
    or compares `other`)
  - added to the proposed shape: `measure` on each version (the loader checks
    it; it is a label until TICKET-035), and `oneSide: "arm" | "leg"` on the
    movement, required when a version is unilateral (the loader refuses one
    without it)
  - unit in a field name = any parenthesis, or a word that is a unit key
    ("Time s"). Not every spelling of a unit
  - **equipment is what carries the load, or what changes the numbers** (PR #20
    review). A bar, station, bench, box or wall is where the body works, not
    equipment: those movements are `bodyweight` (`pull_up__bodyweight`). Rings,
    suspension trainer and parallettes stay (a ring dip is a different number).
    No `none`: in the research it meant "an implement we did not model", which
    would freeze ids like `tib_bar_raise__none`; TICKET-046 adds a key for each
    such implement instead. Rule written at `EQUIPMENT`
  - **the loader never throws** (PR #20 review): untyped Firestore JSON (a list
    that is an object, a null field) is refused with a message, and anything
    unforeseen is caught and returned as `invalid`. Also refused: an unknown
    unit, a movement id not in lower snake case (it would be frozen into every
    version id), an empty name, no primary muscle, aliases that are not a list,
    and an `assisted` version with a `weight` field (the measure table's rule,
    now a check rather than a comment)
- **Tests:** 22 in `src/utils/catalog.test.ts` + 1 pin. Each covered line was
  broken and seen red (axis order, `_grip`, `one_side`, single version, equipment
  rule, capital, one-arm label, snapshot trim, both fallbacks, each of the 16
  refusals including the never-throw ones); the pin seen red by renaming
  `pec_deck__machine`
- **Not checked:** that a version's fields match its measure; that grip
  versions carry a muscle override (TICKET-046's criterion)

**Stage 2, recorded by TICKET-046 (2026-10-25):**
- **an app build containing 046's vocabulary must be on phones before the first
  upload.** 046 added equipment keys (`added_weight`, `gripper`, `wrist_roller`,
  `tib_bar`, `farmers_handles`, `punching_bag`, `indian_club`) and a measure
  (`short_distance`); an older build's loader refuses the whole catalog and keeps its
  cache (the build-first order above)
- **one doc fits; chunking is optional.** Measured on 046's final catalog: 282,421
  bytes as JSON (27% of Firestore's 1 MiB doc cap), 22.8 KiB gzipped; the largest
  movement, Bench Press, is 7.9 KiB. The `chunk_N` design above still works, but a
  single doc beside `meta` is enough for now

**Implementation, stage 2B: the app reads the catalog (2026-10-25).**
- **Names:** `exerciseDisplayName` (`utils/catalog.ts`): catalog (built from the
  id) → a custom exercise's own name → the snapshot, marked "No longer in the
  catalog", or "Exercise catalog not loaded yet" when the phone has no catalog
  (first launch offline, or between the wipe and the upload): that claim would
  otherwise be false. `useExerciseNames` / `useExerciseName` wrap it for screens.
  Every display reader on the probe list goes through them: logger header and
  prev/next (with a subtitle line), history sheet title (now 2 lines),
  `PlanRow` (2 lines), `CollapsibleExerciseList`, the logs filter's dropdown,
  its table model and the "No logs found" label, `ExerciseHistoryDebugScreen`,
  validation messages. A second probe after the change leaves only writes, the
  custom-name rule, the session snapshot and `services/db/exercises.ts:45` (2C)
- **Unknown id:** the hook asks the store for its check from an effect keyed on
  a boolean, after the cache is read. Gap: if that one check runs offline, it is
  spent for the run; Manage Workout's own meta check still covers it
- **Picker:** `catalogPlanExercises` lists all 805 versions by built name in
  today's dropdown; `usePredefinedExercises` no longer used (deleted in 2C).
  Adding stores `planExerciseFromPick`: version id, `name: ""`, `nameSnapshot`,
  a copy of the version's fields. The custom-entry ("New") switch stays (043)
- **Plan save:** the name rule runs only when `nameSnapshot` is absent, in both
  `validateExerciseSelection` and `validateWorkoutAndExercises`
- **Session snapshot:** `startWorkout` copies `nameSnapshot`, refreshed from the
  catalog as it reads then; `buildSessionDocs` writes it as `exerciseName`
  (a custom exercise: its name)
- **Local clear:** `LOCAL_DATA_VERSION = "2"` (`useWorkoutStore.tsx`), first in
  `loadWorkoutFromStorage`, before the queue loads or drains. A build constant, not
  a server flag or the catalog hash: it describes what this code can read, and must
  decide offline before the drain. **If the clear throws** (review fix): nothing is
  loaded or drained this run, `console.error` "LOCAL CLEAR FAILED", the marker
  stays unset so the next launch retries. Gap: a workout started or finished
  offline in that run lands in the keys the retry clears (AsyncStorage failing at
  all is the precondition)
- Tests (9 new; the failed clear: AsyncStorage throws → no upload attempted,
  marker unset): `exerciseDisplayName` (catalog with `name: ""`, snapshot, not
  loaded), the stored pick, plan save with a catalog version plus the custom refusal
  and the duplicate message, a `PlanRow` render (built name, unknown id's snapshot
  and one check), the session snapshot, the local clear. The three existing
  restart tests now set the current data version (they restart the same build).
  Each seen red by breaking its line (11 breaks)
- Not verified: any of it on a device; 805-row scroll; the ids a real pick writes
  against real Firestore

**Implementation, stage 2C: wipe script and cleanup (2026-10-26).**
- **Wipe:** `src/scripts/wipe.ts` (the logic, takes an injected db) and
  `src/scripts/wipeTestData.ts` (CLI, admin SDK). Dry run is the default and
  prints, per uid, top-level doc counts in `workouts`, `sessions`,
  `exercise_sessions`, `exercise_stats`, the other subcollections it **keeps**,
  then `predefined_exercises` and a total. A real run needs `--confirm`
  (`--dry-run` anywhere wins), deletes with `recursiveDelete`, then recounts and
  fails if anything is left. Paths touched, listed in both headers:
  `users/{uid}/{workouts,sessions,exercise_sessions,exercise_stats,workout_logs}/**` and
  `predefined_exercises/*`. Never `users/{uid}` itself, `info`, or any other
  subcollection. Users are listed with `listDocuments`, so a uid with no
  `users/{uid}` doc of its own (patchMissingUserDocs.ts) is still wiped. The dry
  run needs the admin key too: counting other users' data is beyond the rules
- ~~Kept: `users/{uid}/workout_logs`~~ **Wiped too (user, 2026-10-26):** legacy,
  read by nothing in `src`, holds old ids. Its nested `logs/.../exercises`
  go with it (`recursiveDelete`); counts are top-level only
- **Removed:** `usePredefinedExercises`, `services/db/exercises.ts`
  (`getAllPredefinedExercises`, `addPredefinedExercise`), `uploadExercises.ts`,
  `tables.users.predefinedExercises`, and `signInForScripts` / `auth` in
  `src/scripts/firebase.ts` (only `uploadExercises` used them)
- **Rules:** ~~the `predefined_exercises` block stays until the wipe has run~~
  **Removed from `firestore.rules` (user, 2026-10-26):** the wipe deletes the docs
  in step 4 and every phone is on the new build from step 2; the deploy after the
  wipe takes it out of the live rules
- Tests (4): the wipe against an in-memory Firestore deletes only the four
  collections (now with `workout_logs`) and `predefined_exercises`, keeps `info`,
  `settings` and `exercise_catalog`, and includes a uid with no own doc; the
  `--confirm` gate (3 cases). Seen red: deleting kept collections, ignoring
  `--dry-run`, skipping a uid with no own doc
- Not verified: the real dry run (needs the key, which only you have); without
  `GOOGLE_APPLICATION_CREDENTIALS` both modes exit 1 before any network call
- **Inherited gap:** `rebuildExerciseStats.ts`, `patchMissingUserDocs.ts` and
  `addExerciseToUserWorkout.ts` use the client SDK unauthenticated
  (`verifyHistoryReads.ts` reads local files only). ~~Broken by the rules deploy~~
  **Already broken** (corrected 2026-10-26 from the console diff): owner-only
  `users/**` is live and the open rule expired 2025-08-25. Split out as
  **TICKET-049** (user, 2026-10-26)

**TEMPORARY Catalog debug screen: removal, after the device run.** **Done
2026-10-27** (device checks passed); the History and Pending Uploads debug
screens stay. Delete
`src/screens/workout_management/CatalogDebugScreen.tsx`; its route in
`src/constants/routes.tsx`; its `Stack.Screen` in
`src/navigation/WorkoutNavigator.tsx`; its tile in `src/screens/WorkoutScreen.tsx`;
`catalogReadCounter` and its two increments in `src/services/db/catalog.ts`. Each
is marked `TEMPORARY`; `grep -rn TEMPORARY src` must then show none of them.

**Landing order (user runs every step, CLAUDE.md 1.3).** ~~build → install →
rules diff + deploy → wipe → upload → checks~~ **Revised (user, 2026-10-26),
after the console diff:** no rules step before the wipe (the `exercise_catalog`
rule is already live); the deploy moves after the wipe, where it removes
`predefined_exercises` and its hard-coded-uid write. Key outside the repo:
`export GOOGLE_APPLICATION_CREDENTIALS=~/.config/fitgram/service-account.json`.
1. Build: `npx eas-cli build --profile preview --platform android` (or the
   usual tester route)
2. Install on **every** tester's phone and open it once (the local clear runs).
   No workouts logged from here until step 4
3. `npx tsx src/scripts/wipeTestData.ts` (dry run: check the uids, counts, "kept")
4. `npx tsx src/scripts/wipeTestData.ts --confirm` (ends "✅ Wiped.", all counts 0)
5. Rules: `npx firebase-tools deploy --only firestore:rules --project gymexerciselogger-fb`.
   Replaces the whole live ruleset; the only change from live is that
   `predefined_exercises` goes. ~~Run between the wipe and the upload~~ **Not run
   in the landing (2026-10-27): the console still has the `predefined_exercises`
   block.** Harmless meanwhile (its docs are wiped; no build reads them). The
   user deploys it after the debug-screen removal commit. **Deployed 2026-10-27**
   after PR #22 merged, as the project owner (the admin service account gets a 403
   on deploys: it lacks `serviceusage.services.get`)
6. `npx tsx src/scripts/uploadCatalog.ts --dry-run` (489 movements, 805 versions, 26.9%)
7. `npx tsx src/scripts/uploadCatalog.ts`
8. Device checks on the Catalog debug screen: first start after upload meta 1 ·
   catalog 1, source `network`, 489 movements / 805 versions; restart meta 1 ·
   catalog 0, `cache`; Manage Workout and back meta +1 · catalog +0; "Clear
   local cache" and restart meta 1 · catalog 1; sign out and in, version
   unchanged, catalog +0. Then the stage B checks (picker, plan save, name
   sites, session doc)

**Console rules diff (user, 2026-10-26)** against the branch's `firestore.rules`:
- `users/{uid}/**` owner-only: identical
- `exercise_catalog` (signed-in read, no client write): identical, **already live**
- The 2025 open rule (`request.time < 2025-08-25`) is commented out and expired.
  Nothing is open now
- Only difference: `predefined_exercises`. Live: read if signed in **and** the
  user doc exists; write for one hard-coded uid. Branch: block removed
- `firestore.rules` is now the source (header says so)

**Stage 2 needs, from TICKET-046:** the real catalog in this shape, passing
`validateCatalog`, with its ids frozen into the pin list; the per-movement
`oneSide` label; each grip version's muscle override. Not run on the hand-made
catalog: the picker would shrink from 42 exercises to 6 movements, and versions
picked on a device would be ids TICKET-046 may not keep.

**Stage 2 decisions (user, 2026-10-25), settled before code:**
- ~~Upload as a signed-in user (`FS_SEED_EMAIL`)~~ **Admin credentials:**
  `firebase-admin` (devDependency, imported only from `src/scripts/`) with a
  service-account key kept **outside the repo**, named by
  `GOOGLE_APPLICATION_CREDENTIALS`. Why: the rule is `allow write: if false`, and
  the wipe must delete under every tester's `users/{uid}`, which no signed-in user
  can under owner-only rules. `src/scripts/firebaseAdmin.ts` refuses a key inside
  the repo or for a project other than `FS_DB_PROJECT_ID`; `.gitignore` also
  ignores `*firebase-adminsdk*.json`, `service-account*.json`,
  `serviceAccount*.json` as a backstop. How the 42 `predefined_exercises` docs were
  written: the 2025-03-09 script (51fd364) used the client SDK **without signing
  in**, so the console rules then allowed unsigned writes. ~~Whether they still do
  is unknown~~ **Answered (console diff, 2026-10-26):** a time-boxed open rule
  (`request.time < 2025-08-25`), now commented out and expired. Nothing is open
- ~~2–3 `chunk_N` docs~~ **One `catalog` doc** beside `meta` (27% of 1 MiB). Reads:
  1 per check, 2 when the hash changed or the cache is empty. The phone caches
  under the **catalog doc's own** `version`, not meta's, so an upload between the
  two reads costs one extra fetch, never a mislabelled cache. Chunk past ~70%
- **Phone-side data:** a one-time local clear keyed on a `localDataVersion` marker
  removes `activeWorkout` and `pendingUploads` before the queue is loaded or
  drained. In stage B (the first build that writes new ids), not C
- **The order to land it**, each step run by the user (CLAUDE.md 1.3):
  ~~1. rules first, 2. install, 3. wipe, 4. upload~~ ~~build → install → rules
  diff + deploy → wipe → upload → checks (2026-10-26)~~ **Revised again (user,
  2026-10-26, after the console diff): build → install on every phone → wipe
  --dry-run → wipe → rules deploy → upload --dry-run → upload → device checks.**
  The `exercise_catalog` rule is already live (the device run's meta read
  succeeded; the diff confirms it), so no rules step is needed before the wipe. Full commands
  under "Landing order" below. **No workouts logged from install until the
  wipe**: the wipe deletes them. Between the wipe and the upload the picker is
  empty and names show "Exercise catalog not loaded yet"; minutes
- **Interim picker:** one flat list of all 805 versions by built name in today's
  `SearchableInputDropdown` (its search is a label substring, so "bench" leaves
  ~20). **Scroll performance with 805 rows is untested on a device.** Rejected:
  movement then version (a second control 043's A3 sheet replaces)
- **Unknown id:** one meta check per app run, from an effect, never from render;
  an id still unknown after it shows the snapshot fallback until the next start
- **Edges:** 043 keeps search, recents, the version sheet and the Manage Workout
  redesign; 047 keeps switching (each logged exercise names itself from its own id
  and snapshot, never the plan's); 048 is done, stage 2 only skips the name rule
  for catalog exercises. `PlanRow` names wrap to 2 lines (board B1). Sign-out
  clears nothing today (TICKET-026 open); a comment at `CATALOG_CACHE_KEY` keeps
  it out of 026's clear
- **Catalog exercises in a plan:** `name: ""`, `nameSnapshot` = the built name;
  plan save skips the name rule when `nameSnapshot` is set (not "id is in the
  catalog", which a later removal would turn into an unsaveable plan). One helper,
  `exerciseDisplayName`, serves every name site. Readers found by renaming the
  field and running `tsc` (making it optional surfaced none):
  - `Exercise.name`: `CollapsibleExerciseList.tsx:34,42`, `PlanRow.tsx:122`,
    `WorkoutHistoricalLogsFilter.tsx:77,208`, `AddExerciseScreen.tsx:53,120,174`,
    `ExerciseHistoryDebugScreen.tsx:52,158`, `exerciseValidations.ts:87,91,96`,
    `useWorkoutStore.tsx:160`, `services/db/exercises.ts:45`, plus the scripts
    (`uploadExercises.ts`, `verifyHistoryReads.ts:153`)
  - `LoggedExercise.name`: `ActiveWorkoutScreen.tsx:143,146,147`,
    `ExerciseHistorySheet.tsx:104`, `exerciseStats.ts:304`,
    `verifyHistoryReads.ts:203`
  - `exerciseName` (session snapshot): `WorkoutHistoricalLogsFilter.tsx:24,31`,
    `exerciseStats.ts:247,300`

**Implementation, stage 2A: the catalog store (2026-10-25).** Nothing reads the
catalog yet; Manage Workout still lists the 42.
- `src/utils/catalogSync.ts` (pure): `planCatalogSync` (cached hash, meta hash →
  fetch or keep), `decideFetchedCatalog` (the `loadCatalog` gate; refuses a doc
  with no hash), `readCachedCatalog` (an unreadable cache is absent)
- `src/services/db/catalog.ts`: the two doc gets. `src/stores/useCatalogStore.ts`:
  cache → memory at app start (`startCatalog`, from `AppControlProvider`), the
  meta check once a user is signed in and on each Manage Workout focus,
  single-flight; a refusal keeps the cache and logs `CATALOG REFUSED …`
- **Refusal loop fixed in review (user, 2026-10-25):** after a refusal the cached
  hash still differs from meta's, so every check re-downloaded and re-refused the
  catalog. Now a meta hash equal to this run's `lastRefusal.version` keeps the
  cache with no fetch and no second log; the next app run tries once more (a
  reinstall may have brought the vocabulary). Test: refuse, check again → 1 read;
  seen red (an extra catalog read)
- `src/scripts/uploadCatalog.ts`: meta + catalog in one batch, SHA-256 `version`,
  skips the write when the hash is already live; refuses a catalog `loadCatalog`
  refuses, arrays inside arrays, or one over 90% of 1 MiB
- `firestore.rules`: `exercise_catalog` read when signed in, no client writes.
  `firebase.json` now names the rules file
- TEMPORARY `CatalogDebugScreen` (behind `SHOW_DEBUG_SCREENS`): version, source,
  reads since start. Removal: the file, its route, Stack.Screen, tile, and
  `catalogReadCounter` in `services/db/catalog.ts`
- **Measured** (mocked Firestore, counted at `getDoc`): app start with an unchanged
  hash 1 read; changed hash 2; empty cache 2; opening Manage Workout 1; two
  unknown-id checks 1 in total. Not measured: the same on a device, against real
  Firestore and real rules
- Tests: 8 in `catalogSync.test.ts`, 6 in `useCatalogStore.test.ts` (the refusal test also covers the loop). Each seen red
  by breaking its line (same hash fetching, the `loadCatalog` gate, a sign-out
  clear, the unknown-id guard, the refusal log, a corrupt cache accepted). The
  sign-out test first passed against a sign-out clear, because a later sync
  refetched; fixed by not syncing after sign-out

**Technical Notes:**
- The research also derives `region`, `push_pull`, `primary_groups` and a `staple`
  tier (`enrich()` in `build.py`). Derive them in code; do not store them
- `staple` (about 100 hand-picked lifts) is a placeholder for ranking ties. Replace
  it with real pick counts once the app records which versions people choose
- Muscle order is data: "glutes" ranks Hip Thrust above Goblet Squat only because
  glutes is listed first on Hip Thrust. Whoever edits the catalog curates it
- Regrouping is mechanical but not automatic: names like "Seated Cable Row" vs
  "Machine Row (Seated)" need a person to say whether they are one movement.
  **Answered by TICKET-046 stage 2 (user, 2026-10-25): one movement, Seated Row**,
  with cable, machine, plate-loaded, band and one-arm cable versions

**Dependencies:** none for the shape. TICKET-046 for the content (stage 1 can ship
the types with a small hand-made catalog). Before or with TICKET-030 (field names).
TICKET-035 for the 349, but this ticket does not wait for it. Blocks TICKET-043.

---

### TICKET-043: Exercise Search and Picker

**Priority:** Medium | **Effort:** Large | **Status: IN REVIEW** (PR open; DONE once
it merges) — split 2026-10-27 into
four tickets, each finished by a device test (user): **043** search + picker,
**050** picker start page, **051** Manage Workout exercise list, **052** Manage
Workout plans. Nothing temporary: each lands in the screens that exist when it does

**Description:**
Today exercise search is `react-native-element-dropdown`'s built-in `search` over the
item label (`SearchableInputDropdown.tsx`), now over 805 built version names
(TICKET-042 stage 2's interim picker): name only, so "chest" cannot find Bench
Press, and "bench" leaves ~20 rows. Replace it with the prototype's search, extended
for typos, and a full-screen picker that shows movements and then asks for the
version. **Opened from today's Manage Workout screen**, in place of its Exercise
dropdown: the picker returns the same plan exercise the dropdown does
(`planExerciseFromPick`), so the field editor and Save work unchanged. TICKET-051
rebuilds the screen around it later.

**Search rules the prototype settled** (each is a bug it hit):
- **Word-prefix match, not substring.** Substring made "rdl" match **Hurdle** Hop.
  Prefixes keep partial typing working ("bulg", "incl db")
- **Muscle words score from muscle data only, never from the name.** Otherwise
  "chest" ranks **Chest**-Supported Row as a chest exercise
- **Muscle phrases before word split.** Splitting `side_delts` made "side" a muscle
  word, and "Side Plank" returned 0. Phrases: "upper chest", "rear delts", "lower
  back", "inner thigh"
- **Plural folding.** 10 of today's 42 names ("Deadlifts", "Pull-Ups") returned 0
  before it
- **Scoring:** first primary muscle 10, other primary 8, secondary 1; name word 10,
  alias 8, equipment/pattern/category 4; exact name +30, exact alias +25; staple +3
- **An exact name or alias match is always a result.** "grip" is a synonym for
  forearms, so "neutral grip fly" returned nothing until this rule
- Synonyms and slang: "db", "kb", "ohp", "hammies", "bis", "tris", "wings"
- AND across axes: "dumbbell chest" means both
- **New with movements:** results are one row per movement, not seven bench presses.
  Equipment in the query ("db bench") preselects that version

**Still failing in the prototype** (measured 2026-10-23 with `search()` in
`build.py`, all from the user's own notes):

| Typed | Should find | Result today |
|---|---|---|
| "Latpulldown" | Lat Pulldown | 0 results: words joined |
| "push down", "kick back" | Pushdown, Kickback | 0 results: word split ("pull down" works, because "Pulldown" starts with "pull") |
| "Incliend", "squad", "Cabled" | Incline, Squat, Cable | 0 results: typo |
| "bech press", "dumbell curl" | Bench Press, Dumbbell Curl | 0 results: typo |
| "low to high fly" | Low-to-High Cable Fly | Ties with High-to-Low (score 40 each); High-to-Low lists first. Word order is ignored |
| "push day" | push exercises | 0 results: no split vocabulary |

**The picker (this ticket):** movement, then version. Pick Bench Press, then
Barbell / Dumbbell / Smith / Machine. A movement with one version skips this step.
Recents, filter menus and "last used" preselection are TICKET-050.

**Acceptance Criteria:**
- [ ] `searchExercises(catalog, query, limit)` is a pure exported function
- [ ] The 91 cases in `search_cases.py` become a Jest table test, rewritten to expect
      movements. Break one rule at a time (prefix → substring, muscle words from
      the name) and watch its cases go red
- [x] Every row of the failing table above passes and is a test case (stage 2,
      2026-10-27)
- [ ] Typo tolerance: edit distance 1 for words of 4 or 5 letters, 2 for longer;
      thresholds pinned in a comment. Short words stay exact, or "row" starts
      matching "rod". A fuzzy match always ranks below an exact or prefix match
- [ ] Joined and split words: also compare with spaces and hyphens removed
- [ ] Negatives fuzzy matching could break: "row" ~~(45 results today)~~ and "curl"
      ~~(61)~~ keep their current top results. **Baselines re-measured on movements
      (2026-10-27, end of stage 1)**: the 45/61 were the flat research catalog. Stage
      2 pins these: "row" 19 results, top 5 Bent-Over Row, Chest-Supported Row,
      Rear Delt Row, Seal Row, Seated Row; "curl" 27 results, top 5 Bicep Curl,
      Floor Hamstring Curl, Hammer Curl, Lying Leg Curl, Preacher Curl
- [ ] Custom exercises and the user's plan exercises are searched too, by name only
- [x] Decided: does "machine" include Smith Machine? Does "back" include Back Squat?
      (The prototype says no to both.) **No to both (user, 2026-10-27)**; see
      Decisions below. "back" still lists Low-Bar Back Squat far down, for its
      secondary lower back (score 1), never for "Back" in its name
- [ ] Empty query, until TICKET-050 adds Recent: every movement A–Z, so browsing
      works (default chosen 2026-10-27; the user can overrule it)
- [ ] Picker built from TICKET-041 boards A2–A4, opened from today's Manage Workout
      in place of the Exercise dropdown. 4 or 5 tests on its main behaviours
- [ ] Measured: search time per keystroke over the full catalog, on a device.
      Measured in Hermes on a laptop instead (benchmark below); a phone is not
- [ ] Guided tour: deferred to TICKET-053 (user, 2026-10-27)
- [ ] Delivered in stages (CLAUDE.md 3.4): 1. the search function and its tests;
      2. typos and joined/split words; 3. the picker screen
- [ ] **Device test (done when it passes):** Manage Workout → choose a plan → open
      the picker → "bech press", "Latpulldown", "chest", "db bench" each return the
      expected movements → pick Bench Press → choose Dumbbell, incline (a
      combination already in the plan is disabled) → edit fields as today → Save.
      The plan shows the built name; Start Workout logs it

**Design, the picker** (TICKET-041 group A, `design/workout-flow/project/Find*.dc.html`;
chosen by the user 2026-10-24). A full screen, not a dropdown. A1 (the empty-query
page) is TICKET-050:
- **A2, results (chosen).** One row per movement: name, then the main muscle
  followed by the others ("Chest · triceps, front delts"), and a count ("19
  versions") only when there is more than one. Rejected: A2b, the first few versions
  named ("Barbell, Dumbbell, Smith, Machine +4"), a third line on every row.
- **A3, the version step (chosen).** Tapping a movement with versions opens a sheet:
  Equipment, and Angle where the movement has one. The version used last is
  preselected and marked "last" (**TICKET-050**; until then nothing is preselected);
  equipment typed in the query ("db bench") preselects that version instead
  (this ticket). A combination that does not exist (Band ×
  Incline) is disabled, not hidden. One version: no sheet. A cable movement gets an
  Attachment row (Rope / Straight Bar / V-Bar), shown only for Cable. **Incline is
  an angle of Bench Press**, so Bench Press has about 20 versions (TICKET-042 records
  it). Rejected: A3b, Incline Bench Press as its own movement (three search rows of
  8, 6 and 5 versions, a simpler sheet).
- **A3, grip (user, 2026-10-24, after the PR #17 review).** Grip is a version axis, shown as a third row (Normal / Close /
  Reverse / Neutral, unavailable ones disabled; `VersionGrip.dc.html`). Every pick
  in the sheet together is the version (TICKET-042). No Extras row: dropped for the
  MVP. Which axes a movement has comes from the catalog (TICKET-046). Rejected:
  grip and extras as tags (`ManageTags.dc.html`)
- **The version is not editable in Manage Workout** (user, 2026-10-24, after the PR #17 review). Equipment, angle and grip
  are treated alike: none can be changed on a plan exercise; to change one, remove
  the exercise and add the other combination. The expanded row edits fields and
  units only. A plan may hold two combinations of one movement (bench and
  close-grip bench, `VersionPlan.dc.html`). A change for one workout only is
  TICKET-047
- **A4, typo.** No special state and no "did you mean": results come back, headed
  "Close matches" when every one is a fuzzy match.
- **A4, no results.** "No exercise matches", why (every word must match) and a
  suggestion (fewer words, the movement, a muscle). Nothing to create (above).
- Names with a version are drawn as "Movement · Version" as a stand-in; group B
  settles the format.
- **No new custom exercises, for now (user, 2026-10-24).** The catalog is the only
  source: either the exercise is in it or there is nothing to add. Today's "New"
  switch on the Exercise picker goes and is not replaced. Why: 878 entries cover
  every exercise in the user's own notes, and one source means one id scheme, real
  muscles for search, and no typo saved as an exercise. Existing custom exercises
  in plans and history keep loading, logging and showing; search still finds them
  by name. A machine the catalog lacks is logged as the closest catalog movement,
  plus a field ("Seat"). TICKET-045 reopens custom exercises

**Technical Notes:**
- Typo options: Fuse.js, or Damerau-Levenshtein only on words that missed. The
  catalog is small enough for either
- The picker is its own list (it needs the version step); `react-native-element-dropdown`'s
  `searchQuery` is a yes/no filter per label and cannot rank (checked 2026-10-27)
- "push day", "leg day", "upper body" need a split vocabulary mapping to pattern +
  region. In scope if small; otherwise split off. **In scope (user, 2026-10-27)**:
  filler words plus two region phrases, below
- Later idea, not in scope: a "my gym" equipment profile that hides versions the user
  has no equipment for

**Decisions (user, 2026-10-27), before code:**
- **The 91 cases** are rewritten to movement ids through `src/catalog/ACCOUNTING.md`:
  91/91 targets exist; none dropped. 16 cases that name equipment or an axis gain
  an expected preselection. Top-N is tightened to 1 only where the query is the
  movement's exact name or alias, never to the rank today's catalog happens to
  give (a new movement would break unrelated cases). Tightened, 3 → 1: Bicep
  Curls, Treadmill, Cycling, Lunges, Leg Raises, Chest Flys, Reverse Lunges,
  Step-Ups, bss. "upper chest" used to expect the incline entry; it now expects
  Bench Press and no preselection (no axis is typed). The scratch mapping stays
  out of `src/`; the Jest table is the record
- **Staple +3, derived:** a movement with more than one version, no catalog field;
  a proxy until real pick counts exist (TICKET-042). Measured on the 91: dropping
  the rule fails 9 cases, this proxy 2, the research's hand-picked 96 fail 1
- **Equipment words are an explicit table:** "machine" → machine, plate-loaded
  machine, assisted machine; "smith" → Smith machine. Not label words
- **"back" does not mean Back Squat**; muscle words score from muscle data only
- **"push day" / "leg day" in scope:** "day" and "workout" are filler; "upper body"
  and "lower body" are regions. Split off if it grows past ~5 lines and 3 cases
- **Typos (stage 2):** hand-written Damerau-Levenshtein on words that matched
  nothing; 1–3 letters exact, 4–5 one edit, 6+ two. A fuzzy match always ranks
  below exact and prefix matches, with a test that breaks if not. Joined and split
  words: compare with spaces and hyphens removed
- **Custom exercises** come from the user's plans, one per id, name words only,
  second line "Custom". Unit test only: after the 2026-10-26 wipe no device has
  one, and none can be created (TICKET-045)
- **Preselection: any axis named in the query** (equipment, angle, attachment,
  grip, one side), when that combination exists
- **The sheet (stage 3):** Equipment starts empty; Angle and Grip start on their
  defaults (Flat, Normal). After equipment is picked, an axis whose default does
  not exist for that equipment moves to its only valid value, or stays empty when
  there are several. Today: `bench_press__ez_bar__close_grip`,
  `triceps_pushdown__cable__reverse_grip`, `sit_up__weight_plate__decline`, each a
  test case. A combination that does not exist must never be reachable
- **"In plan":** a single-version movement already in the plan shows "In plan",
  row disabled (board A2), in this ticket
- **Left out of the boards:** the filter row (TICKET-050), the Extras row and the
  Wide grip (dropped), "19 versions" (Bench Press has 26)

**Decision, the search vocabulary (user, 2026-10-27, after stage 1's first draft):**
the first draft hard-coded every search word in `exerciseSearch.ts`. Rejected: it
copied the labels already in `catalogVocabulary.ts`, and every new slang word
needed an app build. Now:
- **Derived, stored nowhere:** every muscle, muscle group, equipment, angle,
  attachment, grip and one-side label is a search word ("upper chest", "smith
  machine", "close grip", "one arm")
- **Slang in Firestore:** `exercise_catalog/search_words { version, words }`,
  source `src/catalog/searchWords.ts`, uploaded by `uploadCatalog.ts` in the same
  batch as the catalog. 57 entries, ~1.7 KB: muscle groups ("pecs"), muscles
  ("hammies", "inner thigh"), equipment ("db", "machine" → three machines), axes
  ("hammer grip", "single arm"). A slang entry overrides a derived one
- **Its own doc and hash** (`meta.searchWordsVersion`). Rejected: a field in the
  catalog doc, which re-downloads 282 KB for one new word and lets one bad word
  block a catalog update. Another name for one exercise ("rdl", "gravitron") is
  not slang: it stays an alias in the catalog
- **Fetching:** no new read. The existing meta read (app start once signed in,
  each Manage Workout open, one unknown-id check per run) carries both hashes;
  each doc is fetched only when its own hash changed, then cached on the phone
  (`exerciseSearchWords`). Not uploaded yet, or refused: search knows the labels
  only; slang finds nothing until it loads
- **Refusal:** `loadSearchWords` refuses the whole doc if any entry names a key
  this build lacks ("pecs" → "chets"), logs `SEARCH WORDS REFUSED`, keeps the
  cached words, and never blocks the catalog (and the reverse)
- **Upload writes only what changed:** meta always (both hashes); `catalog` and
  `search_words` only when their own hash differs from live. Dry run today: catalog
  hash unchanged, so a real run writes `search_words` and meta only
- **Stays in code (rules, not words):** "day"/"workout" as filler, "upper/lower
  body" regions, "stretch"/"warmup" → category, "cardio" never a muscle word,
  "abs" also counting the rest of the core
- **Rules deploy: none needed.** The live rule is `match /exercise_catalog/{docId}`
  (signed-in read, no client write), which covers the new doc

**Landing step: the search-words upload (user, 2026-10-27).** Run by the user from
the merge commit, before stage 3's device test (CLAUDE.md 1.3):
1. `npx tsx src/scripts/uploadCatalog.ts --dry-run`: catalog hash `889393c5…`
   (unchanged from live), search words `888ae196…`, `loadSearchWords: ok`
2. `npx tsx src/scripts/uploadCatalog.ts`: expect "catalog unchanged, search words
   written"
Builds without this ticket never read `search_words`, so the upload is safe before
or after the build reaches phones.

**Stage 3 device test plan must include (user, 2026-10-27):**
- before the first sync on a fresh install (or offline with no cached search
  words): search works with labels only ("upper chest", "smith squat"); slang such
  as "pecs" or "db" finds nothing beyond name matches
- after the first sync: "db bench" lists Bench Press with Dumbbell preselected,
  which proves `search_words` arrived

**Implementation, stage 1: the search function (2026-10-27).**
- `src/utils/exerciseSearch.ts`: `searchExercises(catalog, query, limit)` returns
  `{ results, total }`, one row per movement (or custom exercise), each movement
  with the `preselect` its query names. **Deviation from the criterion's
  signature:** `catalog` is a `SearchCatalog` from `buildSearchCatalog(movements,
  searchWords, custom)`, built once per catalog (2.2 ms in Node), so no word list
  is rebuilt per keystroke. `customExercisesFromPlans(plans)` feeds it
- Search words (decision above): `src/catalog/searchWords.ts` (source, never
  imported by app code), `src/utils/searchWords.ts` (loader), `catalogSync.ts`
  (`decideFetchedSearchWords`, `readCachedSearchWords`), `services/db/catalog.ts`
  (`fetchCatalogMeta` returns both hashes, `fetchSearchWordsDoc`),
  `useCatalogStore` (`searchWords`, `searchWordsRefusal`), `uploadCatalog.ts`
- **Rules added in stage 1, each stated where it is implemented:**
  - equipment and axis words score from version data (4); only a word no version
    has falls back to the name ("reverse" in Reverse Lunge). Rejected: name first,
    which put Cable Lat Prayer and Cable Shrug-In above Seated Row for "cable back"
  - ties: score, category, **compound before isolation** (a muscle search wants the
    main lift before its accessories), name. This is the one-line rule that fixed
    "db shoulders" (6th → 3rd); no other case changes result
  - preselection: an exact version alias picks that version ("hex bar deadlift",
    "12-3-30"); otherwise named values the movement has; a value it lacks is
    dropped; an equipment word naming two of its equipment picks neither; a
    combination no version has preselects nothing
  - a word of 4+ letters that is an unambiguous prefix of an equipment or axis
    word names it ("incl" → incline)
- **Known failing case: "rear delts"** wants Reverse Pec Deck in the top 5; it is 6th,
  tied at 10 with Band Pull-Apart (sorted by name) and with no staple (one
  version). No ranking rule with a reason fixes it; it is a `test.failing` row,
  which turns red the day it passes
- **Tests** (`exerciseSearch.test.ts`, 99): the 91 cases (90 pass, 1 known
  failing), 5 rules, 2 custom, 1 staple. Each rule broken in turn, with what went
  red: prefix → substring: "rdl" ✗ Hurdle Hop; muscle words from the name: both
  "chest" negatives and the Back Squat check; no phrases: inner thigh, hex bar,
  push/leg day ("rear delts" starts passing); no plural fold: 10 cases (Deadlifts, Pull-Ups, Face Pulls…); no
  exact rescue: "cable standing neutral grip fly"; equipment from name first:
  "cable back"; no staple: 5 cases (Triceps Dips, core, glutes, db
  shoulders, bodyweight chest) and the staple test ("rear delts" starts passing); no compound-first: "db
  shoulders"; no filler: push/leg day; Smith in "machine"; keeping an axis the
  movement lacks; offering a missing combination; no version-alias pick
  (gravitron, 12-3-30); custom exercises keeping catalog ones or matching muscles.
  A "one row per movement" test was dropped: no break turned it red
- **Search words tests (5):** labels work with no search words loaded and slang
  needs them (`exerciseSearch.test.ts`); the loader accepts the source and refuses
  "chets", "hover_board" and a "wide" grip (`searchWords.test.ts`, 2); a new slang
  word reads meta + `search_words` only, never the catalog, and a third check reads
  meta only; refused words keep the old ones and the catalog still updates
  (`useCatalogStore.test.ts`, 2). Seen red: no derived muscle labels; slang
  ignored (8 red, incl. "pecs", "db shoulders", "hex bar"); loader skipping
  muscles; search words fetched every sync (also turns 4 existing read-count tests
  red: with no `searchWordsVersion` in meta it would read a missing doc each time);
  catalog refetched on any hash change; a words refusal blocking the catalog. All 21
  rule breaks re-run after the move: each still red
- **Per keystroke (Node 25, M1 Pro, full catalog, 1,960 keystrokes typing 7
  queries):** median 0.047 ms, p95 0.107 ms, max 0.78 ms. Device: stage 3
- Not verified: anything on a device; custom exercises against real plans

**Implementation, stage 2: typos, joined and split words (2026-10-27).** All in
`src/utils/exerciseSearch.ts`; each rule is commented where it is implemented.
- **Typos only for a word that matched nothing** (not a vocabulary word, not a
  prefix of any catalog word). Hand-written Damerau-Levenshtein (optimal string
  alignment: a swap of two letters is 1 edit), with an early stop past the limit.
  Thresholds as decided: 1–3 letters none, 4–5 one, 6+ two. Compared with the whole
  word and with its start of the same length, so a typo mid-typing counts ("dumbe"
  → dumbbell). Only the closest candidates are kept
- **A correction becomes a vocabulary word only when it is the only candidate**
  ("dumbell" → dumbbell, which preselects; "incliend" → incline; "cabled" →
  cable). "squad" is 1 edit from both "squat" and "quad"; turning it into the quads
  muscle hid Squat, so it matches either word in names instead
- **A corrected query can be an exact name** ("bech press" = Bench Press, "squad" =
  Squat), and still counts as fuzzy
- **Fuzzy results always sort after every exact or prefix result**, whatever their
  score (sort key first, then score). `fuzzy` is on each result for A4's "Close
  matches" header (stage 3)
- **Joined words:** a typed word may run across several name or alias words from
  a word boundary ("latpulldown" → Lat Pulldown). Boundaries keep "rdl" out of
  Hurdle
- **Split words:** only when the words fail one by one, each adjacent pair is
  tried run together, and must match inside ONE word ("push down" → Pushdown,
  "kick back" → Kickback). Across words it brought Smith back into "machine
  squat" through the alias "smith machine squat" (caught by stage 1's test)
- **Word order:** +2 when the query's name words appear in the name's own order.
  "low to high fly" now ranks Low-to-High (42) above High-to-Low (40); they tied
  at 40 in the prototype
- Custom exercises get typo correction too (name words only)
- **Negatives, pinned to stage 1's baselines:** "row" 19 results and "curl" 27,
  same top 5, no result fuzzy. What protects them is "closest candidates only": a
  word that matches something is 0 edits from itself. The `knownPrefixes` check is a
  shortcut that skips the dictionary scan; removing it changes no result. "row" is
  3 letters, so it is never corrected (the "rwo" test)
- **"rear delts" stays a known failing case**: no stage 2 rule touches it
- **Tests** (17 new, `exerciseSearch.test.ts` now 117): one case per row of the
  failing table, plus "bnech press" (swap) and "dumbe bench" (mid-typing); "Cabled"
  preselects cable on every result; word order; the two negatives; short words
  exact; fuzzy below exact on a two-movement catalog where the fuzzy one scores
  higher. Seen red, by breaking: no typo correction (8 red); edits for 3-letter
  words; no swap; no mid-typing compare; fuzzy not sorted last; no joined words;
  no split words (4); split matching across words ("machine" test); no order bonus
  (2); any vocabulary candidate wins ("squad"); no corrected exact ("squad"); early
  stop one edit too soon (6); correcting matched words and keeping every candidate
  within the limit (30 red, "curl" among them)
- **Per keystroke** (Node 25, M1 Pro, full catalog, slang loaded): normal typing
  (7 queries, 1,960 keystrokes) median 0.18 ms, p95 0.43–0.71 ms; typo typing (8
  queries from the table, 1,920 keystrokes) median 0.53 ms, p95 1.1–1.2 ms. Stage
  1 was 0.05 ms median: the joined-word check reads every alias. Max per keystroke
  varied 1.6–26 ms between identical runs (GC or JIT), so it is not reported as a
  stable figure. Building the index: 3.6–4 ms (was 2.1, the prefix set). Device:
  stage 3
- Not verified: anything on a device

**Refactor after stage 2: the text layer split out (user, 2026-10-27).** Asked: is
the typo and word matching tied to muscles and axes, or reusable? It was pure but
lived in the exercise file. Now:
- `src/utils/textSearch.ts` knows nothing about exercises: `stem` / `stemmed` /
  `normalized`, `editDistance`, `maxTypoEdits`, `buildTextDictionary` +
  `correctWord` (thresholds, closest candidates only, mid-typing), `wordAt` /
  `wordsAt` (prefix and joined words), `matchWithSplitWords`, `inOrder`,
  `equalsWithCorrections`, `fuzzyLast`. For a later search over plans, logs or
  custom exercises (TICKET-045). ~~TICKET-052~~ removed (user review, 2026-10-27):
  052 is New plan / First plan and has no search
- `exerciseSearch.ts` keeps what is exercise-specific: the vocabulary, muscle and
  equipment scoring, preselection, staple and tie-breaks, and what a correction
  means (a sole vocabulary candidate becomes that word)
- Rejected: a configurable engine taking "axes" and weights. The hard part is the
  exercise rules, which do not carry over; it would be designed for one user
- **No behaviour change:** the 117 search tests pass with one line changed (the
  `maxTypoEdits` import moved). Timing within noise: normal typing median
  0.19 ms, typo typing 0.52–0.62 ms
- **Contract tests** (`textSearch.test.ts`, 4, on small word lists, not the catalog).
  Seen red, by breaking: 3-letter edits, no swap, early stop too soon, no
  known-prefix guard, every candidate within the limit (caught only after adding
  "dumbell" vs "dumbbells"), no mid-typing compare, substring instead of prefix,
  joined words where one word is asked, split retry before the words as typed
  (caught only after adding a name where both readings match), any order counted
  as in order

**Implementation, stage 3: the picker (2026-10-27).**
- **Files:** `components/exercise_picker/ExercisePicker.tsx` (A2, A4),
  `components/exercise_picker/VersionSheet.tsx` (A3), `utils/versionSheet.ts` (the
  sheet's rules, pure). `AddExerciseScreen` swaps the Exercise dropdown and its New
  switch for an Exercise button that opens the picker; a pick goes through the same
  `handleSelectExercise`, so the field editor and Save are unchanged.
  `catalogPlanExercises` (042's 805-row list) is replaced by
  `planExerciseForVersion` (one version)
- **An overlay inside Manage Workout, not a route and not an RN `Modal`.** The tour's
  overlay is mounted at the app root, so a `Modal` would cover it and the picker's
  tour steps could never show. Rejected: a stack route (the pick would travel back
  through navigation params). Android back closes the sheet, then the picker
- **Rows:** name; the main muscle, then up to three others ("Chest · triceps, front
  delts"); "N versions" when more than one; "In plan" and disabled for a
  one-version movement already in the plan; "Custom" for a custom exercise. Empty
  query: all 489 movements A–Z (custom exercises are found by search only). Up to
  100 results. "Close matches" only when every result is fuzzy; "No exercise
  matches" with board A4's hint
- **Search box fixed at the bottom, under the list** (user, 2026-10-27, after the
  first device run; board A2 had it at the top). Within thumb reach; it rides on the
  keyboard (iOS `KeyboardAvoidingView` padding; Android none, the window already
  resizes). The list stays top-down, not inverted, so A–Z and the best match start
  at the top. Its tour tooltip shows above it
- **Opening was visibly slow (device, 2026-10-27).** The picker unmounts on close,
  so every open rebuilt the search catalog (Node 4–7 ms; under Jest two builds took
  ~500 ms, so Hermes without a JIT is plausibly far slower) and sorted 489 names with
  `localeCompare` (on Hermes, the platform collator per comparison). Now
  `preparePicker` builds both once per catalog, words and custom list and keeps
  them; Manage Workout warms it after its screen settles
  (`InteractionManager.runAfterInteractions`); A–Z compares lowercase names with `<`
  (names are ASCII; same order as `localeCompare` for all 489, checked); the list
  first renders 12 rows, not 20 (about 9 fit). Rejected: keeping the picker always
  mounted and hidden (its list would render with Manage Workout every time).
  ~~The TEMPORARY line now also shows "open N ms"~~ (removed 2026-10-27; the
  benchmark below replaces it). Not measured: the tap itself, rendering, and Manage
  Workout's re-render
- **Soft axes start from their default each settle** (user review, 2026-10-27).
  Before, a soft axis kept its value while it still fitted, so a value forced by one
  choice outlived it: Bench EZ bar → Barbell kept Close grip; EZ bar → Dumbbell
  emptied Grip; Front Raise Dumbbell → Cable kept Attachment None and added the
  no-attachment version unasked. Over all 1,114 movement × equipment switches, 13
  differed from a fresh sheet; now 0. All 805 versions still reachable; Pushdown
  Cable+None → `one_side` and Cable+Reverse → `reverse_grip` unchanged. Test seen
  red on the old code, each half on its own
- **The sheet, beyond what was settled (CLAUDE.md 2.6, said here, not silently):**
  - **A Side row (Both / One arm or One leg).** 35 movements have one-side versions
    next to two-sided ones; without the row they could not be added. Shown only
    where sides differ, like the version names. Starts on Both
  - **"None" in the Attachment row.** Triceps Pushdown, Front Raise and Straight-Arm
    Pulldown have cable versions with no attachment (Pushdown's reverse-grip and
    one-arm versions)
  - **A row shows only where the movement's versions differ on it**, Equipment
    included: Cable Crossover (two cable versions) shows Side only
  - **Soft axes settle in row order, each narrowing the next.** With independent
    settling, Pushdown with Cable and None chosen showed Cable, None, Normal, Both,
    which no version has. Now: whenever every row has a value, that version exists
  - **Defaults never disable an option:** only tapped or typed axes do. Otherwise
    Grip starting on Normal would disable EZ bar on Bench Press
  - **Add says "Already in this plan"** when every version with the chosen values is
    in the plan ("incline db bench" when that one is), not "Choose grip"
- **Guided tour:** `EXERCISE_SEARCHABLE` → `DROPDOWN_BUTTON` keeps its id, now on the
  Exercise button (title "Add an Exercise"), so the tour's order is unchanged. New:
  `EXERCISE_PICKER` → `SEARCH_BOX` (the picker's search box) and → `VERSION_SHEET`.
  Checked by reading every step id in `manageWorkout.ts` against what renders it: the
  Workout dropdown's `NEW_BUTTON` / `INPUT_AND_SAVE` still exist (052 moves them); the
  Exercise dropdown had only `DROPDOWN_BUTTON`. The sheet step shows the tour's "not
  visible" note until a movement with versions is tapped. Not run on a device.
  **The tour was not verified; it is deferred to TICKET-053** (user, 2026-10-27).
  These step ids stay as input for 053
- ~~**TEMPORARY timing line** (CLAUDE.md 3.3), only with `SHOW_DEBUG_SCREENS`~~
  **Removed 2026-10-27** (user): replaced by a benchmark kept in the repo, below
- **Benchmark (2026-10-27, user asked for a kept baseline and a regression check).**
  `npm run bench:search` (`src/scripts/benchmarkSearch.ts`) times the picker's own
  code: `preparePicker` (index + A–Z, what opening builds) and `searchExercises` once
  per keystroke (the picker searches on every change, no debounce) over stage 1's 7
  normal queries (98 keystrokes) and stage 2's 8 typo queries (79). Two engines:
  Node (V8, JIT) and the Hermes CLI React Native ships, as -O bytecode like a
  release build. Each figure is the fastest of 5 timings, median of 3 runs: single
  runs differed up to 4.6× at p95 (GC, other processes); now within ~6%. Baseline in
  `benchmarks/exercise-search.json` (M1 Pro, at `b8c58a7`):

  | | Node | Hermes |
  |---|---|---|
  | Open: index + A–Z, median | 2.2 ms | 21 ms |
  | Open: first call in a fresh process | 2.5 ms | 22 ms |
  | Search, normal: median / p90 / p95 | 0.20 / 0.48 / 0.53 ms | 2.5 / 5.3 / 5.5 ms |
  | Search, typo: median / p90 / p95 | 0.26 / 0.79 / 0.83 ms | 3.3 / 7.3 / 7.7 ms |

  Hermes is ~10× Node, which fits the slow open seen on the device before
  `preparePicker` was cached and warmed. `--check` exits 1 when the open median or a
  search p95 passes 1.5× the baseline. Seen red: rebuilding the typo dictionary per
  search (1.53–1.86× on three figures); green again after restoring (all within 5%).
  Not caught: removing `editDistance`'s early stop (1.43× at most), so a slowdown
  under 1.5× passes. Local only, not in CI (timing on a shared runner is noise; the
  Linux Hermes package has no `hermes` binary), and only comparable on the machine
  that wrote the baseline: it warns when the CPU differs. **Not measured:** a phone
  (slower than a laptop by a factor this does not know), React rendering the list,
  the tap to first frame, GC pauses (the fastest-of-5 drops them), and the Android
  collator `localeCompare` used to go through (the Hermes CLI's is not the phone's)
- **Tests** (9 new): `versionSheet.test.ts` (4): every one of the 805 versions can be
  added by tapping only enabled options and lands on itself; the three versions with
  no default (EZ bar → Close, weight plate → Decline, Pushdown Cable + Reverse →
  None) and Cable + None settling on the one-arm version; opening state, a query's
  preselection, Attachment only for cable; Band × Incline and an in-plan combination
  disabled. `ExercisePicker.test.tsx` (4): A–Z, one row per movement, muscle line,
  version count, Custom; "db bench" preselects Dumbbell and Add returns
  `planExerciseForVersion`; In plan (row and combination, "Already in this plan");
  Close matches / Exercises / No exercise matches. `AddExerciseScreen.test.tsx` (1):
  the Exercise button opens the picker and a pick fills the field editor. Seen red,
  15 breaks: settling without narrowing (caught only after adding the Cable + None
  case), no fallback, defaults disabling options, Attachment for any equipment,
  in-plan versions allowed, no Side row, preselection ignored, A–Z unsorted,
  preselection not passed to the sheet, no In plan row, no Close matches, no Custom
  line, "Choose grip" instead of "Already in this plan", picker left open after a
  pick, the pick labelled by id
- Not verified: anything on a device (plan below); custom exercises on a device

**Stage 3 device test plan (user runs, CLAUDE.md 1.3).** Build from this branch with
`SHOW_DEBUG_SCREENS=true` (the timing line).
0. **Before the upload** (the new build, `search_words` not yet live): Manage Workout
   → Exercise → "upper chest" lists Bench Press (labels work); "pecs" lists Pec Deck
   by name but not Bench Press (slang not loaded)
1. **Landing step:** `npx tsx src/scripts/uploadCatalog.ts --dry-run` (catalog
   `889393c5…` unchanged, search words `888ae196…`), then the real run (expect
   "catalog unchanged, search words written"). Open the app once, signed in
2. **Search words arrived:** "db bench" → tap Bench Press → Dumbbell is preselected.
   "pecs" now lists Bench Press
3. **The ticket's device test:** Manage Workout → choose a plan → Exercise → "bech
   press", "Latpulldown", "chest", "db bench" each list the expected movement →
   Bench Press → Dumbbell, Incline → edit fields as today → Save. Then Exercise →
   "db bench" → Bench Press: Incline is disabled (already in the plan) → back. The
   plan shows "Bench Press · Dumbbell, incline"; Start Workout logs it
4. "dumbell curl" is headed "Close matches" (the equipment word itself was
   corrected); "curl" is headed "Exercises"
5. The sheet: Bench Press → EZ bar → Grip moves to Close; Sit-Up → Weight plate →
   Angle moves to Decline; Triceps Pushdown → Cable → Attachment row appears →
   Grip Reverse → Attachment moves to None; Lateral Raise → Cable → Side One arm →
   Add reads "Lateral Raise · Cable, one arm"
6. **Timing:** ~~report the timing line~~ (removed; see Benchmark above). On the
   device, only: does typing feel instant, and does opening the picker still feel
   slow? Say which build (dev builds are several times slower)
7. **Scroll:** with an empty query, fling through all 489 movements A–Z: no blank
   rows or stalls
8. Android back closes the sheet, then the picker
8a. **Bottom search box:** tap it: the keyboard opens and the box sits just above it,
   not under it; the last list rows are not hidden behind the box
9. **Tour:** not required, see TICKET-053; note anything broken for it
- **Cannot be covered on a device:** custom exercises (none exist since the
  2026-10-26 wipe, and none can be created until TICKET-045); unit test only
- ~~After the run: remove the TEMPORARY timing line~~ Removed 2026-10-27

**Dependencies:** TICKET-042. TICKET-041 boards A2–A4.

---

### TICKET-050: Picker Start Page — Recents, Filters, Last-Used Version

**Priority:** Medium | **Effort:** Medium | **Status: OPEN** — split from TICKET-043
2026-10-27

**Description:**
What the picker shows before anything is typed, and what it remembers. Most
searches are for something already logged, so the empty query lists those first;
filter menus answer "chest exercises with dumbbells" in two taps; the version
sheet preselects the version used last.

**Acceptance Criteria:**
- [ ] Empty query shows **Recent** (board A1), replacing TICKET-043's A–Z list
- [ ] Recents come from data the app already has (history by `exerciseId`, mapped
      to its movement through the catalog), with no Firestore read per keystroke
- [ ] Filter menus Muscle / Equipment / Type (muscle group × equipment ×
      category), combinable with a typed query (AND)
- [ ] The version sheet preselects the version used last, marked "last"; equipment
      typed in the query ("db bench") still wins
- [ ] A recent single-version movement is added at once, or reads "In plan"
      (disabled) when it is already there
- [ ] Guided tour: deferred to TICKET-053 (user, 2026-10-27)
- [ ] 4 or 5 tests on the main behaviours, each seen red
- [ ] **Device test (done when it passes):** log one workout (the 2026-10-26 wipe
      emptied history) → open the picker → its movement is under Recent with the
      combination and date → tap it, the sheet has that combination preselected →
      filter Chest + Dumbbell, only matching movements remain

**Design** (TICKET-041 group A, chosen by the user 2026-10-24):
- **A1, empty query (chosen).** Search box focused; one row of three filter menus,
  Muscle / Equipment / Type; then **Recent**: **movements** the user has logged,
  newest first, never one row per combination (user, 2026-10-24, after the PR #17 review). The second line is the
  combination last logged and its date ("Barbell, close grip · 22 Oct"). Tapping
  opens A3's sheet with that combination preselected (`VersionRecent.dc.html`); a
  single-version movement is added at once, and reads "In plan" (disabled) if it
  is already there. In the sheet, a combination already in the plan is disabled.
  This settles the empty-query criterion above: recents. Rejected:
  A1b, muscle groups as chips in view, which made muscle one tap instead of two but
  cost a second row.

**Dependencies:** TICKET-043.

---

### TICKET-051: Manage Workout — Exercise List and Save Changes

**Priority:** Medium | **Effort:** Medium | **Status: OPEN** — split from TICKET-043
2026-10-27 (scope TICKET-041 added to 043, confirmed by the user 2026-10-24)

**Description:**
Rebuild Manage Workout's exercise part from TICKET-041 group C1: the plan's
exercises as a list on the screen, edited in place, with one Save changes. Plan
selection stays as it is today (TICKET-052 changes it).

**Acceptance Criteria:**
- [ ] The plan's exercises are a list, one collapsed row each with its fields and
      unit ("Weight kg · Reps"); tapping expands the field editor (rename, role,
      unit, remove a field, add one) and a trash button for the exercise. Replaces
      "Existing Exercises" / `CollapsibleExerciseList`
- [ ] A dashed **Add exercise** button under the list opens TICKET-043's picker;
      the exercise arrives expanded with its catalog fields
- [ ] One footer button, **Save changes**, for the plan
- [ ] The version is not editable here (see Design)
- [ ] Guided tour: deferred to TICKET-053 (user, 2026-10-27)
- [ ] 4 or 5 tests on the main behaviours, each seen red
- [ ] **Device test (done when it passes):** choose a plan → expand a row → rename
      a field and switch kg to plates → remove an exercise → add one through the
      picker → Save changes → leave and reopen: every change persisted, and Start
      Workout shows the plan as saved

**Design** (TICKET-041 group C1, `design/workout-flow/project/Manage*.dc.html` and
`PlatesUnit.dc.html`; chosen by the user 2026-10-24):
- **The plan's exercises are a list on the screen,** one collapsed row each with its
  fields and unit ("Weight kg · Reps"). Tapping a row expands it to the field
  editor (rename, role, unit, remove, one more field from the box at the bottom)
  and a trash button for the exercise. One footer button, **Save changes**, for the
  plan.
- **Add exercise:** a dashed button under the list opens the picker (TICKET-043).
  The exercise arrives expanded with its catalog fields.
- **The version is not editable in Manage Workout** (user, 2026-10-24, after the
  PR #17 review): equipment, angle and grip can't be changed on a plan exercise;
  remove it and add the other combination. The expanded row edits fields and units
  only. A plan may hold two combinations of one movement (`VersionPlan.dc.html`). A
  change for one workout only is TICKET-047
- **Wording: "plan",** matching the Start screen. The screen title stays Manage
  Workout.

**Dependencies:** TICKET-043 (the picker Add exercise opens).

---

### TICKET-052: Manage Workout — New Plan and First Plan

**Priority:** Medium | **Effort:** Small–Medium | **Status: OPEN** — split from
TICKET-043 2026-10-27

**Description:**
Creating a plan, from TICKET-041 group C1: "New plan" as the first row of the plan
picker, and a first-plan screen for someone with none. Both replace today's New
switch on the Workout picker.

**Acceptance Criteria:**
- [ ] "New plan" is the first row of the plan picker; tapping it turns the row into
      a name field with Create. The new plan opens with no exercises and saves with
      its first one
- [ ] With no plans, the screen skips the picker: "Your first plan", a name field,
      Create (disabled until something is typed), reached from the Start screen's
      "No plans yet · Create a plan"
- [ ] Today's New switch on the Workout picker is gone
- [ ] Guided tour: deferred to TICKET-053 (user, 2026-10-27)
- [ ] 4 or 5 tests on the main behaviours, each seen red
- [ ] **Device test (done when it passes):** create a plan from the New plan row,
      add an exercise, Save changes, and it appears on Start. Then with an account
      that has no plans: Start → Create a plan → first-plan screen → Create is
      disabled until a name is typed → Create → the plan opens empty → add one
      exercise → saved

**Design** (TICKET-041 group C1, chosen by the user 2026-10-24):
- **New plan: first row of the plan picker (chosen).** No New button on the screen;
  tapping "New plan" turns that row into a name field with Create. The new plan
  opens with no exercises and saves with its first one. Rejected: a New button
  beside the picker (`ManageNewInline.dc.html`): always visible, one more control
  on top, and redundant once the list offers it.
- **No plans yet (`ManageFirst.dc.html`):** an empty picker would be a dead end, so
  the screen skips it: "Your first plan", a name field, Create (disabled until
  something is typed). Reached from the Start screen's existing "No plans yet ·
  Create a plan" button.

**Dependencies:** TICKET-051 (the rebuilt screen).

---

### TICKET-053: Guided Tour — End-to-End Pass After the Catalog Work

**Priority:** Medium | **Effort:** Medium | **Status: OPEN** — created 2026-10-27

**Description:**
The guided tour is not working, and it is no longer fixed ticket by ticket (user,
2026-10-27). 043, 050, 051 and 052 each move or remove controls the tour points
at; this one pass, after all of them, fixes whatever is broken then, against the
final screens instead of each intermediate one.

**Acceptance Criteria:**
- [ ] Every tour (Manage Workout, Start Workout, the rest) run on a device
- [ ] Each step whose control is gone or moved (by 043, 050, 051, 052) retargeted
      or removed
- [ ] Steps for the new controls: the picker's search box, the version sheet, the
      filter menus, Save changes, New plan
- [ ] No step points at a missing control
- [ ] **Device test (done when it passes):** a device run of each tour

**Input:** TICKET-043's stage 3 note lists the step ids it already wrote
(`DROPDOWN_BUTTON` moved to the Exercise button; `EXERCISE_PICKER` → `SEARCH_BOX`,
`VERSION_SHEET`); unverified. The device runs of 043–052 note anything broken for
this ticket.

**Dependencies:** TICKET-043, TICKET-050, TICKET-051, TICKET-052.

---

### ~~TICKET-044: Logging Details — Plates as a Weight Unit~~ ✅ DONE

**Priority:** Medium | **Effort:** Small | **Status: DONE** — merged in PR #19;
full device test plan (PR #19) reported working 2026-10-24

**Description:**
Plates as a weight unit, for machines whose real weight is unknown. This ticket once
also covered machine settings, per-side reps and variation tags: the first two were
dropped (MVP) and tags superseded by grip as a version (TICKET-042). Items 2–4 below
are kept struck through, for the record.

1. **Plates as a weight unit.** A weight field offers kg or lb
   (`ExerciseFieldEditor.tsx`, `UNITS.weight`). Add **plates** for machines where the
   real weight is unknown. The user's notes write "4 p": 4 plates or pin 4.
   Units are never converted, so plates are never turned into kg; they compare only
   with plates
2. ~~**Machine settings:** seat / pad / pin position ("seat 4")~~ **Dropped
   (user, 2026-10-24): MVP.** About 5–10 users today; few would record a seat height,
   and it adds a stored shape, a sheet and a card line. Boards kept on the canvas,
   marked dropped (TICKET-041 C3, C3b)
3. ~~**Per-side reps:** "10 reps" can mean 10 per leg or 10 total~~ **Dropped (user,
   2026-10-24): MVP.** Reps stay plain "Reps". A one-arm or one-leg exercise is still
   its own version (TICKET-042's table), so its history never mixes with the
   two-arm one; it just carries no "per side" label. Volume counts reps as logged.
   Board kept, marked dropped (TICKET-041 C4)
4. ~~**Variation tags**~~ **Superseded (user, 2026-10-24, after the PR #17 review).** Grip became a version axis
   (TICKET-042), chosen in TICKET-043's picker; pause, bands, chains, belt and the
   rest are not offered in the MVP. Nothing is left for this ticket to store or
   compare

**Load-bearing fact (plates):** every comparison already checks unit equality
(`areFieldsComparable` in `exerciseFields.ts`, `exerciseHistory.ts`, `setDeltas.ts`,
`startWorkout.ts`, `bestByReps` keys by unit). So a plates session next to a kg
session should read as `unit_changed`, exactly like kg vs lb today, without new
logic. Verify with a test rather than assume it.

**Acceptance Criteria:**
- [x] **Stage 1, plates** (needs only TICKET-041 boards C1–C2; can land first):
      - `FieldUnit` gains `"plates"`; the weight unit picker offers kg, lb, plates
      - `stepSizeFor` (`setLogger.ts`) returns 1 for plates (one plate or one pin).
        Today a unit it does not know gives no stepper
      - labels read "4 plates", not "4 plates kg" or "4p". **Singular "1 plate",
        "+1 plate"**: every text helper builds `${value} ${unit}` today
        (`setValuesText`, `weightChange`, `volumeText`, `personalBestText`), so
        without a plural rule 1 reads "1 plates"
      - the unit-changed notice names last time's unit and numbers: "Last time was
        in kg (40 kg × 12), so no targets". Each past session keeps its own
        `entry.fields` (`exerciseHistory.ts`), so the unit is there; `GhostTarget`'s
        `unitChanged` does not carry it yet
      - tests: plates vs kg gives `unit_changed`; a best in plates never beats or
        is beaten by a best in kg; the stepper steps by 1; 1 plate is singular.
        Each seen red
      - ~~decided: is volume in plates shown or left out?~~ **Decided: shown with its
        unit** ("2 sets · 115 plates"), see Design. Coordinate with TICKET-036 (unit
        on volume trend points)
      - **bar weight** (moved here from stage 2, PR #17 second review). The user's
        notes write "20 r" / "15 rod" for a bar's own weight. **Default: the weight
        the user types is the total, bar included; the app never adds a bar
        weight**, so it never changes a typed number. Plates count the machine's
        stack, where there is no bar. The field gets no hint for it. A per-version
        bar weight the app adds is rejected for the MVP. A default chosen to close
        the question; the user can overrule it
- [x] ~~**Stage 2+, the rest**~~ superseded: machine settings and per-side reps
      dropped (MVP); tags replaced by grip as a version (TICKET-042). No stage 2

**Design, stage 1** (TICKET-041 boards C1–C2, `design/workout-flow/project/Plates*.dc.html`;
chosen by the user 2026-10-24):
- **Where the unit is set: board C1 (chosen).** In Manage Workout only, as kg/lb are
  today: plates is a third unit chip beside kg and lb, with one line under it,
  "Plates or pin number on the stack. Never turned into kg; compares only with
  plates." To change a unit later the user changes the plan (expand the exercise,
  tap the chip, Save changes). Stage 1 only adds the chip and the line to today's
  `ExerciseFieldEditor`; the rest of board C1 (collapsed rows, Add exercise, New
  plan) is the Manage Workout redesign, built in TICKET-043 (see there).
  Rejected: board C1b, the unit also switchable on the set card ("WEIGHT · KG ▾",
  before set 1 only, saved to the plan). It solves finding a numbers-only machine
  mid-workout, but the logger would write to the plan, and it has to lock after
  set 1 so one session never mixes kg and plates. The user: change the plan, not
  the set card.
- **Volume: board C2 (chosen).** Shown with its unit, "2 sets · 115 plates". Fair on
  the same machine, which is the only place plates compare. Rejected: board C2b,
  volume left out for plates ("2 sets"): simpler, but loses the volume trend for
  machine work.
- **Set card (C2).** Label "WEIGHT · PLATES", steppers −1 / +1, Last-time pill
  "5 × 12" (no unit, as today). Today rows "5 plates × 12"; deltas "+1 plate".
  A half plate (add-on weight) can be typed, 4.5; the stepper stays whole.
- **Rest (C2 rest).** Best banner in plates: "Heaviest 10-rep set yet · 6 plates ·
  beat 5 plates from 17 Oct". No new logic: `bestByReps` already keys by unit.
- **After a kg session (C2 after kg).** No pill, no ghosts. The notice names the old
  unit and numbers instead of "a different unit". Rows show no delta; one caption
  under the list says why ("Last time was in kg, so no comparison").
- **Guided tour:** stage 1 breaks none. The chip sits inside
  `EXERCISE_EDITABLE_LIST` → `EXISTING_ITEM`, whose copy ("rename them or remove
  any") does not mention units; optional copy update.

**Design, stage 2 — superseded (user, 2026-10-24, after the PR #17 review).** Kept for the record: with grip a
version, a session never compares across grips, so none of this is built. Boards
`Tag*.dc.html` are labelled superseded.
- ~~**C5 (chosen): compare with last time, and say the tags differed.**~~ The Last time
  pill names last time's tags ("80 × 8 normal grip"); one line on the card says
  "Last time was normal grip; today is close grip"; deltas are computed as usual and
  a caption under Today says what they were compared with ("Compared with normal
  grip, 22 Oct"). Ghost targets, deltas and `bestByReps` ignore tags. Cheapest: it
  adds labels to what exists. A close-grip day still reads −10 kg, explained
- Rejected: C5b, targets from the last session with the same tags (no false drop,
  but needs history filtered by tags). Revisit if the explained −10 still misleads
- **History sheet** (`TagHistory.dc.html`): the selected session's tags join its
  summary line; the Today column names today's. Date chips stay plain (TICKET-034)
- Each session stores the tags it was logged with (a copy of the plan's), which is
  what the pill, the line and the sheet read. Untagged sessions show nothing
- Dropped (MVP): machine settings (C3, C3b) and per-side reps (C4); see Description

**Implementation, stage 1 (2026-10-24):**
- **Load-bearing fact verified by test, true.** `src/utils/plates.test.ts` runs a kg
  session then a plates one through the hook derivation: ghost target, set delta,
  volume comparison and Start Workout's top set all read unit-changed, and bests in
  plates and kg never touch, with no new comparison logic. Each test seen red by
  breaking `areFieldsComparable` / the unit in `bestKey` and the best filter
- **One unit table** (review, 2026-10-24): `src/constants/units.ts` holds every unit
  with its role, stepper step, singular word and chip hint. `FieldUnit`, the Manage
  Workout chips, `stepSizeFor`, `unitLabel` and the hint all read it, so a new unit
  is one entry. Its keys are stored values and must never be renamed
- **One plural rule:** `unitLabel` / `withUnit` in `exerciseFields.ts`. Every place
  a unit follows a number goes through it: `setValuesText`, `weightChange`,
  `volumeText`, `personalBestText`, Start Workout's volume and top set, the history
  sheet's best card and trend. Singular is exactly "1"; 0.5 reads "plates"
- **Notice numbers:** "Last time was in kg (40 kg × 12)" uses last session's set at
  the *same set number*, as the Last time pill does, parsed in that session's own
  fields. When last time stopped earlier the numbers drop: "Last time was in kg, so
  no targets". No unit or no weight+reps pair last time keeps the old generic line
- **Caption (board C2 after kg):** the Today list's line now names the unit too,
  "Last time was in kg, so no comparison" (was "a different unit")
- **Unit hint (board C1):** shown only while plates is the selected unit. The board
  shows only that state; on every kg field the line would be noise
- **Bar weight:** nothing adds one. Grepped: no code adds to a typed weight
- **Session volume is one total per unit** (user, 2026-10-24, PR #19 review). A
  plan mixing kg and plates showed "volume n/a · mixed units" on its Start Workout
  row, which with plates would be most plans. Now `SessionTotalVolume.totals` holds
  one `{ unit, value }` per weight unit, in exercise order, and the row reads
  "1,955 kg · 115 plates". Same for kg + lb, and for a unitless weight (a bare
  number). Nothing is converted: the app never assumes what a plate weighs. This
  changes the stored session doc; pre-launch, so not migrated, and a session in the
  old single-total shape reads "volume not recorded". Supersedes TICKET-022's
  "mixed units null the total"
- Not done: the guided tour's optional copy update; the TEMPORARY history debug
  screen prints `40kg`-style values and was left as is

**Technical Notes:**
- Nothing here changes `ExerciseSet` or the session entry any more (stage 2 is
  superseded), so there is no TICKET-033 coordination
- Cardio extras (speed, incline, resistance level, watts, split /500 m) are listed
  per machine in the catalog's `optional_fields`. They are fields with role `other`,
  which already works

**Dependencies:** TICKET-041 boards C1–C2 only.

---

### TICKET-046: Build the Real Catalog — Movements and Versions

**Priority:** Medium | **Effort:** Large | **Status: DONE** — added
2026-10-24; open questions settled and all 5 stages built and reviewed 2026-10-25;
merged in PR #21 (67d1a19)

**Description:**
The research catalog (`research/exercise-catalog/`, 878 flat entries) was built to
prove search. It is reference only (user, 2026-10-24). Build the catalog the app
ships, against TICKET-042's model and the rules below, using the research as a
source of names, muscles and aliases.

**The rule (user, 2026-10-24): one exercise with variations is one movement.**
Searching "bench press" shows Bench Press once; the user picks it, then the
combination under it. Of what differs between two entries:
- **version** (own history): equipment, angle, cable attachment, one arm or leg
  vs both, and grip (user, 2026-10-24, after the PR #17 review). These change the numbers (TICKET-042)
- **not offered in the MVP:** pause, deficit, bands or chains, belt, stance,
  partial range, straps, tempo. Research entries built on them are dropped, with
  the reason, in the accounting table below
- **its own movement:** only when it is a different exercise, not a variation
  (Bench Press vs Floor Press). A person decides, case by case

**Size, from the research (a name heuristic, so rough, measured 2026-10-24):**
878 entries group into about 573 movements; 98 movements have more than one entry,
covering 403 entries. 29 names carry a grip or extra word: the grip ones
(close-, reverse-, neutral-grip) become grip versions of their movement, the rest
(pause, deficit, banded) are dropped for the MVP. Bench Press alone groups 25
entries: 18 equipment × angle versions, single-arm dumbbell, 5 grip versions
(close-grip ×3, reverse-grip, neutral-grip) and Pause Bench Press (dropped). Specialty Bar Bench Press is a 19th equipment × angle version the name
grouping missed, so Bench Press has 20 versions before grip, about 25 with it (TICKET-042
counts the same before grip). The
kind of miss a real pass catches.

**Acceptance Criteria:**
- [ ] The grip values each movement offers, and each grip version's muscle
      override (close grip: triceps first), so "triceps" still finds Bench Press
- [ ] Every research entry accounted for: a movement, a version of one, or dropped
      with a reason. A table, so nothing disappears silently
- [ ] The 84 versions from the user's Back, Chest and Leg notes each resolve
- [ ] Coverage beyond the notes: how many exercises the catalog lacks is unknown
      today. Decide a check (a reference list, or the user's other notes) and report
      the number, with what was added
- [ ] Ships in the shape TICKET-042 defines, and passes its loader's checks
- [ ] Equipment follows the rule at `EQUIPMENT` (`catalogVocabulary.ts`, PR #20
      review): what carries the load or changes the numbers. Bodyweight movements
      on a bar, station, bench, box or wall are `bodyweight`; an implement the
      vocabulary lacks gets its own key, never `none`
- [ ] ~~TICKET-043's search cases rewritten against it still pass~~ **Deviation
      (user, 2026-10-25):** 043 runs after this ticket, so its search does not exist
      yet. What 046 checks instead, each stage: every one of the 91 cases' expected
      entries maps to a version that was kept, not dropped (so 043 has something to
      find), and every research alias of a kept entry lands on its movement or
      version. Reported as "N/91 targets resolve, M aliases carried". Ranking stays
      043's

**Decisions (user, 2026-10-25), settled before any content:**
- ~~where the catalog lives~~ **TypeScript in `src/catalog/`**, one file per stage
  under `movements/`, joined in `index.ts`, with a "never import from app code"
  header: the app reads Firestore (042 stage 2); this is the upload's source. TS,
  not JSON: a JSON import widens every string, so `tsc` would not catch a muscle or
  equipment typo. Inside `src/`, because `tsconfig.json` covers only `src/**`.
  Rejected in the stage 1 review (user, 2026-10-25): `src/scripts/catalog/`, next
  to the upload script; `src/catalog/` kept. The
  stage 1 placeholder (`src/constants/exerciseCatalog.ts`) and its pin are
  replaced; the rule tests in `utils/catalog.test.ts` moved to a fixture of their
  own, so curating the real content never breaks a name test
- ~~drafting~~ **a one-off converter in the scratchpad drafts each stage from
  `catalog.json`; a person curates.** Belt Squat is its own movement; Banded Row
  and Banded Hammer Curl are band versions (the band is the load); Banded Deadlift
  and Banded Squat are dropped (bands on a bar); the strap stretch is not lifting
  straps
- ~~position words~~ **a position that changes the numbers is its own movement**
  (seated vs standing calf raise, seated vs lying leg curl); otherwise merged.
  Every call is in the accounting table's Note column
- ~~wide grip~~ **no `wide` key for now.** Adding a grip key later only adds ids.
  Wide-Grip Seated Cable Row merges into the normal one
- ~~measures~~ jump distance is "Distance" in `m`. **Bodyweight versions log Reps
  only**; weighted ones are equipment `added_weight` ("Added Weight" kg + Reps).
  Why: an empty weight parses to null (`parseNumericValue`), which nulls the
  exercise's volume and then the whole session's total (`computeSessionTotalVolume`,
  `unparseable`), and most bodyweight sets carry no weight. Volume counts the
  added weight only ("+10 kg × 5" adds 50 kg), noted at `FIELDS`. Weight vest
  versions stay `weight_vest`. Time: `s` for holds and loaded holds, `min` for
  duration and distance + time
- ~~equipment `none` (49 entries)~~ new keys `farmers_handles`, `gripper`,
  `wrist_roller`, `tib_bar`, `punching_bag`; Rope Climb and agility drills are
  `bodyweight`; Massage Gun and Lacrosse Ball dropped. **Sports and classes
  (Tennis, Yoga, Zumba, ...) dropped, "not training, MVP"**, except gym cardio
  people log (swimming, running, cycling): adding a movement later is safe,
  removing a shipped one strands its history on the fallback name
- ~~coverage check~~ **the user's notes (3 PDFs: Back, Chest, Leg) plus
  free-exercise-db** (876 entries, public domain) as the reference list. Only
  obvious gym staples are added; the rest is "skip (niche)". **Correction:** the
  notes' "84 versions" are 84 names but 81 distinct (Face Pull, Low-to-High Cable
  Fly and Standing Cable Chest Press are listed twice; 2 rows are loadmuscle
  links, not notes). The table test keys on the note name
- ~~accounting~~ **`src/catalog/ACCOUNTING.md`**, one row per research entry, with
  a Jest check both ways (every id it names exists; every catalog id is named)
- **stages:** 1 chest/shoulders/arms, 2 back, 3 legs, 4 core, 5 cardio,
  conditioning, mobility, stretching, plyometric, strongman, olympic. A research
  entry's stage is its first primary muscle's group; those modalities go to 5
  regardless. One commit per stage, reviewed before the next
- ~~one side in names: always shown (a), or `unilateral: false` where a movement
  has no two-sided version (b)?~~ **Decided (user, 2026-10-25, stage 3 review):
  neither. (c) ids keep `__one_side`; the name shows "one arm / one leg" only when
  the movement's versions differ in it**, the rule equipment already follows. So
  "Lunge · Dumbbell" and "Lateral Raise · Cable, one arm". Rejected (a): every
  lunge read "one leg", a part that tells nothing apart. Rejected (b): ids record
  what the exercise is, and a two-sided kickback added later would find its id
  taken. A change to 042's `buildVersionName`, its own commit

**Implementation, stage 1: chest, shoulders, arms (2026-10-25).**
- 259 research entries → **96 movements, 235 versions**; accounting: 61 movements
  of one version, 191 versions (some merged), 7 dropped (pause ×2, partial range
  ×3, stance, deficit); 1 added with no research entry (`dip__added_weight`)
- `src/catalog/fields.ts`: the fields per measure (`Record<MeasureId, ...>`, so a
  new measure must say what it logs). Equipment keys added: `added_weight`,
  `gripper`, `wrist_roller` (the rest arrive with their stages)
- **Grouping calls a person should check** (all in ACCOUNTING.md's Note column):
  - standing presses are Overhead Press, seated ones Shoulder Press (back support
    changes the numbers): Seated Barbell Overhead Press is `shoulder_press__barbell`,
    Standing Dumbbell Shoulder Press is `overhead_press__dumbbell`
  - Chest Press (seated machine, standing cable) stays apart from Bench Press, as in
    the user's notes; Vertical Chest Press Machine and Cable Crossover Press merge
    into it. "chest press" is no longer a Bench Press alias, since it names a movement
  - flys split four ways: Chest Fly (dumbbell, band, cable lying on a bench, with
    angles), Cable Crossover (standing mid), High-to-Low and Low-to-High Cable Fly
    (direction changes the target), Seated Cable Fly (back support). Kneeling
    High-to-Low merges into High-to-Low
  - Hammer Curl and Reverse Curl stay movements, not grip versions of Bicep Curl:
    named exercises in the user's notes. Grip versions are only names that say
    "X-grip" (and Diamond Push-Up = close grip)
  - ~~one Dip movement for machine, plate-loaded, assisted and ring dips; Triceps
    Dip apart~~ **Changed (user, stage 1 review, 2026-10-25): Triceps Dip folds into
    Dip** (`dip__bodyweight`, plus a new `dip__added_weight`; the research had no
    weighted triceps dip). The assisted, ring and machine dips are triceps-dip
    variants, so an assisted dip's progress now sits next to the real dip; their
    chest-first muscle overrides went with it. Chest Dip stays apart (the forward
    lean changes the numbers), and so does Bench Dip
  - Hammer Strength = plate-loaded machine (3 merges); low incline = incline;
    alternating = both arms, not one side; seated vs standing curls and raises
    merged; Lean-Away Lateral Raise is the one-arm dumbbell version;
    Chest-Supported Rear Delt Fly is the dumbbell incline version
  - kept although niche: Cheat Curl (cheating is not an MVP extra)
  - all accepted by the user in the stage 1 review (2026-10-25), with the Dip
    change above
- 5 of the 11 version id collisions the probe found are stage 1's, each a merge
  above; `seated_row__cable` is the user's (stage 2); the other 5 are called in
  their stages
- Checks: 33/91 search targets resolve (the other 58 are in later stages; none
  dropped); 330/344 research aliases carried, the other 14 equal a movement's name.
  Coverage: 313 free-exercise-db entries in these muscles; 239 covered, 17 later
  stages, 9 MVP extras, **0 added, 48 skipped as niche** (list in ACCOUNTING.md).
  The neutral-grip incline dumbbell press is skipped too (user, 2026-10-25;
  adding it later is safe)
- **Shoulders and arms rely on free-exercise-db alone** (user, 2026-10-25): the
  user has no notes beyond Back, Chest and Leg. Chest has both
- **Tests:** `src/catalog/catalog.test.ts`, 31: the loader passes, the id pin (235),
  ACCOUNTING.md both ways, 24 rows of the user's notes (52 of the 84 names; the back
  and leg rows arrive with stages 2 and 3), grip versions state their muscles and
  close grip puts triceps first. Each seen red: a removed version (pin, notes,
  accounting), a grip version without muscles, close grip chest-first, a ghost id
  and a missing row in ACCOUNTING.md, an unknown equipment. Added in the review:
  band versions log no weight (seen red by giving one kg back); `dip__bodyweight`
  removed turns the pin, the "Dips" row and the accounting check red
- ~~**Known gap:** band versions log "Weight" in kg, from the research~~ **Fixed
  (user, stage 1 review, 2026-10-25): all 14 band versions log Reps only**
  (measure `reps`; 14, not the 13 the review counted: Band Pull-Apart's only
  version is one too). The research's kg on a band is a made-up number that would
  set bests and add to the session's kg volume (CLAUDE.md 2.4)
- **Out of this ticket:** logging band level (light, medium, heavy) would be a
  unit of its own, like TICKET-044's plates. Not offered in the MVP

- **Committed** as `9dca5d8` (2026-10-25), not pushed. **PR plan (user,
  2026-10-25):** one commit per stage on `TICKET-046`, one PR after stage 5

**Implementation, stage 2: back (2026-10-25).**
- 90 research entries → **39 movements, 77 versions** in `movements/back.ts`, plus
  4 pullover versions added to Pullover in the stage 1 file (a movement lives in
  one file). Accounting: 27 movements of one version, 63 versions, 0 dropped
- **Grouping calls a person should check** (all in ACCOUNTING.md):
  - **"Seated Cable Row" vs "Machine Row (Seated)" (042's question): one movement,
    Seated Row**, with cable, machine, plate-loaded, band and one-arm cable
    versions. Wide-Grip Seated Cable Row merges into cable (user). Hammer Strength
    Row, Hammer Strength Low Row and the iso-lateral Lat Row all merge into the
    plate-loaded version: a version is the machine type, not the brand or model, so
    two gyms' plate-loaded rows share history. Standing Single-Arm Cable Row is its
    own movement (no back support)
  - Chin-Up stays its own movement, not a reverse-grip Pull-Up (named exercise, as
    Hammer Curl was). Yates Row (underhand) and Pendlay Row (dead stop) are their
    own movements too
  - Single-Arm Dumbbell Row and the single-arm kettlebell row are the one-arm
    versions of Bent-Over Row; Single-Arm Landmine Row merges into Meadows Row;
    Helms Row into the dumbbell Chest-Supported Row; Seal Row stays apart (flat)
  - Lat Pulldown: wide grip is the normal one; Hammer Strength Pulldown merges into
    plate-loaded; kneeling single-arm into the one-arm version. Hammer Strength
    High Row is its own movement (pulls from above). Behind-the-neck stays apart
  - Inverted Row takes ring and suspension versions; the Smith bar is where the
    body works, so the Smith inverted row merges into bodyweight. The suspension
    row's research weight × reps became bodyweight reps
  - Band-Assisted Pull-Up is `pull_up__band` (reps only): the band assists, and
    the name reads "Pull-Up · Band". Assisted Pull-Up (Machine) is
    `pull_up__assisted_machine`
  - ~~**Rack Pull dropped** as partial range (MVP extra)~~ **Kept (user, stage 2
    review, 2026-10-25): its own movement**, `rack_pull__barbell`, hinge pattern,
    not a deadlift version: programmed on its own, and its numbers never compare
    with a deadlift's
  - neck: Chin Tuck only here; the neck flexion work is mobility, so stage 5
  - all accepted by the user in the stage 2 review (2026-10-25), with Rack Pull
    kept
- Checks: 41/91 search targets resolve (8 more than stage 1; none dropped);
  430/447 research aliases carried, the other 17 equal a movement name. Coverage:
  89 free-exercise-db entries; 69 covered, 8 later stages, 4 MVP extras, **0
  added, 8 skipped as niche**
- **Corrected while building, in the stage 1 files:**
  - the stage 1 header said "a movement id never names equipment", but 17 stage 1
    ids do (`cable_crossover`, `landmine_press`, `band_pull_apart`, `gripper`,
    ...): the implement is part of those exercises' names. The header now says
    so; no id changed. Stage 2's `kettlebell_high_pull` and `standing_cable_row`
    were renamed `high_pull` and `standing_row` before they were pinned
  - the test "close grip puts triceps first" was too broad: it failed on the
    close-grip lat pulldown, which is rightly lats first. It now checks presses
    only (patterns `horizontal_push`, `vertical_push`), where the rule came from;
    all 6 close-grip press versions are still covered
- **Tests:** 6 back rows of the user's notes join the table (68 of the 84 names; the
  leg rows arrive with stage 3); the pin grows to 316. Seen red: a removed back
  version (pin, the "Seated cabled row" row, accounting), close-grip bench
  chest-first against the narrowed test, a back band version given kg, a removed
  pullover version (pin, accounting)

- **Committed** as `2c30926` (2026-10-25), not pushed

**Implementation, stage 3: legs (2026-10-25).**
- 195 research entries → **89 movements, 183 versions** in `movements/legs.ts`.
  Accounting: 54 movements of one version, 131 versions, 10 dropped (pause ×2,
  partial range, bands on a bar ×2, a band around the knees, deficit ×2, stance
  ×2). Equipment key added: `tib_bar`. One-side label "one leg" here (Turkish
  Get-Up: "one arm")
- **Grouping calls a person should check** (all in ACCOUNTING.md):
  - **Squat is one movement** with barbell (the back squat; "back squat" stays an
    alias), Smith, safety squat bar, specialty bar (cambered), bodyweight,
    dumbbell, cable and landmine versions. Low-Bar Back Squat, Front Squat, Zercher,
    Box, Anderson (dead start from pins, like Pendlay Row), Belt Squat (user) and
    the machine squats are their own movements. Barbell Hack Squat stays apart from
    the machine Hack Squat (a different lift)
  - **Goblet movements are their own** (Goblet Squat, Goblet Box Squat, Goblet
    Reverse Lunge, Goblet Split Squat, Goblet Bulgarian, Goblet Lateral Lunge,
    Goblet Step-Up): one weight at the chest is a different number from a weight in
    each hand. Heel-Elevated Goblet Squat merges into Goblet Squat
  - **Lunge, Walking Lunge, Reverse Lunge and Split Squat are four movements**, as
    the user's notes list them; Sled Lunge is its own (weight × distance)
  - **leg curls by position** (user's rule): Lying (machine, plate-loaded,
    dumbbell, band), Seated, Standing (machine and cable, one leg), Kneeling; the
    floor curls (ball, suspension, sliders) are one movement, ~~Hamstring Curl~~
    **Floor Hamstring Curl** (`floor_hamstring_curl`; renamed in the PR #21 review,
    2026-10-25, before any upload: "hamstring curl" means the machine, and an exact
    name match would have ranked the ball curl above Lying Leg Curl).
    **Calf raises:** Standing (machine, Smith, barbell, dumbbell, bodyweight, one
    leg) vs Seated (machine, dumbbell); Leg Press, Hack Squat and Donkey calf
    raises are their own
  - Leg Press: Hammer Strength merges into plate-loaded (collision
    `leg_press__plate_loaded_machine`), Smith and the selectorized horizontal press
    are versions, Vertical Leg Press is its own (same equipment, different numbers)
  - Deadlift takes the trap bar as a version; High-Handle Trap Bar Deadlift, Sumo,
    Stiff-Leg, Snatch-Grip and Jefferson are their own. Single-leg RDLs (dumbbell,
    barbell, and the kettlebell single-leg deadlift) are one-leg versions of RDL
  - Tib Bar Raise is the `tib_bar` version of Tibialis Raise
  - Banded Kickback (Glute) is a band version (the band is the load); Banded Glute
    Bridge is dropped (a band around the knees is an extra, not the load)
- Checks: 62/91 search targets resolve (21 more; none dropped); 606/625 research
  aliases carried, the other 19 equal a movement name. Coverage: 139
  free-exercise-db entries; 93 covered, 17 later stages, 13 MVP extras, **0
  added, 16 skipped as niche**
- **Tests:** the 6 leg rows complete the user's notes table, and a new check holds
  it at 84 names, 81 distinct (the count the table's comment claims); the pin
  grows to 499. Seen red: a removed leg version (pin, the "Calf raises" row,
  accounting), a deleted notes row (the count), a leg band version given kg
- ~~**Open question for the user:** 77 versions in 44 movements (stages 1–3) are
  `__one_side` in movements that have no two-sided version (every lunge, split
  squat and step-up, as the research logs them per side). The name then reads "Lunge · Dumbbell, one
  leg" for every lunge, and the id carries a part that tells nothing apart. Stage 1
  did the same (kickbacks, concentration curl, external rotation), so this stage
  follows it rather than diverge. Alternative: `unilateral: false` wherever a
  movement has no two-sided version ("Lunge · Dumbbell", `lunge__dumbbell`). That
  changes committed, not yet shipped, stage 1 ids, so it is the user's call~~
  **Decided (user, 2026-10-25): (c)**, see Decisions above. Ids unchanged; the
  name shows one side only when versions differ. Committed separately, before
  this stage
- all grouping calls above accepted by the user in the stage 3 review (2026-10-25)

- **Committed** as `8ed0456` (2026-10-25), after the name rule fix `e73f270`; not
  pushed

**Implementation, stage 4: core (2026-10-25).**
- 79 research entries → **62 movements, 79 versions** in `movements/core.ts`.
  Accounting: 52 movements of one version, 27 versions, 0 dropped. No new
  equipment key
- **Grouping calls a person should check** (all in ACCOUNTING.md):
  - **a plate held for a core lift is `weight_plate`, not `added_weight`**:
    Weighted Crunch, Weighted Decline Sit-Up (the research's "Added Weight" became
    a plain Weight field), Weighted Russian Twist, Weighted Plank (Weight × Time).
    `added_weight` stays for loading a bodyweight lift the body itself moves
  - Rollout is one movement: ab wheel, barbell, stability ball, and the
    suspension fallout. Knee Tuck and Pike each take ball and suspension versions
  - Woodchop splits by direction, as the cable flys did: high to low (cable,
    dumbbell) vs Low-to-High Woodchop (collision `woodchop__cable__one_side`)
  - Captain's Chair Leg Raise is `bodyweight` (a station, the equipment rule; the
    research had machine). Hanging Leg Raise, Hanging Knee Raise, Toes-to-Bar and
    Knees-to-Elbows stay apart
  - High Plank (hands) is apart from Plank (forearms)
  - Dead Bug (Breathing / 90-90), the other half of the probe's `dead_bug`
    collision, is mobility: called in stage 5
- Checks: 70/91 search targets resolve (8 more; none dropped); 691/714 research
  aliases carried, the other 23 equal a movement name. Coverage: 81
  free-exercise-db abdominal entries; 63 covered, 2 stage 5, 0 MVP extras, **0
  added, 16 skipped as niche**
- **Tests:** no new kind; the pin grows to 578. Seen red on core content: a removed
  version (pin, accounting), the band Pallof press given kg
- **Known gap, for stage 5:** Bear Crawl logs Distance + Time in `km` and `min`
  (the measure's units). A 20 m crawl reads 0.02 km. Stage 5's cardio has the same
  question for short distances (sprints, sled); raised there rather than decided
  per movement here
- all grouping calls accepted by the user in the stage 4 review (2026-10-25)

- **Committed** as `0b4f35d` (2026-10-25), not pushed

**Decided before stage 5 (user, 2026-10-25): short distances get their own measure.**
~~One distance measure in km + min for all~~ (a 20 m crawl read 0.02 km). New measure
`short_distance`, "Short distance + time", Distance in m + Time in s, chosen by **what
one set is**: a single short effort (Sprint, Hill Sprint, Shuttle Run, Bounding, Track
Intervals, Bear Crawl). Continuous pieces stay `distance_time` in km + min (runs,
walks, rows, rides, the ski erg, Treadmill Intervals, swimming: 1500 m reads 1.5 km,
the m chip exists). Loaded carries and sleds stay `weight_distance` in m; Rucking
stays there too (a 5 km ruck reads 5000 m; no fourth measure for one movement).
Hiking, Rollerblading and Kayaking dropped as not training. The rule, and that the
catalog sets only the default unit, are in `fields.ts`. History joins on the version
id whatever the unit; the unit decides which earlier sets compare (`lastTopSet`
reports `unit_changed`; units are never converted)

**Implementation, stage 5: cardio, conditioning, plyometric, olympic, strongman,
mobility, stretching (2026-10-25).**
- 255 research entries → **203 movements, 226 versions** in
  `movements/conditioningMobility.ts`, plus the barbell Sots Press added to Sots Press
  in the stage 1 file (renamed from "Kettlebell Sots Press"; ids unchanged).
  Accounting: 191 movements of one version, 37 versions, 27 dropped (25 sports,
  classes and outdoor activities as not training; Massage Gun and Lacrosse Ball as
  recovery tools). Bear Crawl (stage 4) moved to `short_distance`, id unchanged
- Measure added: `short_distance`. Equipment keys added: `farmers_handles`,
  `punching_bag` (both confirmed 2026-10-25), and `indian_club`, not decided before:
  an Indian club is a light club swung in circles, not a mace, and the research had
  filed it under mace
- **Grouping calls a person should check** (all in ACCOUNTING.md):
  - **collisions:** Dead Bug (Breathing / 90-90) is its own movement, a breathing
    drill apart from the core lift (`dead_bug`); the four swimming strokes are four
    movements (no stroke axis, and the stroke changes the numbers); Leg Swings
    front-to-back and side-to-side are two movements, by direction
  - treadmill movements stay apart from the outdoor ones (Treadmill Run vs Outdoor
    Run, Treadmill Walk with an incline version vs Walk): "Run · Cardio machine"
    would not say treadmill. Each cardio machine is its own movement. Outdoor Run,
    Walk, Outdoor Cycling and swimming are `bodyweight` (user)
  - olympic: Clean, Hang Clean, Snatch, Push Press and Thruster take barbell,
    dumbbell and kettlebell versions; Double Kettlebell Clean is the kettlebell
    version, the single-arm one its one-arm version. Every other olympic lift (power,
    hang power, block, muscle, tall, pulls, high pulls, the barbell jerks) is its own
    movement
  - Kettlebell Swing takes dumbbell and one-arm versions; American Kettlebell Swing
    is its own. Plyo Lunge Switch merges into Jumping Lunge. Kipping, Butterfly and
    Chest-to-Bar Pull-Up are their own movements, not Pull-Up versions
  - strongman: Axle Deadlift is its own movement, not a Deadlift version; Farmer's
    Walk takes dumbbell, kettlebell, trap bar and handles versions; each carry and
    sled movement is its own
  - Skipping (timed) stays apart from Single-Unders and Double-Unders (counted)
  - the band rule now replaces only a weight measure: band stretches and the band
    glute circuit stay timed
- **Not added: a test for the short-distance split.** The six are written in
  `fields.ts` and pinned by nothing beyond the content; stage 5 is the last drafted
  stage, so no later draft can undo it. The measure itself is guarded by `tsc`
  (`FIELDS` is a `Record<MeasureId, ...>`: a measure without fields does not
  compile, seen red)
- Seen red: a removed stage 5 version (loader, pin, accounting)
- all grouping calls accepted by the user in the stage 5 review (2026-10-25),
  `indian_club` included; no test wanted for the six short-distance movements

**Final totals (all 5 stages, 2026-10-25):**
- **489 movements, 805 versions** (384 movements have one version)
- **878 of 878 research entries accounted for**, each exactly once (checked against
  `catalog.json` by name): 384 movements, 450 versions, 44 dropped. Dropped by reason:
  not training 25, pause 4, partial range 4, deficit 3, stance 3, bands on a bar or
  around the knees 3, recovery tools 2. **Added with no research entry: 1**
  (`dip__added_weight`)
- **Search targets: 91/91** of TICKET-043's cases resolve to a kept version; **919/942
  research aliases carried**, the other 23 equal a movement's name
- **Coverage** (free-exercise-db, 876 entries): 643 covered, 28 MVP extras, **0
  added, 205 skipped as niche**. Table in ACCOUNTING.md
- **The user's notes:** 84 names, 81 distinct, all resolve (table test)
- equipment keys added over the ticket: `added_weight`, `gripper`, `wrist_roller`,
  `tib_bar`, `farmers_handles`, `punching_bag`, `indian_club`; measure added:
  `short_distance`. None renamed
- **Tests:** `src/catalog/catalog.test.ts` (45: loader, pin of 805 ids, ACCOUNTING.md
  both ways, 36 notes rows plus their count, grip muscles, band weights, and each
  version's fields match its measure, added in the PR #21 review and seen red by
  giving Plank weight × reps fields) and the
  one-side name rule in `utils/catalog.test.ts`

**Size (measured 2026-10-25, user's request; also measured by the user):** `CATALOG`
as JSON is **282,421 bytes** (276 KiB), **22.8 KiB gzipped**; the largest movement,
Bench Press, is **7.9 KiB** (then Push-Up 2.8, Lateral Raise 2.6). Against Firestore's
1 MiB doc cap that is 27%: **one doc holds the whole catalog, so 042's chunking is
optional.** Not in this ticket's criteria as written; 042's storage decision is
where 1 MiB comes from. JSON length approximates Firestore's own size count (field
names plus string bytes), not measured against Firestore. AsyncStorage: a 276 KiB
string is far below the Android default database size (6 MB) and per-value read
window (about 2 MB), per the library's docs, not measured on a device

**What TICKET-042 stage 2 needs from this ticket:** the catalog is `CATALOG` in
`src/catalog/index.ts` (489 movements), passing `validateCatalog`, every id pinned.
The upload script imports it (never the app). Before the first upload, the app build
must know every equipment and measure key above, or older builds refuse the whole
catalog (042's build-first order); the keys are already in `catalogVocabulary.ts`, so
a build from this branch is enough. Each grip version has its muscle override; each
movement with a one-side version has its `oneSide` label

**Technical Notes:**
- Grouping needs a person: "Seated Cable Row" vs "Machine Row (Seated)" (042's note)
- Versions multiply (equipment × angle × grip): store only combinations that exist,
  so the picker can disable the rest

**Dependencies:** TICKET-042's model (shape) first. Blocks TICKET-042 stage 2 and
TICKET-043's search cases.

---

### ~~TICKET-048: Exercise Names With "-" or "()" Are Refused~~ ✅ DONE

**Priority:** High | **Effort:** Small | **Status: DONE** — merged in PR #18;
bug, found in TICKET-041, split out in the PR #17 review; device run reported working 2026-10-24

**Description:**
Adding an exercise to a plan runs `getInvalidExerciseNameCharacter`
(`src/utils/validation.ts`), which allows letters and spaces only (`/^[a-zA-Z\s]$/`).
It runs in `validateExerciseSelection` (`src/utils/exerciseValidations.ts`) and again
for every exercise in `validateWorkoutAndExercises`. Today's own catalog has
"Pull-Ups" (`src/scripts/uploadExercises.ts`), so it cannot be added to a plan. The
rule dates from fd88aba (2025-05-04), confirmed with `git log -S`: both the function
and its `/^[a-zA-Z\s]$/` pattern first appear there. Confirmed by a unit test
calling `validateExerciseSelection` with "Pull-Ups", which got the refusal.

**Acceptance Criteria:**
- [x] Names may hold letters, digits, spaces, "-", "(", ")", "/", "'" and "&"; other
      characters are still refused, with the message naming the allowed set
- [x] A test with "Pull-Ups" and "Pec Deck (Machine Fly)" passing and one refused
      character, seen red against today's rule (`src/utils/exerciseValidations.test.ts`)
- [x] The id rule (`isValidId`: letters, digits, underscore) is unchanged

**Deviations, found while building:**
- **The typographic apostrophe ’ is allowed too.** Today's catalog has
  "Farmer’s Walk" with ’, not ', so the ticket's set alone still refused it; iOS
  keyboards type ’ by default. The message lists ' only.
- **`toExerciseId` changed** (scope growth beyond the name rule). A custom exercise's
  id is derived from its typed name; under the old mapping "Pull-Ups" became
  `pull-ups`, which `isValidId` refuses, so the bug would only have moved to a
  different message. It now drops apostrophes and turns any other run of
  non-alphanumerics into one underscore. All 42 catalog names in
  `uploadExercises.ts` map to their own ids (checked once, not kept as a test), and
  any name of letters and spaces only — everything the old rule allowed — maps
  exactly as before, so no stored id moves.
- The user-name rule (`getInvalidUserNameCharacter`, sign-up) has the same pattern
  and message and is deliberately left alone: it is a different rule.

**Dependencies:** none. Before TICKET-042.

---

## PHASE 4: Later — after the Phase 3 UI is complete

Reminders, not next up. Nothing here starts until the Phase 3 workout flow is
finished end to end.

---

### TICKET-045: Create a Custom Exercise Again

**Priority:** Low | **Effort:** Medium | **Status: DEFERRED** — decided 2026-10-24

**Description:**
The user decided, while picking TICKET-041's A boards, that for now nobody creates a
new exercise: the catalog is the only source. Either the exercise is in it, or there
is nothing to add (TICKET-043 Design). This ticket is the place to reopen that.

**What was decided, and its limits:**
- Today's "New" switch on the Exercise picker goes, with nothing in its place
- Existing custom exercises in plans and history keep loading, logging and showing,
  and are found by name. Nothing is deleted or migrated
- A machine the catalog lacks is logged as the closest catalog movement, plus a
  field ("Seat")

**Reopen when:** someone cannot log an exercise they do, and the closest catalog
movement plus a field misstates it. No signal is collected for this today; a
count of searches with no results would be one, and would need a decision on what is
recorded.

**Already designed, if reopened:**
- A4 with a create button after an empty result, and after "Close matches" (the
  first group A boards; the button opened a name field, so a typo was never saved
  by one tap)
- `ManageAdd.dc.html`: the exercise arrives tagged Custom, with no fields and one row
  of starting templates (Weight × Reps / Reps only / Time / Distance + Time)
- Open then: a custom exercise has no muscles, so muscle search cannot find it; the
  name rule for custom names (TICKET-042's validation item), including a name of
  allowed punctuation only ("()", "- &"), which passes the rule but maps to an empty
  id and is refused as "Exercise ID cannot be empty." (PR #18 review); its id scheme
  next to catalog version ids

**Storage, found 2026-10-26 (TICKET-042 stage 2 review):**
- Today a custom exercise lives only inside the plan doc that holds it
  (`users/{uid}/workouts/{planId}`): no per-user list, nothing shared between
  plans, never in `exercise_catalog`. The same exercise in a second plan is a
  second copy, typed again
- Decide when reopened: a per-user library (`users/{uid}/custom_exercises`, picked
  like a catalog version, one id across plans so history joins), or keep per-plan
  copies. History joins on the id (TICKET-042), so two copies with different ids
  split one exercise's history
  - Checked in code: a custom id is `toExerciseId(name)` (`utils/validation.ts`),
    a slug of the typed name. Two copies spelled alike ("Cable Fly" in both plans)
    get the same id and do join; a different spelling ("Cable Flys") splits
- Editing a custom exercise's name or fields: does it reach every plan using it?
  Only a library answers yes
- What exists today and must keep working: custom exercises store `name` and no
  `nameSnapshot`; `exerciseDisplayName` shows `name`; the custom-name rule applies

**Dependencies:** TICKET-042, TICKET-043.

---

### TICKET-047: Switch an Exercise's Version Mid-Workout

**Priority:** Low | **Effort:** Medium | **Status: DEFERRED** — decided 2026-10-24

**Description:**
The machine is taken, so the user does dumbbells instead; or the shoulder is sore,
so close grip today. Both are a version switch (grip is a version), for one
workout. Today the only options are
logging dumbbell numbers under the machine's history (a wrong number) or skipping the
exercise. Wanted (user, 2026-10-24), not built now.

**Decided:**
- **For this workout only.** The plan keeps its version, so next week starts on the
  planned one again. The plan changes in Manage Workout, never from the logger (the
  same rule as TICKET-041 C1). Hevy and Strong default to this too; their "update
  the routine?" question at Finish is the part left out
- Covers grip too: it is a version. Every axis is switchable alike, none singled out
- Revisit with it: logging against the new combination's own history, and its
  "first time" state when it was never done (proposal boards P3, P4)
- Reached from the version in the logger header (a small caret), only where the
  movement has more than one version. The sheet is A3's, labelled "For this workout
  only. Your plan keeps Machine."
- **Before set 1:** the exercise is swapped for today. Targets and the Last time pill
  come from the new version's history
- **After sets:** the logged sets stay on the old version (they were done on it).
  The new version is added beside it in this workout, starting at set 1, so each
  version's history stays its own

**Design:** TICKET-041 boards B2, `design/workout-flow/project/Switch*.dc.html`.

**Open when it is picked up:** the workout then holds an exercise its plan lacks
("Exercise 1 of 6" becomes 7); whether a later idea, replacing with a different
movement altogether, uses the same sheet.

**Dependencies:** TICKET-042 (versions), TICKET-043 (the sheet).


---

### TICKET-049: Move the Client-SDK Scripts to the Admin SDK

**Priority:** Medium | **Effort:** Small | **Status: OPEN** — raised 2026-10-26 in TICKET-042 stage 2C

**Description:**
`rebuildExerciseStats.ts`, `patchMissingUserDocs.ts` and
`addExerciseToUserWorkout.ts` write through `src/scripts/firebase.ts`, the client
SDK, without signing in. They only ever worked because the console rules allowed
unauthenticated access, through a time-boxed open rule that expired on
2025-08-25. ~~TICKET-042's deploy breaks them~~ **They are already broken**
(console diff, 2026-10-26): owner-only `users/{uid}/**` is live today, so all
three get PERMISSION_DENIED now. Signing in would not
help: one user cannot reach another's data under owner-only rules.

**Why it matters before the next repair:** the app points at
`rebuildExerciseStats` as the fix for a failed rollup (`useWorkoutStore.tsx`,
"Workout saved, history rollup pending." and the comment beside it; also
`exerciseStats.ts`, `workoutSessions.ts`, `workoutSession.ts`). Today that repair
would fail the first time it is needed.

**Scope:**
- Switch the three to `getAdminFirestore()` (`src/scripts/firebaseAdmin.ts`):
  admin SDK API (`db.collection(...)`, `batch()`, `collectionGroup`), not the
  client SDK's `doc()` / `getDocs()`
- Give each writing script `--dry-run`, as `uploadCatalog` and `wipeTestData` have
- Then delete `src/scripts/firebase.ts` if nothing else uses it
- Not in scope: what the scripts compute (`rebuildStatsFromSessions` stays)

---

### TICKET-033: Drop Sets — Log a Weight Change Within One Set

**Priority:** Low | **Effort:** Medium-Large | **Status: OPEN** — after Phase 3

**Description:**
A set sometimes cannot be finished at the planned weight. Example: set 3 starts
at 15 kg, only 5 reps go up, and the remaining reps are done at 12.5 kg. Today
that can only be logged as one weight, or as two separate sets, and both
misstate what happened. The log should show that the set was split and that
the first weight was not completed.

**Acceptance Criteria:**
- [ ] One set can hold more than one weight × reps segment (15 kg × 5, then 12.5 kg × N)
- [ ] The set reads as a drop or split in the Today list and in history, so the
      user can see next time that the weight was not completed
- [ ] Volume counts every segment
- [ ] Decided and documented: how a split set compares with the same set last
      time (TICKET-019's deltas), which segment the next ghost target comes from,
      and whether a split segment can become a `bestByReps` record

**Technical Notes:**
- This is a data-model change. `ExerciseSet.fields` holds one value per field,
  and `StoredSetFields`, `computeSessionVolume`, `applyBest`, `setAt` and the
  delta maths all assume one weight and one rep count per set. Settle the stored
  shape first. The app is pre-launch, so no migration is needed
- Not an extra free-text field: deltas and records would have to guess its
  meaning, which is the inference the field-role model exists to avoid
- TICKET-034 stores `setEffort` parallel to `sets`, one mark per set position. Keep a
  drop set as **one** entry in `sets`, or rebuild `setEffort` alongside: if the two
  lengths differ, every mark in that session reads as "marks unavailable" (`zipSetEffort`)

**Dependencies:** Phase 3 complete (TICKET-019, TICKET-020, TICKET-021).

---

### ~~TICKET-034: Mark a Set Easy or Hard~~ ✅ DONE

**Priority:** Low | **Effort:** Small-Medium | **Status: DONE** — merged in PR #15;
Firestore write and a device run still owed (see Pending Work → verification owed)

**Description:**
After a set, the user can mark how it felt. Next time it shows next to that set's
numbers from last session. Easy means push slightly more; hard means missed reps,
lost form or needed a spot — hold the weight, save energy, or rest longer.

**Acceptance Criteria:**
- [x] ~~One control per exercise per session~~ One mark per **set**, optional, never
      required to log or finish (see Deviations)
- [x] Stored with that exercise's session and carried into history
- [x] Shown next time alongside "last time": on the set card for that set, and per set
      in the history sheet
- [x] Decided: two values, `easy` / `hard`; not marked (`null`) is distinct and is
      never stored as a third value

**Decisions** (also in code comments at each site):
- **Values.** `Effort = "easy" | "hard"`, `null` = not marked, read by the user as
  "done in good form, as planned". Rejected a stored `ok`: the user marks exceptions,
  not every set, so `ok` would be indistinguishable from unmarked in practice
  (`src/types/workoutSession.ts`).
- **Stored shape.** `ExerciseSessionDoc.setEffort: (Effort | null)[]`, parallel to
  `sets`, copied into the rollup's `StatsSessionEntry`. A parallel array so TICKET-033's
  reshape of the stored set does not have to carry it. Built once from the live sets
  (`buildSessionDocs`), so aligned by construction; a reader finding a length mismatch
  reads every mark as null and flags it (`zipSetEffort`). Always written as nulls when
  nothing is marked: Firestore here rejects `undefined`, which would fail the queued
  upload on every retry.
- **Live shape.** `ExerciseSet.effort`, on the set object, so `removeSet`/`restoreSet`
  move the mark with its set. Persisted to AsyncStorage on every change, so it
  survives an app kill and travels in the upload queue with the workout.
- **"Last time" is the last session only.** If last session's set N was not marked,
  the card shows nothing — no fallback to an older mark, which would sit beside
  numbers it was never about (`lastTimeEffort`). Older marks are in the history sheet.
- **Where it is set.** The rest panel ("How was set N?", optional), and the Today list
  (tap a row → Easy / Hard / Clear; Clear dropped in TICKET-040, tap-again still clears). On both, tapping the chosen mark again clears it
  (`toggleEffort`). The rest panel asks about the set that started the rest
  (`RestTimer.setNumber`) and hides the question if a removal makes it no longer the
  last set, rather than move it onto a set rated earlier. No per-row slot (looked
  cluttered beside remove), no swipe (the pager owns horizontal swipes), no long-press.
- **Where it shows.** The set card's pill (`LAST TIME 65 × 6 [H]`) plus a line
  "Felt hard last time · 2 Oct"; the history sheet's Felt column and its caption count
  ("1 easy · 1 hard"). Date chips stay plain — marks on them read as clutter.
- **Look.** `EffortBadge`: H solid, E hollow; told apart by fill and letter, no new
  colour (gold is PR, red is discard). Design: `design/workout-flow/project/Effort*.dc.html`
  (canvas boards 5–8; 6b is the rejected column layout).
- Records and shows only: ghost targets, deltas, the PR banner and rest duration do
  not read it.

**Deviations from the ticket as written:**
- **Per set, not per exercise.** The ticket said "it describes the exercise, not one
  set". In use, "hard" is about the set where reps were missed or a spot was needed,
  and comparing it with the same set last time is the axis ghosts and deltas already
  use. A per-exercise mark could not say which set.
- TICKET-021/038 linkage: TICKET-038 as written does not read effort. Rest length from
  a mark is a future option, not a contract this ticket fulfils.

**Verified:** typecheck clean; 173 unit tests pass, 11 of them new, each seen failing
against a deliberate break of the line it covers: JSON round trip → `buildSessionDocs`
→ rollup rebuild → history keeps marks and stores null not undefined; last-session-only;
misaligned marks read as unavailable; a mark moves with its set through remove/undo
and is stored; rest-panel mark and clear; Today row strip; set-card pill; sheet rows
and caption. After PR #15 review: a `null` `setEffort` reads as unavailable instead of
throwing; Undo closes an open strip; the rest question hides when its set is removed;
a mark that failed to store is not shown; tap-again clears on the Today strip too.

**Unverified:**
- The Firestore write of `setEffort` and the rollup transaction carrying it — no
  emulator or device run. Rules are a per-user wildcard with no field validation, so
  they should accept it; untested.
- A device run of the rest-panel control, the Today strip and the sheet's Felt column
  (layout at phone width, the extra column in the sheet's sideways-scrolling table).

**Known gaps:**
- A mark cannot be changed after upload — that is editing an uploaded set, TICKET-032.
- `WorkoutHistoricalLogsFilter` reads `exercise_sessions` directly and ignores marks.
  Out of scope; it gets the field for free if it ever wants it.
- Possible follow-up, not filed: a "needed help now, didn't before" signal across
  sessions. Today the user reads it from the sheet.

**Dependencies:** Phase 3 complete. TICKET-020 (history sheet) is where older marks show.

---

## Recommended Execution Order

Finished tickets have been removed — they are not blockers for anything.

**The exercise catalog track goes first** (user's decision, 2026-10-24): 044 → 042 →
046 → 043, in that order, before 033 / 032 / 029 below. 044 is done (PR #19). 042 runs
in two parts around 046 (2026-10-25): stage 1 (the shape) first, stage 2 (the app reads
it) once 046's content exists. Phase 3B; research is in
`research/exercise-catalog/` (git-ignored, local only).

```
1. TICKET-042  stage 1 (Catalog shape)    — Done: types, id/name rules, loader
2. TICKET-046  (Real catalog content)      — Done (PR #21): 489 movements, 805 versions
3. TICKET-042  stage 2 (App reads catalog) — Done (PR #22, 2026-10-27): Firestore + cache,
                                             name sites, test-data wipe, rules deployed
4. TICKET-043  (Search + picker)           — Next; opens from today's Manage Workout
5. TICKET-050  (Picker start page)        — After 043: recents, filters, last used
6. TICKET-051  (Manage Workout list)      — After 043; alongside 050 if wanted
7. TICKET-052  (New plan, first plan)     — After 051
8. TICKET-053  (Guided tour pass)         — After 043, 050, 051, 052
```

**Then the next three, decided.** They are what makes logging an exercise match what
people actually do, and 033 changes a stored shape: pre-launch is the cheap moment
for that.

```
1. TICKET-033  (Drop sets)                 — A weight change within one set
2. TICKET-032  (Edit/delete uploaded set)  — Needs the rollup rebuild; after 033 so it
                                             is written once against the final shape
3. TICKET-029  (Pending uploads view)      — Replaces the TEMPORARY debug screen.
                                             Surface overlaps TICKET-011: either pull
                                             011 in or let 029 decide it
```

**Everything after that is undecided**, listed by group rather than order. Sizes and
what is actually left are in Pending Work at the top.

```
Before launch
  TICKET-026  (Clear state on sign-out)  — Privacy: next user sees the previous one's cache
  TICKET-030  (Catalogue field names)    — Renaming a field nulls past values, unflagged
  TICKET-001  (ESLint/Prettier)          — Rescue 5d9189b from stash@{0}; it is on no branch
  TICKET-011  (Active workout indicator) — 021 and 029 defer their surface to it
  TICKET-014  (Reset email branding)     — Console-only Phase 1
  TICKET-012  (Account Linking Ph.2)     — Makes linking reachable

Correctness and guards
  TICKET-036  (Unit on volume trend)     — Removes the trend-window invariant
  TICKET-013  (Auth error messages)      — Map exists; migrate the remaining call sites
  TICKET-002  (Remove `any` types)       — ~12 left across 8 files
  TICKET-031  (Palette contrast guards)  — Extends the colors.test.ts pattern
  TICKET-037  (Same-day session chips)   — Two identical chips in the sheet

Decisions before code
  TICKET-035  (Time/distance measures)   — "Which way is better" is a product call
  TICKET-038  (Per-exercise rest)        — Nothing can set a non-default rest today
  TICKET-039  (Rep-progression PRs)      — Decision first

Tech debt
  TICKET-003  (Finish userDB split)      — Substance done; named files and barrel remain
  TICKET-004  (Error handling)           — Concrete case: persistWorkout's console.log
  TICKET-005  (AsyncStorage service)     — 9 files touch it directly
  TICKET-006  (Break large components)   — Re-scope first: the named targets are gone
  TICKET-007  (tsconfig strictness)
  TICKET-008  (Barrel exports)
  TICKET-023  (Tour press-to-continue)   — Patch in docs/patches/
  TICKET-025  (Footer highlight)
```

---

*Generated on: 2025-02-17*
*Based on codebase analysis of the fitgram project*
