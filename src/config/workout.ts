// src/config/workout.ts
//
// Logging and editing a workout: the rest timer, the default set target, how
// long Save and Finish wait on the server, and the plan name length. Rule for
// this folder: src/config/README.md.

/** What a rest-duration preference falls back to: 1:30, the design's target. */
export const DEFAULT_REST_MS = 90_000;

/** What one tap of add-time adds. */
export const ADD_REST_MS = 30_000;

/**
 * Planned set count assumed for an exercise with no usable history. The plan
 * records no set count, so without last session to go on this is a guess —
 * chosen deliberately over showing nothing. 3 is the common default; at 2 sets
 * the segment reads 67%, at 3 it is full.
 *
 * Rejected, after a device test: one 3px tick per set with no target. It was
 * honest (a count, not a ratio) but any mark inside a bar reads as a
 * percentage, so 2 logged sets looked like 3% progress.
 */
export const DEFAULT_TARGET_SETS = 3;

/**
 * How long Save waits for the server before saying the plan is not saved yet.
 * With `memoryLocalCache` (firebase.ts), `setDoc` resolves only on the server's
 * acknowledgement and never while offline, so an unbounded await would leave
 * Save spinning (offline rule, D4).
 */
export const SAVE_GRACE_MS = 10_000;

/**
 * How long Finish waits on the upload before telling the user it will upload
 * later. Only picks the message: the workout has already left the active slot.
 * Offline, `batch.commit()` does not reject — it stays pending until the
 * connection returns (TICKET-028 step 0) — so without a bound Finish would wait
 * as long as the user is offline.
 */
export const UPLOAD_GRACE_MS = 3000;

/** Longest plan name a new plan accepts, in characters once normalised (`validatePlanName`). */
export const PLAN_NAME_MAX = 40;
