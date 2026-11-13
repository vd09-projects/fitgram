// src/utils/liftRecord.ts
//
// The two halves of a stored `lifts` array that are not the builder
// (`buildSessionDocs`) or the verdict rule (`liftVerdict.ts`): choosing the
// previous session and putting verdicts on the record, and reading a stored
// array without trusting it. Pure; tests in liftRecord.test.ts.

import type { ExerciseSessionDoc, ExerciseStatsDoc, LiftReason, LiftRecord, LiftVerdict, WorkoutSessionDoc } from "../types/workoutSession";
import { STATS_RECENT_SESSION_CAP } from "../config/storedData";
import { liftVerdict, LiftSession } from "./liftVerdict";

export type PreviousSession =
  | { kind: "found"; session: LiftSession }
  | { kind: "first_time" }
  | { kind: "beyond_window" };

/**
 * The lift's session just before `performedAt`, from its rollup's
 * `recentSessions`, which a save's stats transaction already reads (no extra
 * read).
 *
 * "Before" is by start time, not by arrival: a workout uploaded late from the
 * offline queue still finds its true neighbour while that neighbour is inside
 * the window. Its successor's stored verdict is not recomputed: TICKET-081's
 * known gap (a). A replayed save never finds its own entry: it starts at
 * `performedAt`, not before it.
 *
 * **Nothing older in a full window is not First time.** The rollup keeps the
 * newest `STATS_RECENT_SESSION_CAP` sessions, so a session older than all of
 * them has a previous one the window cannot show. That is `beyond_window`, and
 * the caller leaves the verdict `pending` for a repair (the compare script,
 * `rebuildExerciseStats`) rather than print a false "First time". It also
 * catches a replay of a first-ever session that is the oldest of a full
 * window: the window cannot say whether older ones were dropped. Rare, and the
 * repair settles it. Rejected: reading `sessions` for the true neighbour, a
 * query on every save for a case that needs a late upload to reach.
 */
export function previousSessionOf(
  stats: Pick<ExerciseStatsDoc, "recentSessions"> | null,
  performedAt: number
): PreviousSession {
  const recent = stats?.recentSessions ?? [];
  const older = recent
    .filter((entry) => entry.performedAt < performedAt)
    .sort((a, b) => b.performedAt - a.performedAt)[0];
  if (older) return { kind: "found", session: older };
  return recent.length >= STATS_RECENT_SESSION_CAP ? { kind: "beyond_window" } : { kind: "first_time" };
}

/**
 * The record's lifts with their verdicts, from each lift's rollup as it stands
 * before this session is folded in. The one function for the stats transaction
 * (stored) and for a workout still waiting to upload (on the phone, provisional,
 * never stored: the caller marks it so, as 082 wires it).
 */
export function withVerdicts(
  session: Pick<WorkoutSessionDoc, "startedAt" | "lifts">,
  statsOf: (exerciseId: string) => Pick<ExerciseStatsDoc, "recentSessions"> | null
): LiftRecord[] {
  return session.lifts.map((lift) => {
    const previous = previousSessionOf(statsOf(lift.id), session.startedAt);
    if (previous.kind === "beyond_window") return { ...lift, verdict: null, reason: "pending" };
    const current = { fields: lift.fields, sets: lift.sets, performedAt: session.startedAt };
    const result = liftVerdict(current, previous.kind === "found" ? previous.session : null);
    return { ...lift, ...result };
  });
}

const VERDICTS: readonly LiftVerdict[] = ["better", "lower", "same"];
const REASONS: readonly LiftReason[] = ["first_time", "unit_changed", "no_volume", "unreadable", "pending"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isIdName = (value: unknown): boolean =>
  isObject(value) && typeof value.id === "string" && typeof value.name === "string";

/** One stored lift, judged on the fields readers use. Sets are decoded set by set where they are read (`decodeStoredSet`). */
function isLift(value: unknown): value is LiftRecord {
  if (!isObject(value) || !isIdName(value)) return false;
  const { swappedFrom, added, fields, sets, verdict, reason } = value;
  if (swappedFrom !== undefined && !isIdName(swappedFrom)) return false;
  if (added !== undefined && added !== true) return false;
  if (!Array.isArray(fields) || !fields.every((f) => isObject(f) && typeof f.name === "string" && typeof f.role === "string")) {
    return false;
  }
  if (!Array.isArray(sets)) return false;
  // Exactly one of verdict and reason is set.
  if (verdict === null) return typeof reason === "string" && REASONS.includes(reason as LiftReason);
  return typeof verdict === "string" && VERDICTS.includes(verdict as LiftVerdict) && reason === null;
}

/**
 * A stored `lifts` array, or null for "not usable". Refused whole on any
 * doubt, never in part: `firestore.rules` has no field whitelist, so a doc can
 * hold anything, and a shorter list would read as a workout with fewer lifts.
 */
export function readLifts(value: unknown): LiftRecord[] | null {
  return Array.isArray(value) && value.every(isLift) ? value : null;
}

const byStart = (a: Pick<WorkoutSessionDoc, "startedAt" | "sessionId">, b: Pick<WorkoutSessionDoc, "startedAt" | "sessionId">) =>
  a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId);

