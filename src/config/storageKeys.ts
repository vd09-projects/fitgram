// src/config/storageKeys.ts
//
// Every AsyncStorage key the app writes, each beside the format number of what
// it stores, where its store has one. A store without one falls back to its
// default when what it reads does not load (each key says how it checks).
// Every key's name ends in `_KEY`: config.test.ts finds the keys by it.
// Rule for this folder: src/config/README.md.
//
// Not listed: firebase/auth's own session keys (`getReactNativePersistence` in
// services/firebase/firebase.ts). The library names and clears them.

// --- Plans (usePlansStore, TICKET-070) ---

/**
 * AsyncStorage key of the stored plans. ACCOUNT DATA: cleared on sign-out (D2).
 * One key, with the user id inside the value (`StoredPlans.uid`), not a key
 * per user: a missed clear would leave a per-user key on the phone for good;
 * here the next user's first check overwrites it, and it is never shown to
 * them meanwhile (`readStoredPlans`).
 */
export const PLANS_STORAGE_KEY = "workoutPlans";

/**
 * Format of the stored copy, written inside the value (`formatVersion`). Bump
 * it when the stored shape changes: a copy written under another version is
 * discarded and fetched again (D2), never read field by field.
 * 2: `lastSeen` and `lastFullAt` (070 stage 2); 3: each plan's `version` (073).
 *
 * Changes stored data: bumping it discards every phone's stored plans on the
 * next launch, and each phone refetches them in one full reload. Bump it with
 * any change to `StoredPlans` or to the plan shape it holds.
 */
export const PLANS_FORMAT_VERSION = 3;

// --- The workout in progress and the upload queue (useWorkoutStore) ---

/** AsyncStorage key of the workout in progress. Tests use the literal, to pin it. */
export const ACTIVE_WORKOUT_KEY = "activeWorkout";

/**
 * AsyncStorage key of the upload queue, separate from `activeWorkout`. A queue
 * that does not parse is kept aside under `pendingUploads.corrupt.<ms>` (this
 * key plus a suffix), one key per occurrence, and never read back.
 */
export const PENDING_UPLOADS_KEY = "pendingUploads";

/**
 * Format of `activeWorkout` and `pendingUploads`, stored at its own key.
 * Local data written by an older build is dropped once, at the first launch of
 * a build with a higher number (TICKET-042 stage 2). Version 2: exercise ids
 * moved to the catalog's version ids and the test data was wiped, so a queued
 * upload from before would write old ids back into the wiped Firestore, and an
 * active workout would log against them. Version 3 (TICKET-055): sets moved
 * from `fields` + `splits` to `segments`, with no conversion on read. An older
 * workout would crash Today (`segments` undefined) and an older queued upload
 * would write `segments: undefined`, which Firestore rejects on every retry.
 * Rejected: converting on read; no phone holds unsent data (pre-launch).
 *
 * Changes stored data: raise it only for another reset like these. Bumping it
 * discards the workout in progress and every workout not yet uploaded, on
 * every phone, at the next launch.
 */
export const LOCAL_DATA_VERSION = "3";
export const LOCAL_DATA_VERSION_KEY = "localDataVersion";

// --- Catalog cache (useCatalogStore, TICKET-042). No format number: a cache that fails validation is refused. ---

/**
 * AsyncStorage key of the cached catalog. NOT ACCOUNT DATA: sign-out must not
 * clear it (TICKET-042). When TICKET-026 adds the sign-out clear, leave this key
 * out of it; the next user needs the catalog too, and the first sign-in is the
 * only moment with a guaranteed network.
 */
export const CATALOG_CACHE_KEY = "exerciseCatalog";
/** AsyncStorage key of the cached search words. Not account data either, like the catalog's. */
export const SEARCH_WORDS_CACHE_KEY = "exerciseSearchWords";

// --- Preferences. No format number: one small value each. ---

/** The rest timer's duration, in ms (restPreferenceStore). Out of range on read = default. */
export const REST_DURATION_KEY = "rest_duration_ms";
/** The chosen color scheme's name (colorSchemaStore). An unknown name on read = default. */
export const COLOR_SCHEMA_KEY = "color_schema_key";
/** Which guided tours have been seen (useTourStore). Only parsed on read, not checked: JSON that does not parse = none seen. */
export const SEEN_TOURS_KEY = "seen_tours_key";
