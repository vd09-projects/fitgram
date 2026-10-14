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
> 1. Rest duration has no home. `WorkoutPlan` and `Exercise` in
>    `src/types/workoutType.ts` carry no rest field — per exercise, per workout,
>    or one global setting?
> 2. A mistyped set cannot be removed. `useWorkoutStore` has `addSetToExercise`
>    and `updateSet` but no `removeSet`, so a fat-fingered `650 kg` is permanent.
>    Fold delete into TICKET-019, or give it its own ticket?
> 3. Rest timer while the app is backgrounded. Resume-from-timestamp is cheap; a
>    local notification when rest ends is a separate dependency.
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

---

### TICKET-019: Today's Sets with Per-Set Deltas

**Priority:** High | **Effort:** Small-Medium | **Status: OPEN**

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

---

### TICKET-021: Rest Timer, Personal-Best Banner, Next-Set Target

**Priority:** Medium | **Effort:** Medium | **Status: OPEN**

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

---

### TICKET-022: Start Workout Redesign and Resume Banner

**Priority:** High | **Effort:** Medium | **Status: OPEN**

**Description:**
Rebuild the plan picker so a plan can be judged before it is started — exercise count, when
it was last done, recent volume — and expand the selected plan to show each exercise's last
top set. Replace the modal alert that fires when a workout is already running with an inline
resume banner.

**Acceptance Criteria:**
- [ ] Plan cards become rows showing name, exercise count, time since last performed, and recent volume
- [ ] Selecting a plan expands it to list its exercises with each one's last top set
- [ ] A trend indicator per plan
- [ ] Search still filters plans
- [ ] The blocking `AlertBase` on mount is replaced by an inline banner naming the in-progress workout, its elapsed time and sets logged, with Resume and Discard
- [ ] Discard from the banner confirms first
- [ ] Primary action is a single bottom-bar button naming the plan being started
- [ ] Empty state for a user with no plans
- [ ] Tour steps in `src/tour_steps/startWorkout.ts` still resolve, or are updated

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

**Priority:** High | **Effort:** Small-Medium | **Status: OPEN** — next, ahead of TICKET-018

**Description:**
The repo has no test runner; TICKET-016 and TICKET-017 verified with hand-rolled
scripts instead. Set up Jest so tests are cheap to write, then write tests for one or
two screens as the worked example every later screen copies.

This is not "test every screen". It goes first so that 018-021 and later screens are
built with their tests from the start, rather than having tests added after the fact.
Each later ticket adds its own few tests (CLAUDE.md 3.2: test what the change touched,
4-5 per screen).

**Acceptance Criteria:**
- [ ] `jest`, `jest-expo` (matching Expo SDK 52), `@types/jest`,
      `@testing-library/react-native` as dev dependencies; a jest config with the
      `jest-expo` preset; `babel.config.js` with `babel-preset-expo` (none exists
      today); `npm test` and watch scripts
- [ ] One shared render helper that supplies what every screen needs, so a new screen
      test is a few lines: theme and tour providers (both crash without one: theme
      defaults to `null`, tour to `{}`), navigation, and mocks for AsyncStorage,
      gesture handler and the history/auth hooks
- [ ] Example logic tests for `src/utils/workoutProgress.ts`, chosen not exhaustive:
      progress fill with and without history incl. the cap; index clamp at both ends
      and the empty workout; elapsed time past the hour
- [ ] Example screen tests for `ActiveWorkoutScreen`, 4-5: arrows change the exercise;
      back with nothing behind it opens the Workout tab instead of throwing (the
      `WorkoutHome` navigate bug from TICKET-017); Discard asks before deleting; Finish
      ignores a second tap while saving; a logged set lands on the exercise in view
- [ ] Optionally a second, simpler screen if `ActiveWorkoutScreen` turns out to be a
      poor first example (it needs the most mocks)
- [ ] A short "how to add a test" note next to the helper: where test files go, how to
      render a screen with the helper, what to mock

**Out of scope:** porting `src/scripts/verifyHistoryReads.ts` (TICKET-016, 77 checks).
It keeps working as is; move it into Jest when a ticket next changes the history layer.

**Technical Notes — from the TICKET-017 review:**
- Do not carry over the old harness's weak checks: "no history fetch" was vacuous
  (`prefetchExerciseHistory` returns at once without a user id,
  `useExerciseHistoryStore.ts:67`), and the regex source checks matched text, not
  behaviour. The role-token rule belongs in ESLint (TICKET-001)
- Layout and touch bugs (off-centre taps, uneven borders, segment rendering) are out
  of reach of component tests; those stay with device runs
- Review the working rules in `CLAUDE.md` alongside this MR (requested on PR #4); the
  testing rule there is what this ticket puts into practice

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
9. TICKET-012  (Account Linking Ph.1)     — Unblocks locked-out users
10. TICKET-014 (Reset email branding)     — Console-only Phase 1, do it now
11. TICKET-013 (Auth error messages)      — Small, user-facing polish
11. TICKET-010 (Forgot Password)          — Subsumed by TICKET-012 Phase 1
10. TICKET-009 (Google Sign-In)           — Largest feature
11. TICKET-011 (Active Workout Animation) — UX enhancement

--- Phase 3: workout flow redesign ---
12. TICKET-015 (Workout flow tokens)      — Blocks the rest of Phase 3
12. ~~TICKET-016 (Exercise history hook)~~ — DONE
13. TICKET-017 (Active workout pager)
14. TICKET-024 (Jest setup + example tests) — First, so later screens ship with tests
15. TICKET-018 (Set logger card)
16. TICKET-019 (Today's sets + deltas)    — Flow is whole and better here
17. TICKET-022 (Start Workout redesign)
18. TICKET-020 (History sheet)
18. TICKET-021 (Rest timer + PR banner)   — Parallel with 020
19. TICKET-023 (Tour press-to-continue)   — After Phase 3; patch in docs/patches/
--. TICKET-025 (Footer highlight)         — Small, independent; any time
--. TICKET-026 (Clear state on sign-out)  — Privacy; small; before launch
```

---

*Generated on: 2025-02-17*
*Based on codebase analysis of the fitgram project*