/**
 * Every lift's verdict recomputed from the sets in `sessions` alone, against
 * the lift's true previous session: the one before it in start order among
 * all the sessions given, however far back. So never "too old" and never a
 * late upload's wrong neighbour. What the import writes (the full history is
 * in hand), what the compare script checks the stored verdicts against, and
 * what the rebuild repairs them with. The save's transaction cannot do this:
 * it sees only a lift's last `STATS_RECENT_SESSION_CAP` sessions.
 *
 * Ties in start time order by `sessionId`, so the answer does not depend on
 * the order the sessions came in. Returns new sessions, in the order given.
 * Sessions must have valid `lifts` (`readLifts`).
 */
export function verdictsFromHistory(sessions: readonly WorkoutSessionDoc[]): WorkoutSessionDoc[] {
  const previousOf = new Map<string, LiftSession | null>();
  const lastByLift = new Map<string, LiftSession>();
  for (const session of [...sessions].sort(byStart)) {
    for (const lift of session.lifts) {
      const current = { fields: lift.fields, sets: lift.sets, performedAt: session.startedAt };
      previousOf.set(`${session.sessionId}|${lift.id}`, lastByLift.get(lift.id) ?? null);
      lastByLift.set(lift.id, current);
    }
  }
  return sessions.map((session) => ({
    ...session,
    lifts: session.lifts.map((lift) => {
      const current = { fields: lift.fields, sets: lift.sets, performedAt: session.startedAt };
      return { ...lift, ...liftVerdict(current, previousOf.get(`${session.sessionId}|${lift.id}`) ?? null) };
    }),
  }));
}

/**
 * The `exercise_sessions` docs the sessions' lifts stand for, as the save
 * writes them beside the record until TICKET-085. How the rebuild gets its
 * input from `sessions` (the one source of truth for sets) and how the compare
 * script checks `exercise_sessions` agrees. Sessions must have valid `lifts`.
 */
export function exerciseSessionsOf(sessions: readonly WorkoutSessionDoc[]): ExerciseSessionDoc[] {
  return sessions.flatMap((session) =>
    session.lifts.map((lift) => ({
      exerciseId: lift.id,
      exerciseName: lift.name,
      sessionId: session.sessionId,
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      performedAt: session.startedAt,
      fields: lift.fields,
      sets: lift.sets,
    }))
  );
}

/**
 * The start time before which verdicts can be judged from the sets, given the sessions whose
 * `lifts` are unreadable (the old shape). A verdict is against the lift's previous session, and
 * an unreadable session may be that previous: its sets are only in `exercise_sessions`, so
 * `verdictsFromHistory` would call the next session First time. So a session that starts at or
 * after the earliest unreadable one is not judged (the compare script) or repaired (the rebuild).
 * Rejected: finding which lifts an unreadable session held, which needs `exercise_sessions` and
 * the old shape's decode; wiping and re-importing it is the answer and is what the scripts say.
 * `Infinity` with none unreadable; `-Infinity`, judging nothing, when one has no usable start.
 */
export function judgeableBefore(unreadable: readonly { startedAt?: unknown }[]): number {
  let before = Infinity;
  for (const { startedAt } of unreadable) {
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return -Infinity;
    before = Math.min(before, startedAt);
  }
  return before;
}

/**
 * The sessions whose stored verdicts differ from what their sets give
 * (`verdictsFromHistory`), with the verdicts corrected: what the rebuild
 * writes. With `onlyExerciseIds`, only those lifts are corrected, so a run
 * limited to one exercise leaves the others' verdicts alone. Sessions with
 * nothing to correct are not returned.
 */
export function repairedSessions(
  sessions: readonly WorkoutSessionDoc[],
  onlyExerciseIds?: ReadonlySet<string>,
  /** Only sessions starting before this are corrected (`judgeableBefore`). */
  before: number = Infinity
): WorkoutSessionDoc[] {
  const expected = verdictsFromHistory(sessions);
  const changed: WorkoutSessionDoc[] = [];
  sessions.forEach((stored, i) => {
    if (!(stored.startedAt < before)) return;
    let differs = false;
    const lifts = stored.lifts.map((lift, j) => {
      const want = expected[i].lifts[j];
      if (onlyExerciseIds && !onlyExerciseIds.has(lift.id)) return lift;
      if (lift.verdict === want.verdict && lift.reason === want.reason) return lift;
      differs = true;
      return { ...lift, verdict: want.verdict, reason: want.reason };
    });
    if (differs) changed.push({ ...stored, lifts });
  });
  return changed;
}
