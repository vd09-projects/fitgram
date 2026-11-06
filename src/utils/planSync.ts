// src/utils/planSync.ts
//
// The decisions behind the phone's copy of the plans (TICKET-070 stage 1), as
// pure functions: whether a stored copy is usable, whether a screen opening
// runs a check, where a saved plan goes, and what a screen shows.
// `usePlansStore` does the I/O around them.

import type { WorkoutPlan } from "../types/workoutType";

/**
 * Format of the stored copy. Bump it when the stored shape changes: a copy
 * written under another version is discarded and fetched again (D2), never
 * read field by field.
 */
export const PLANS_FORMAT_VERSION = 1;

/** A check that succeeded this recently makes the next screen skip its own (D4). */
export const PLANS_CHECK_SKIP_MS = 2 * 60 * 1000;

/**
 * How long a screen with nothing stored waits on a check before it shows
 * "Couldn't load plans" (D9). The check is not cancelled: its answer still
 * applies when it arrives. Its own constant, not `SAVE_GRACE_MS`: a save and a
 * read fail offline differently, and one may need tuning without the other.
 */
export const PLANS_CHECK_WAIT_MS = 10_000;

/** What AsyncStorage holds: whose plans, in which format. */
export type StoredPlans = { formatVersion: number; uid: string; plans: WorkoutPlan[] };

export const serializeStoredPlans = (uid: string, plans: WorkoutPlan[]): string =>
  JSON.stringify({ formatVersion: PLANS_FORMAT_VERSION, uid, plans } satisfies StoredPlans);

const isPlan = (value: unknown): value is WorkoutPlan => {
  if (typeof value !== "object" || value === null) return false;
  const { id, name, exercises } = value as Partial<WorkoutPlan>;
  return typeof id === "string" && typeof name === "string" && Array.isArray(exercises);
};

/**
 * The stored copy for `uid`, or null for "nothing stored" (D11). Absent,
 * unreadable, another format version, another user's copy, or any plan in a
 * shape this build does not know: all null, with the reason, never a partial
 * list. Another user's copy can only be here if a sign-out clear was missed
 * (the app was killed mid sign-out); it is never shown.
 */
export function readStoredPlans(raw: string | null, uid: string): { plans: WorkoutPlan[] | null; error: string | null } {
  if (raw === null) return { plans: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { plans: null, error: `unreadable JSON (${String(error)})` };
  }
  const stored = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Partial<StoredPlans>;
  if (stored.formatVersion !== PLANS_FORMAT_VERSION)
    return { plans: null, error: `format version ${String(stored.formatVersion)}, this build reads ${PLANS_FORMAT_VERSION}` };
  if (stored.uid !== uid) return { plans: null, error: "stored for another user" };
  if (!Array.isArray(stored.plans) || !stored.plans.every(isPlan)) return { plans: null, error: "plans in an unknown shape" };
  return { plans: stored.plans, error: null };
}

/**
 * Whether a screen opening skips its check (D4): a check succeeded less than
 * `PLANS_CHECK_SKIP_MS` ago. Only a success counts (D11): after a failure the
 * next screen tries again. Try again and Reload pass `force`.
 */
export function shouldSkipCheck(lastOkAt: number | null, now: number, force = false): boolean {
  if (force || lastOkAt === null) return false;
  return now - lastOkAt < PLANS_CHECK_SKIP_MS;
}

/**
 * The stored plans after the server confirmed a Save of `plan` (D8). An
 * existing plan is replaced where it stands; a new one goes where a full read
 * would put it, so the order is the same before and after the next check
 * (D13). A Firestore query with no `orderBy` returns documents by id;
 * auto ids are ASCII letters and digits, so JS string order matches
 * Firestore's byte order.
 *
 * Nothing stored stays nothing stored: one plan is not the user's plans, and
 * a list of one would read as "this is all of them" (CLAUDE.md 2.4). The next
 * check fills it.
 */
export function withSavedPlan(plans: WorkoutPlan[] | null, plan: WorkoutPlan): WorkoutPlan[] | null {
  if (plans === null) return null;
  const at = plans.findIndex((p) => p.id === plan.id);
  if (at !== -1) return plans.map((p, i) => (i === at ? plan : p));
  const before = plans.findIndex((p) => p.id > plan.id);
  return before === -1 ? [...plans, plan] : [...plans.slice(0, before), plan, ...plans.slice(before)];
}

/** One empty list for every "no plans" render, so memoised readers do not recompute. */
const NO_PLANS: WorkoutPlan[] = [];

export type PlansState = {
  plans: WorkoutPlan[] | null;
  /** The stored copy has been read (or found absent) for this user. */
  storedRead: boolean;
  checking: boolean;
  /** The running check has outlasted `PLANS_CHECK_WAIT_MS`. */
  waitOver: boolean;
  lastResult: "ok" | "failed" | null;
};

/**
 * What a screen shows, in `useWorkoutPlans`'s return shape. Three states kept
 * apart (D11):
 * - plans stored (empty or not): shown, never loading or failed, whatever a
 *   check is doing. "Stored, no plans" with a failed check is the first-run
 *   state, not "did not load": the stored copy says there are none.
 * - nothing stored, a check running within its wait: loading.
 * - nothing stored, the last check failed or ran past its wait: failed (D12).
 */
export function plansView(state: PlansState): {
  workoutPlans: WorkoutPlan[];
  loadingWorkoutPlans: boolean;
  failedToLoad: boolean;
} {
  if (state.plans !== null) return { workoutPlans: state.plans, loadingWorkoutPlans: false, failedToLoad: false };
  const failed =
    state.storedRead && (state.checking ? state.waitOver : state.lastResult === "failed");
  return { workoutPlans: NO_PLANS, loadingWorkoutPlans: !failed, failedToLoad: failed };
}
