// src/utils/workoutsSync.ts
//
// The recent workouts' own rules (TICKET-075 stage 2): how the newest N
// sessions per plan are kept and merged, how `lastSeen` moves, which plans
// are held, and the stored copy. Pure: the store (`useRecentWorkoutsStore`) does
// the reads and the writes. The rules every synced store shares (stamps,
// skip window, when a full reload runs, envelope) are `syncCore.ts`.

import type { WorkoutPlan } from "../types/workoutType";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { FREESTYLE_ID } from "../constants/freestyle";
import { compareStamps, isStamp, lastSeenAfter, openEnvelope, type SyncStamp } from "./syncCore";
import { WORKOUTS_FORMAT_VERSION } from "../config/storageKeys";

// WORKOUTS_PER_PLAN: value and reason in src/config/sync.ts.
// WORKOUTS_FORMAT_VERSION: value and reason in src/config/storageKeys.ts.

/** Plan id → its newest sessions, newest first (`compareSessions`). */
export type WorkoutsByPlan = Record<string, WorkoutSessionDoc[]>;

/**
 * Newest first: `startedAt` descending, then `sessionId` descending, the order
 * Firestore gives `orderBy("startedAt", "desc")` (ties by document id, and the
 * id is the session id). So a plan's held list and a fresh read of it agree
 * on which N are kept, even with two sessions started the same millisecond.
 */
export function compareSessions(a: WorkoutSessionDoc, b: WorkoutSessionDoc): number {
  if (a.startedAt !== b.startedAt) return b.startedAt - a.startedAt;
  return a.sessionId < b.sessionId ? 1 : a.sessionId > b.sessionId ? -1 : 0;
}

/**
 * One plan's held sessions after `incoming` arrives: deduplicated by
 * `sessionId`, ordered by `compareSessions`, the newest `n` kept.
 *
 * A session held and arriving again keeps the copy with the newer stamp, and
 * the incoming one on a tie: an unstamped copy (this phone's own Finish, or
 * a session written before 075) loses to a stamped one (`compareStamps`), so
 * a Finish applied with no read is replaced by the server's copy when a check
 * brings it. Ordered by `startedAt`, never by stamp: a late upload (an old
 * workout uploaded hours later) sits at its start time, and drops out if `n`
 * newer ones are held.
 */
export function mergePlanSessions(
  held: readonly WorkoutSessionDoc[],
  incoming: readonly WorkoutSessionDoc[],
  n: number
): WorkoutSessionDoc[] {
  const byId = new Map(held.map((session) => [session.sessionId, session]));
  for (const session of incoming) {
    const current = byId.get(session.sessionId);
    if (!current || compareStamps(session.updatedAt, current.updatedAt) >= 0) byId.set(session.sessionId, session);
  }
  return [...byId.values()].sort(compareSessions).slice(0, n);
}

/**
 * `incoming` sessions, of any plans, merged into what is held
 * (`mergePlanSessions` per plan). A session whose plan is not held yet starts
 * that plan's list; the plan counts as loaded only once its own query
 * answered (`loaded` in the store), so a partial list never claims to be the
 * plan's newest N.
 */
export function mergeIntoPlans(
  byPlan: WorkoutsByPlan,
  incoming: readonly WorkoutSessionDoc[],
  n: number
): WorkoutsByPlan {
  const grouped = new Map<string, WorkoutSessionDoc[]>();
  for (const session of incoming) grouped.set(session.workoutId, [...(grouped.get(session.workoutId) ?? []), session]);
  const next = { ...byPlan };
  for (const [planId, sessions] of grouped) next[planId] = mergePlanSessions(next[planId] ?? [], sessions, n);
  return next;
}

/**
 * `lastSeen` after a check (070's rules, D3 and S1):
 * - change check: forward only, over every doc it returned (`lastSeenAfter`).
 *   Never past the per-plan loads it ran alongside: a per-plan read sees one
 *   plan, not every write before its newest stamp; moving past it could skip
 *   another plan's write.
 * - full reload: the baseline read's stamp, taken *before* the per-plan
 *   queries, whatever was held, so it may move back (S1: a hand-set future
 *   stamp does not pin it past the next full reload once that doc is gone or
 *   fixed). Rejected: the newest stamp among the per-plan answers, as plans
 *   do from their one query. Across ~N queries a write landing between two of
 *   them could carry a stamp older than another answer's newest, and would
 *   be skipped by every later change check. Anything written after the
 *   baseline has a later stamp, so the next change check returns it;
 *   a duplicate merges away.
 */
