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
| 004 | Centralize error handling, replace console calls | Medium | Concrete case recorded: `persistWorkout`'s `console.log` |
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
| 034 | Rate an exercise easy or hard | Small-Med | |
| 035 | Measures beyond weight x reps | Med-Large | "Which way is better" is a product decision |
| 036 | Put a unit on volume trend points | Small-Med | Today the trend over-suppresses; held by an invariant test, not a fix |
| 037 | Tell apart two sessions on the same day | Small | |
| 038 | Per-exercise rest duration, and a control | Medium | **Nothing can set a non-default rest today** |
| 039 | Decide whether the PR banner rewards rep progression | Small (decision) + Med (build) | |

### Not tickets — verification owed

- **`WorkoutSessionDoc.volume` has never had a real Firestore write.** On `main`
  since TICKET-022, written on every Finish, and it feeds the Start screen's
  volume figures.
- **The guided tour has not been run since the scroll-buffer change** landed
  (PR #13). Both states are unit-tested; nobody has watched a bottom step scroll
  above its tooltip.

One device session covers both: start a workout, log a set, Finish online, then
run the tour from Profile.

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
- **Mixed units null the total** (`unavailableReason: "mixed_units"`). "kg" next to
  no unit counts as mixed, matching `areFieldsComparable`. Rejected: per-unit totals
  (`{ kg, lb }`), which are more to store and render for a case the precedent
  already answers with null
- **An exercise with no weight+reps pair is excluded, not treated as a failure.** Under
  strict all-or-nothing, any plan with a plank would never show a volume. Counted
  in `exercisesTotal` and not in `exercisesWeighted`, and the row shows "1 not weighted"
- **One unparseable lift nulls the total** (`"unparseable"`), with counts alongside
  ("2 of 3 lifts readable"). Precedence when several apply: no weighted lifts,
  then unparseable, then mixed units
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

## PHASE 4: Later — after the Phase 3 UI is complete

Reminders, not next up. Nothing here starts until the Phase 3 workout flow is
finished end to end.

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

**Dependencies:** Phase 3 complete (TICKET-019, TICKET-020, TICKET-021).

---

### TICKET-034: Rate an Exercise Easy or Hard

**Priority:** Low | **Effort:** Small-Medium | **Status: OPEN** — after Phase 3

**Description:**
After an exercise, the user marks how it felt. Next time it shows next to
last session's numbers. Easy means push slightly more; hard means hold the
weight, save energy, or rest longer.

**Acceptance Criteria:**
- [ ] One control per exercise per session to mark it easy or hard. Optional,
      never required to log or finish
- [ ] Stored with that exercise's session and carried into history
- [ ] Shown next time alongside "last time" (set card and/or history sheet),
      e.g. "Last time: hard"
- [ ] Decided: two values (easy / hard) or three (easy / ok / hard), and
      whether "not rated" is distinct from "ok"

**Technical Notes:**
- A typed field on the exercise session (e.g. `effort: "easy" | "hard" | null`),
  not a role-`other` set field: it describes the exercise, not one set, and
  later features (target suggestions, rest length with TICKET-021) need to read
  it reliably
- Suggesting a heavier target from "easy" is a separate decision. This ticket
  records and shows the rating; it does not change ghost targets

**Dependencies:** Phase 3 complete. TICKET-020 (history sheet) is a natural
place to show it.

---

## Recommended Execution Order

Finished tickets have been removed — they are not blockers for anything.

**The next four are decided.** They come first because they are what makes logging
an exercise match what people actually do, and because two of them change stored
shapes: pre-launch is the cheap moment for that.

```
1. TICKET-033  (Drop sets)                 — A weight change within one set
2. TICKET-034  (Easy / hard rating)        — Per-exercise effort, independent of 033
3. TICKET-032  (Edit/delete uploaded set)  — Needs the rollup rebuild; after 033 so it
                                             is written once against the final shape
4. TICKET-029  (Pending uploads view)      — Replaces the TEMPORARY debug screen.
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
