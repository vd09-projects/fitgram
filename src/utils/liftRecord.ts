// src/utils/liftRecord.ts
//
// The two halves of a stored `lifts` array that are not the builder
// (`buildSessionDocs`) or the verdict rule (`liftVerdict.ts`): choosing the
// previous session and putting verdicts on the record, and reading a stored
// array without trusting it. Pure; tests in liftRecord.test.ts.

import type { ExerciseStatsDoc, LiftReason, LiftRecord, LiftVerdict, WorkoutSessionDoc } from "../types/workoutSession";
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
