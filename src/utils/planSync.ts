// src/utils/planSync.ts
//
// The decisions behind the phone's copy of the plans (TICKET-070), as pure
// functions: whether a stored copy is usable, how an answer merges into what
// is held, what a screen shows, and what a refused save reloads (TICKET-073).
// `usePlansStore` does the I/O around them, on the shared sync runner.
//
// The rules every synced store shares (stamps, `lastSeen`, the skip window,
// when a full reload runs, the stored envelope) moved to the sync core,
// `syncCore.ts` (TICKET-075, TICKET-072 D9). What stays here is the plans'
// own: the `rev` merge (TICKET-073), the full reload's S1 rule, the plan
// shape, and the plans' constants bound into the shared rules. The names the
// plans code and tests already use are kept (re-exported below), so the
// move changed no plans caller or test.

import type { PlanStamp, WorkoutPlan } from "../types/workoutType";
import { compareVersions, toPlanVersion } from "./planVersion";
import { compareStamps, isStamp, lastSeenAfter, openEnvelope } from "./syncCore";
import { PLANS_FORMAT_VERSION } from "../config/storageKeys";

// The plans' names for the core's stamp rules (TICKET-070 D3); the reasons are in syncCore.ts.
export { changeCheckAfter, compareStamps, lastSeenAfter, NO_STAMP_SEEN, toStamp as toPlanStamp } from "./syncCore";

// PLANS_FORMAT_VERSION: value and reason in src/config/storageKeys.ts.

/**
 * What AsyncStorage holds: whose plans, in which format, and where the next
 * check starts. `lastSeen`: the newest `updatedAt` the server has returned,
 * null before any stamped plan came back. `lastFullAt`: when the last full
 * reload answered (phone's clock), for the debug page only (`fullReloadDue`).
 */
export type StoredPlans = {
  formatVersion: number;
  uid: string;
  plans: WorkoutPlan[];
  lastSeen: PlanStamp | null;
  lastFullAt: number | null;
};

export type HeldPlans = Pick<StoredPlans, "plans" | "lastSeen" | "lastFullAt">;

export const serializeStoredPlans = (uid: string, held: HeldPlans): string =>
  JSON.stringify({ formatVersion: PLANS_FORMAT_VERSION, uid, ...held } satisfies StoredPlans);

const isPlan = (value: unknown): value is WorkoutPlan => {
  if (typeof value !== "object" || value === null) return false;
  const { id, name, exercises, updatedAt, version } = value as Partial<WorkoutPlan>;
  return (
    typeof id === "string" &&
    typeof name === "string" &&
    Array.isArray(exercises) &&
    (updatedAt === undefined || isStamp(updatedAt)) &&
    (version === undefined || toPlanVersion(version) !== undefined)
  );
};

/**
 * `lastSeen` after a full reload: the newest stamp among the plans held once
 * the answer is merged, not the newest ever seen (PR #49 review, S1). A full
 * reload sees every plan, so it may move `lastSeen` back: otherwise one stamp
 * in the future (a hand edit in the console with the wrong date or time zone)
 * would pin it ahead of every real Save, and change checks on every phone
 * would miss them for good. Safe: a Save the read ran too early to see has a
 * later stamp than anything here, so the next change check returns it. Cost: a
 * `deleted` marker is not held, so the next change check returns it once.
 * A plan still holding the future stamp keeps `lastSeen` there until it is
 * saved again; then the next full reload heals it.
 */
export function lastSeenAfterFullReload(held: WorkoutPlan[]): PlanStamp | null {
  return lastSeenAfter(null, held);
}

/**
 * D10 (TICKET-073): does `incoming` replace `held`? The higher `rev` wins:
 * the server accepts each `rev` once per plan, so a higher one is a later
 * Save, whatever the clocks say, stamped or not (a Save is held unstamped,
 * with its `rev`, until a check returns it).
 *
 * Equal `rev`: the newer-or-equal `updatedAt` wins, 070's rule. One app Save
 * makes one `rev`, so equal revs are the same Save, or an edit made outside
 * the app, which keeps `rev`: a console edit, which may move `updatedAt` or
 * not. Equal stamps take the server's copy. Rejected: on equal `rev` keeping
 * what is held, which would hide every console edit until the plan is saved
 * again.
 */
const replaces = (incoming: WorkoutPlan, held: WorkoutPlan | undefined): boolean => {
  if (!held) return true;
  const byRev = compareVersions(incoming, held);
  return byRev !== 0 ? byRev > 0 : compareStamps(held.updatedAt, incoming.updatedAt) <= 0;
};

