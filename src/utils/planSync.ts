// src/utils/planSync.ts
//
// The decisions behind the phone's copy of the plans (TICKET-070), as pure
// functions: whether a stored copy is usable, whether a screen opening runs a
// check and which kind, how an answer merges into what is held, what a
// screen shows, and what a refused save reloads (TICKET-073). `usePlansStore`
// does the I/O around them.

import type { PlanStamp, WorkoutPlan } from "../types/workoutType";

/**
 * Format of the stored copy. Bump it when the stored shape changes: a copy
 * written under another version is discarded and fetched again (D2), never
 * read field by field.
 */
export const PLANS_FORMAT_VERSION = 4; // 2: `lastSeen` and `lastFullAt` (070 stage 2); 3: each plan's `rev` (073); 4: its `saveId` (073, PR #50)

/** A check that succeeded this recently makes the next screen skip its own (D4). */
export const PLANS_CHECK_SKIP_MS = 2 * 60 * 1000;

/**
 * How long a screen with nothing stored waits on a check before it shows
 * "Couldn't load plans" (D9). The check is not cancelled: its answer still
 * applies when it arrives. Its own constant, not `SAVE_GRACE_MS`: a save and a
 * read fail offline differently, and one may need tuning without the other.
 */
export const PLANS_CHECK_WAIT_MS = 10_000;

/**
 * D5: a check is a full reload when this long has passed since the last one,
 * so plans removed outside the app (console, scripts), which leave no doc for
 * a change check to return, go from the phone within a week. 7 days, not 2:
 * nothing in the app removes a plan yet, so this catches only hand edits, and
 * a full reload costs one read per plan (up to 20) against 1 for a change
 * check. The future Delete's `REMOVAL_WINDOW` must be at least this long (D5);
 * that ticket adds the test that pins it. Timed by the phone's clock: unlike
 * `lastSeen`, it is only a schedule, and a wrong clock costs a reload early
 * or late, never a missed change (`isFullReloadDue`).
 */