export function workoutsLastSeenAfter(
  kind: "full" | "change",
  lastSeen: SyncStamp | null,
  answer: { baseline: SyncStamp | null; changed: readonly WorkoutSessionDoc[] }
): SyncStamp | null {
  return kind === "full" ? answer.baseline : lastSeenAfter(lastSeen, answer.changed);
}

/**
 * The plan ids whose workouts are held: every plan the plans store holds,
 * archived ones included, plus Freestyle (`FREESTYLE_ID`). Null while the
 * plans store holds nothing: no load then, and readers say "last session
 * unknown".
 *
 * Archived plans are read too, once each: Start lists them with their date
 * when shown, and unarchiving one then needs no read. Archiving drops
 * nothing held. Rejected: skipping them, which saves up to
 * `WORKOUTS_PER_PLAN` reads per archived plan on a first load and leaves their rows undated.
 */
export function planIdsToHold(plans: readonly WorkoutPlan[] | null): string[] | null {
  if (plans === null) return null;
  return [...plans.filter((plan) => !plan.deleted).map((plan) => plan.id), FREESTYLE_ID];
}

/** Every held session, newest first: what `buildPlanRows` and `buildRecentHistory` read. */
export const heldSessions = (byPlan: WorkoutsByPlan): WorkoutSessionDoc[] =>
  Object.values(byPlan).flat().sort(compareSessions);

// ---------------------------------------------------------------------------
// The stored copy.
// ---------------------------------------------------------------------------

/**
 * What AsyncStorage holds. `n`: the `WORKOUTS_PER_PLAN` the copy was built
 * with; another `n` discards it. `loaded`: plans whose own query answered.
 */
export type StoredWorkouts = {
  formatVersion: number;
  uid: string;
  n: number;
  byPlan: WorkoutsByPlan;
  loaded: string[];
  lastSeen: SyncStamp | null;
  lastFullAt: number | null;
};

export type HeldWorkouts = Omit<StoredWorkouts, "formatVersion" | "uid" | "n">;

export const serializeStoredWorkouts = (uid: string, n: number, held: HeldWorkouts): string =>
  JSON.stringify({ formatVersion: WORKOUTS_FORMAT_VERSION, uid, n, ...held } satisfies StoredWorkouts);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** The fields readers and merges use. Anything else in the doc is carried, not checked. */
const isSession = (value: unknown): value is WorkoutSessionDoc => {
  if (typeof value !== "object" || value === null) return false;
  const { sessionId, workoutId, startedAt, endedAt, exerciseIds, updatedAt } = value as Partial<WorkoutSessionDoc>;
  return (
    typeof sessionId === "string" &&
    typeof workoutId === "string" &&
    Number.isFinite(startedAt) &&
    Number.isFinite(endedAt) &&
    isStringArray(exerciseIds) &&
    (updatedAt === undefined || isStamp(updatedAt))
  );
};

/**
 * The stored copy for `uid` built with `n` per plan, or null for "nothing
 * stored", with the reason. Refused whole on any doubt, never in part. A copy
 * built with another `n` is refused in both directions: a smaller `n` could
 * be trimmed, but a larger one needs a refill anyway, and one rule (refill,
 * one first load) is simpler than two.
 */
export function readStoredWorkouts(
  raw: string | null,
  uid: string,
  n: number
): { held: HeldWorkouts | null; error: string | null } {
  const { body, error } = openEnvelope(raw, uid, WORKOUTS_FORMAT_VERSION);
  if (body === null) return { held: null, error };
  const stored = body as Partial<StoredWorkouts>;
  if (stored.n !== n) return { held: null, error: `built with ${String(stored.n)} per plan, this build keeps ${n}` };
  const { byPlan, loaded, lastSeen, lastFullAt } = stored;
  const plansOk =
    typeof byPlan === "object" &&
    byPlan !== null &&
    Object.values(byPlan).every((sessions) => Array.isArray(sessions) && sessions.every(isSession));
  if (!plansOk || !isStringArray(loaded))
    return { held: null, error: "workouts in an unknown shape" };
  if ((lastSeen !== null && !isStamp(lastSeen)) || (lastFullAt !== null && typeof lastFullAt !== "number"))
    return { held: null, error: "check times in an unknown shape" };
  return { held: { byPlan, loaded, lastSeen, lastFullAt }, error: null };
}