/**
 * A change check's answer, or a confirmed Save, merged into the plans held
 * (D3, D10). Each incoming plan replaces the held one unless that is newer
 * (`replaces`), so a check that started before a Save and answers after it
 * cannot undo the Save. A `deleted` plan is removed (D5). Order as a full read
 * would give (D13).
 */
export function mergeChanges(held: WorkoutPlan[], incoming: WorkoutPlan[]): WorkoutPlan[] {
  return incoming.reduce((plans, plan) => {
    const current = plans.find((p) => p.id === plan.id);
    if (!replaces(plan, current)) return plans;
    if (plan.deleted === true) return plans.filter((p) => p.id !== plan.id);
    return withPlan(plans, plan);
  }, held);
}

/**
 * A full reload's answer (D5): the server's list without its `deleted`
 * markers. It replaces the plans held, which is what drops plans removed
 * outside the app and corrects a held copy the server no longer has.
 *
 * What is held is not consulted (TICKET-078). A full reload runs only with
 * nothing held: the first load, a discarded copy, or Retry, which shows only
 * with nothing stored (`plansView`), and `applySaved` ignores a Save while
 * nothing is held. Rejected: keeping a held plan that arrived after the read
 * started, which served the timed reload TICKET-076 removed.
 *
 * Known gap, accepted: a stalled first load answers, the user saves a plan,
 * and Retry's read, started before that Save, answers after it. The plan
 * shows its old version until the next check returns it. The debug page's
 * full reload can do the same.
 */
export function plansFromFullReload(incoming: WorkoutPlan[]): WorkoutPlan[] {
  return incoming.filter((plan) => plan.deleted !== true);
}

/**
 * The stored copy for `uid`, or null for "nothing stored" (D11). Absent,
 * unreadable, another format version, another user's copy, or any plan in a
 * shape this build does not know: all null, with the reason, never a partial
 * list. Another user's copy can only be here if a sign-out clear was missed
 * (the app was killed mid sign-out); it is never shown.
 */
export function readStoredPlans(raw: string | null, uid: string): { held: HeldPlans | null; error: string | null } {
  const { body, error } = openEnvelope(raw, uid, PLANS_FORMAT_VERSION);
  if (body === null) return { held: null, error };
  const stored = body as Partial<StoredPlans>;
  if (!Array.isArray(stored.plans) || !stored.plans.every(isPlan)) return { held: null, error: "plans in an unknown shape" };
  const { lastSeen, lastFullAt } = stored;
  if ((lastSeen !== null && !isStamp(lastSeen)) || (lastFullAt !== null && typeof lastFullAt !== "number"))
    return { held: null, error: "check times in an unknown shape" };
  return { held: { plans: stored.plans, lastSeen, lastFullAt }, error: null };
}

/**
 * `plan` put into `plans` (D13): an existing plan is replaced where it
 * stands; a new one goes where a full read would put it, so the order is the
 * same before and after the next full reload. A Firestore query with no
 * `orderBy` returns documents by id; auto ids are ASCII letters and digits,
 * so JS string order matches Firestore's byte order.
 */
function withPlan(plans: WorkoutPlan[], plan: WorkoutPlan): WorkoutPlan[] {
  const at = plans.findIndex((p) => p.id === plan.id);
  if (at !== -1) return plans.map((p, i) => (i === at ? plan : p));
  const before = plans.findIndex((p) => p.id > plan.id);
  return before === -1 ? [...plans, plan] : [...plans.slice(0, before), plan, ...plans.slice(before)];
}

/**
 * Did the server refuse this save because the plan changed on another device
 * (TICKET-073 D7)? firestore.rules refuses a Save not made on the stored
 * version with `permission-denied`, the Firestore error code for any refused rule. Every
 * other failure (offline, quota, a bad field) keeps Save's usual handling.
 * The rule refuses another user's write the same way, but Save only ever
 * writes the signed-in user's own plans, so for Save this code means its
 * version was not the stored one.
 */
export const isRefusedSave = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "permission-denied";

/**
 * The plans held after reading one plan from the server for a refused save
 * (D7): the server's copy replaces the held one whatever D10 says, since the
 * server just refused a save based on the held one. `null`: the server has
 * no such plan (removed outside the app), so it goes, as a full reload would
 * drop it; a `deleted` marker likewise. Nothing stored stays nothing stored:
 * one plan is not the user's plans, and a list of one would read as "this is
 * all of them" (CLAUDE.md 2.4).
 */
export function withServerPlan(plans: WorkoutPlan[] | null, planId: string, plan: WorkoutPlan | null): WorkoutPlan[] | null {
  if (plans === null) return null;
  if (plan === null || plan.deleted === true) return plans.filter((p) => p.id !== planId);
  return withPlan(plans, plan);
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
