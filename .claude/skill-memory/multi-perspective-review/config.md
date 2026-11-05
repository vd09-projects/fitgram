# Multi-perspective review: Fitgram config

Written 2026-11-05 from a look at what past reviews missed. Applied in Phase 1
Step 1, before the default triage.

## Reviewer overrides

always_include:
- Spec & Claims Conformance Reviewer: every PR here has a ticket in `TICKETS.md`
  with a "Decided" list, and most have design boards. Drift from those, and
  comments or status lines that state something false, are the commonest misses
  (TICKET-069: a comment said the bar's name had no version, and only the device
  run caught it; Pending rows for 047, 056 and 061–067 said open after merge).
- React Native & Device Reviewer: the whole app is Expo/React Native. Most bugs
  that got past review were platform bugs, found only on a device (see Hot spots).
- Tech Debt Sentinel and Naming & Clarity Guardian (the skill's baseline).

always_exclude:
- Infrastructure & Deployment Reviewer, unless the diff touches `eas.json`,
  `app.json`/`app.config.*`, `firestore.rules`, `firestore.indexes.json` or `.github/`.
- API & Contract Reviewer: there is no server API; Firestore docs are covered by
  Data Integrity below.

## Custom triage rules

The default partition rules read every `.tsx`/`.ts` file as `frontend` and so
leave out the backend reviewers. Here the data layer lives in the same files.
Use these path rules on top of the defaults:

| Path | Also eligible |
|---|---|
| `src/stores/` | Concurrency & State Safety, Data Integrity & Migration, Error Handling & Resilience |
| `src/services/`, `src/services/db/` | Data Integrity & Migration, Error Handling & Resilience, Performance & Scalability (Firestore reads per action) |
| `src/utils/` with stats, history, session or upload logic (`exerciseStats`, `setSummary/`, `sessionDuration`, `workoutProgress`) | Domain Logic Reviewer, Logic Simplicity Reviewer |
| `src/scripts/`, `scripts/` | Data Integrity & Migration, Security & Trust (they write to the real Firebase project) |
| `firestore.rules`, `firestore.indexes.json` | Security & Trust, Infrastructure & Deployment |
| `design/` only (boards, `canvas.json`) | Spec & Claims Conformance only; skip code reviewers |

Panel sizes from the skill still apply. When over the limit, drop
Performance or Documentation before the always-include reviewers.

## Project context

- **Stack:** Expo / React Native, TypeScript, Zustand stores, AsyncStorage for the
  active workout and caches, Firestore with an upload queue for finished sessions.
  Android emulator is the main test device; iOS is usually untested, so say so.
- **Offline-first:** a workout must log and finish with no network ("Saved on this
  phone"), then upload. Every read shows a distinct failed/offline state, never a
  plausible default (CLAUDE.md 2.4).
- **Pre-launch, ~5–10 users:** stored shapes can change without migrations or
  backfill. Still flag a shape change: later tickets read these docs.
- **Spec sources:** `TICKETS.md` (the ticket's "Decided", "Code design", "Build"
  and acceptance-criteria sections; the Pending table and Recommended Execution
  Order). Design boards are in `design/workout-flow/project/` (mirror of the
  Workout Flow canvas). CLAUDE.md sets the working rules (tiers, attribution of
  bugs, "decision where the code is").
- **Conventions to check:**
  - Font sizes are `t.fonts` tokens, never board px.
  - Colours are theme role tokens; `danger` is reserved for Discard.
  - Store actions write through `saveActiveWorkout`; only `setCurrentExerciseIndex` writes memory first.
  - Refusals return `{status:"refused", reason}`, and the menu's `disabledReason` uses the same constant as the store.
  - Tests are kept only once they have been seen failing (CLAUDE.md 3.2).
- **Review output:** post the review as one PR comment (`gh pr comment`); inline
  comments only for real issues. Pass 1 covers everything; later passes cover only
  fixes, new code, or a "missed in pass 1" item with the reason.

## Hot spots (from past device findings)

- **RN `Modal` layering:** the picker's "Search" label drew over the version and
  filter sheets (047, 2026-10-31). Confirm z-order whenever a sheet opens over a
  screen with absolute or floating children.
- **Gestures inside `Modal`:** drag-to-close did nothing until the touch was
  claimed on start (065); other sheets have handles but no drag (068).
- **Modal during another's dismissal on iOS:** Discard's confirm opens while the
  menu sheet slides out (056); untested on iPhone.
- **Android back and navigation history:** back went to the phone's home screen
  (060, `cold-navigation-fix`); footer highlight goes stale (025).
- **Offline reads that look like data:** "First time on this exercise" in airplane
  mode (047); offline cold start showed the first plan, not "Couldn't load plans"
  (`032abe0`).
- **Queued write landing late:** a Save landing after Archive undid it (061,
  caught in review).
- **Selection by object equality after a re-read:** the History dropdown lost the
  Freestyle selection (`29a7529`, device run of 067).
- **Android-only a11y props:** `accessibilityLiveRegion` is used for the Undo bar
  and refusal lines; VoiceOver gets nothing (069).