export const PLANS_FULL_RELOAD_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What AsyncStorage holds: whose plans, in which format, and where the next
 * check starts. `lastSeen`: the newest `updatedAt` the server has returned,
 * null before any stamped plan came back. `lastFullAt`: when the last full
 * reload answered (phone's clock).
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

const isStamp = (value: unknown): value is PlanStamp => {
  if (typeof value !== "object" || value === null) return false;
  const { seconds, nanoseconds } = value as Partial<PlanStamp>;
  return Number.isInteger(seconds) && Number.isInteger(nanoseconds);
};

const isRev = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const isPlan = (value: unknown): value is WorkoutPlan => {
  if (typeof value !== "object" || value === null) return false;
  const { id, name, exercises, updatedAt, rev, saveId } = value as Partial<WorkoutPlan>;
  return (
    typeof id === "string" &&
    typeof name === "string" &&
    Array.isArray(exercises) &&
    (updatedAt === undefined || isStamp(updatedAt)) &&
    (rev === undefined || isRev(rev)) &&
    (saveId === undefined || typeof saveId === "string")
  );
};

/**
 * A plan's `rev` as read from Firestore, or undefined for "none" (TICKET-073
 * D6). A whole number from 0 up; anything else (only a hand edit could write
 * it) is none, so the phone counts it as 0. firestore.rules cannot add 1 to a
 * stored non-number, so such a plan refuses every save until fixed in the
 * console: `planFromDoc` warns when it drops one.
 */
export function toPlanRev(value: unknown): number | undefined {
  return isRev(value) ? value : undefined;
}

/**
 * A plan's revision (TICKET-073 D6): a missing `rev` counts as 0, as it does
 * in firestore.rules (`resource.data.get('rev', 0)`). Plans saved before 073
 * have none and are never backfilled. 0 is a real revision here, the one
 * before the first save under `rev`, not a stand-in for "unknown"
 * (CLAUDE.md 2.4): the rule reads a missing field the same way.
 */
export const planRev = (plan: Pick<WorkoutPlan, "rev">): number => plan.rev ?? 0;

/**
 * A plan's `updatedAt` as read from Firestore, or undefined for "no stamp".
 * A Firestore Timestamp has `seconds` and `nanoseconds`; anything else (a
 * pre-070 plan has nothing, a console edit could leave a string) is no stamp,
 * never a made-up one: such a plan is seen only by full reloads (D5).
 */
export function toPlanStamp(value: unknown): PlanStamp | undefined {
  return isStamp(value) ? { seconds: value.seconds, nanoseconds: value.nanoseconds } : undefined;
}

/**
 * Orders two stamps. No stamp is older than any stamp: a pre-070 plan has
 * never been saved by this build, so any stamped version of it is newer.
 */
export function compareStamps(a: PlanStamp | null | undefined, b: PlanStamp | null | undefined): number {
  if (!a || !b) return (a ? 1 : 0) - (b ? 1 : 0);
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

/**
 * Where a change check starts: `updatedAt > this`. With no `lastSeen` (no
 * stamped plan has come back yet, e.g. every plan predates 070) it is the
 * Unix epoch, chosen and named, not a 0 that slipped in (CLAUDE.md 2.4):
 * every server stamp is after it, so the check returns every stamped plan,
 * which is none until one is saved. Rejected: a full read instead, which
 * would cost one read per plan on every check until the first Save.
 */
export const NO_STAMP_SEEN: PlanStamp = { seconds: 0, nanoseconds: 0 };
export const changeCheckAfter = (lastSeen: PlanStamp | null): PlanStamp => lastSeen ?? NO_STAMP_SEEN;

/**
 * `lastSeen` after a change check or a Save's read-back: the newest stamp
 * held before or returned now, deleted plans included (their marker was seen;
 * leaving it out would return it on every check). Never moves back, and never
 * past what the server sent. A full reload resets it instead
 * (`lastSeenAfterFullReload`).
 */
export function lastSeenAfter(lastSeen: PlanStamp | null, incoming: WorkoutPlan[]): PlanStamp | null {
  return incoming.reduce<PlanStamp | null>(
    (newest, plan) => (plan.updatedAt && compareStamps(plan.updatedAt, newest) > 0 ? plan.updatedAt : newest),
    lastSeen
  );
}

/**
 * `lastSeen` after a full reload: the newest stamp among the plans held once
 * the answer is merged, not the newest ever seen (PR #49 review, S1). A full
 * reload sees every plan, so it may move `lastSeen` back: otherwise one stamp
 * in the future (a hand edit in the console with the wrong date or time zone)
 * would pin it ahead of every real Save, and change checks on every phone
 * would miss them for good. Safe: a Save made while the read was out stays
 * held with its stamp (`mergeFullReload`), so it is counted. Cost: a
 * `deleted` marker is not held, so the next change check returns it once.
 * A plan still holding the future stamp keeps `lastSeen` there until it is
 * saved again; then the next full reload heals it.
 */
export function lastSeenAfterFullReload(held: WorkoutPlan[]): PlanStamp | null {
  return lastSeenAfter(null, held);
}

/**
 * Is the next check a full reload (D5)? Asked for (Try again, Reload);
 * nothing stored (the first load: "nothing stored", not "app launch", or every
 * cold start would read every plan); never reloaded fully; or the interval
 * has passed. A `lastFullAt` in the future means the clock moved back since:
 * due, rather than waiting for the clock to catch up.
 */
export function isFullReloadDue(input: {
  requested: boolean;
  hasStored: boolean;
  lastFullAt: number | null;
  now: number;
}): boolean {
  const { requested, hasStored, lastFullAt, now } = input;
  if (requested || !hasStored || lastFullAt === null) return true;
  const since = now - lastFullAt;
  return since < 0 || since >= PLANS_FULL_RELOAD_INTERVAL_MS;
}

/**
 * D10 (TICKET-073): does `incoming` replace `held`? The higher `rev` wins:
 * the server accepts each `rev` once per plan, so a higher one is a later
 * Save, whatever the clocks say, stamped or not (a Save whose stamp could not
 * be read back is held unstamped, with its `rev`).
 *
 * Equal `rev`: the newer-or-equal `updatedAt` wins, 070's rule. One app Save
 * makes one `rev`, so equal revs are the same Save, or an edit made outside
 * the app, which keeps `rev`: a console edit, which may move `updatedAt` or
 * not. Equal stamps take the server's copy, so such an edit shows on a full
 * reload. Rejected: on equal `rev` keeping what is held, which would hide
 * every console edit until the plan is saved again.
 */
const replaces = (incoming: WorkoutPlan, held: WorkoutPlan | undefined): boolean => {
  if (!held) return true;
  const byRev = planRev(incoming) - planRev(held);
  return byRev !== 0 ? byRev > 0 : compareStamps(held.updatedAt, incoming.updatedAt) <= 0;
};

/**
 * A change check's answer merged into the plans held (D3, D10). Each
 * incoming plan replaces the held one unless that is newer (`replaces`), so
 * a check that started before a Save and answers after it cannot undo the
 * Save. A
 * `deleted` plan is removed (D5). Order as a full read would give (D13).
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
 * A full reload's answer (D5): it replaces the plans held, which is what
 * drops plans removed outside the app, and what corrects a held copy the
 * server no longer has. One exception: a held plan that arrived after the
 * read started, through a Save the read ran too early to see. Told by its
 * stamp alone: everything held when the read started was at most
 * `lastSeenAtStart` (`lastSeen` then), so a held stamp after it arrived
 * since. Such a plan is kept if the answer lacks it (a new plan) or holds an
 * older copy (D10, `replaces`: higher `rev`). Held at or before
 * `lastSeenAtStart`: the server's answer wins, even over a "newer" held copy
 * (PR #49 review: a stamp set in the future by hand would otherwise survive
 * every full reload; a `rev` lowered by hand likewise). `deleted` plans are
 * left out.
 */
export function mergeFullReload(
  held: WorkoutPlan[] | null,
  incoming: WorkoutPlan[],
  lastSeenAtStart: PlanStamp | null
): WorkoutPlan[] {
  const arrivedSince = (held ?? []).filter(
    (plan) => plan.updatedAt && compareStamps(plan.updatedAt, lastSeenAtStart) > 0
  );
  const keep = (current: WorkoutPlan | undefined): current is WorkoutPlan =>
    current !== undefined && arrivedSince.includes(current);

  const answered = new Set(incoming.map((plan) => plan.id));
  const fromServer = incoming.flatMap((plan) => {
    const current = held?.find((p) => p.id === plan.id);
    if (keep(current) && !replaces(plan, current)) return [current];
    return plan.deleted === true ? [] : [plan];
  });
  const newSince = arrivedSince.filter((plan) => !answered.has(plan.id));
  return newSince.reduce(withPlan, fromServer);
}

/**
 * The stored copy for `uid`, or null for "nothing stored" (D11). Absent,
 * unreadable, another format version, another user's copy, or any plan in a
 * shape this build does not know: all null, with the reason, never a partial
 * list. Another user's copy can only be here if a sign-out clear was missed
 * (the app was killed mid sign-out); it is never shown.
 */
export function readStoredPlans(raw: string | null, uid: string): { held: HeldPlans | null; error: string | null } {
  if (raw === null) return { held: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { held: null, error: `unreadable JSON (${String(error)})` };
  }
  const stored = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Partial<StoredPlans>;
  if (stored.formatVersion !== PLANS_FORMAT_VERSION)
    return { held: null, error: `format version ${String(stored.formatVersion)}, this build reads ${PLANS_FORMAT_VERSION}` };
  if (stored.uid !== uid) return { held: null, error: "stored for another user" };
  if (!Array.isArray(stored.plans) || !stored.plans.every(isPlan)) return { held: null, error: "plans in an unknown shape" };
  const { lastSeen, lastFullAt } = stored;
  if ((lastSeen !== null && !isStamp(lastSeen)) || (lastFullAt !== null && typeof lastFullAt !== "number"))
    return { held: null, error: "check times in an unknown shape" };
  return { held: { plans: stored.plans, lastSeen, lastFullAt }, error: null };
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
 * The stored plans after the server confirmed a Save of `plan` (D8), when the
 * read back of its stamp failed: put in as saved, unstamped, whatever is held.
 * Not through `mergeChanges`, where an unstamped plan loses to the stamped one
 * held and the Save would not show.
 *
 * Nothing stored stays nothing stored: one plan is not the user's plans, and
 * a list of one would read as "this is all of them" (CLAUDE.md 2.4). The next
 * check fills it.
 */
export function withSavedPlan(plans: WorkoutPlan[] | null, plan: WorkoutPlan): WorkoutPlan[] | null {
  return plans === null ? null : withPlan(plans, plan);
}

/**
 * Did the server refuse this save because the plan changed on another device
 * (TICKET-073 D7)? firestore.rules refuses a wrong `rev` with
 * `permission-denied`, the Firestore error code for any refused rule. Every
 * other failure (offline, quota, a bad field) keeps Save's usual handling.
 * The rule refuses another user's write the same way, but Save only ever
 * writes the signed-in user's own plans, so for Save this code means `rev`.
 */
export const isRefusedSave = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "permission-denied";

/**
 * After a refused save (D7) and the check that followed it: did the newer
 * version come back? The refused write carried `sentRev`, so the server
 * holds something other than `sentRev - 1`. Held at `sentRev` or above: a
 * later version, read from the server, and the next Save starts from it.
 * Lower (the check did not return the plan, or D10 kept the held copy over a
 * server copy whose `rev` was lowered by hand): read the one plan and take
 * it as the server has it (`withServerPlan`), or every later Save is refused
 * again.
 */
export const refusedPlanCameBack = (held: WorkoutPlan | undefined, sentRev: number): boolean =>
  held !== undefined && planRev(held) >= sentRev;

/**
 * The plans held after reading one plan from the server for a refused save
 * (D7): the server's copy replaces the held one whatever D10 says, since the
 * server just refused a save based on the held one. `null`: the server has
 * no such plan (removed outside the app), so it goes, as a full reload would
 * drop it; a `deleted` marker likewise. Nothing stored stays nothing stored
 * (`withSavedPlan`).
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
