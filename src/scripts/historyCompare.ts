// src/scripts/historyCompare.ts
//
// Pure half of compareHistory.ts (TICKET-081 stage 3): what a user's stored
// workouts say, checked against what their own sets say. No Firestore here, so
// all of it is testable (historyCompare.test.ts) on seeded fixtures.
//
// The sets in `sessions.lifts` are the one source of truth. Everything else is
// derived from them and can drift, so this finds where it has:
//  - a verdict that is not what the sets give (`verdictsFromHistory`), pending
//    ones included: the late upload and the replayed phase 2 of 081's known
//    gaps (a) and (b), and a first phase whose second never ran
//  - `exerciseIds` that are not the lifts' ids
//  - `exercise_sessions` that disagree with the lifts, until TICKET-085 drops them
//  - `exercise_stats` that are not what the sets rebuild
import type { ExerciseSessionDoc, ExerciseStatsDoc, LiftReason, LiftVerdict, WorkoutSessionDoc } from "../types/workoutSession";
import { buildExerciseSessionId, rebuildStatsFromSessions } from "../utils/exerciseStats";
import { exerciseSessionsOf, judgeableBefore, readLifts, verdictsFromHistory } from "../utils/liftRecord";

export type VerdictMismatch = {
  sessionId: string;
  liftId: string;
  stored: { verdict: LiftVerdict | null; reason: LiftReason | null };
  expected: { verdict: LiftVerdict | null; reason: LiftReason | null };
};

export type HistoryReport = {
  sessions: number;
  lifts: number;
  /** Sessions whose `lifts` are missing or unreadable (the old shape): skipped by every check below. */
  unreadable: string[];
  verdictMismatches: VerdictMismatch[];
  /**
   * Readable sessions whose verdicts were not judged: they start at or after an unreadable one,
   * which may be a lift's previous session (`judgeableBefore`). Not a mismatch, not a pass.
   */
  verdictsNotJudged: number;
  exerciseIdsMismatches: string[];
  /** `exercise_sessions` doc ids a lift has none for, or whose fields or sets differ. */
  exerciseSessionsDiffer: string[];
  /** `exercise_sessions` doc ids no lift stands for. */
  exerciseSessionsOrphan: string[];
  /** Exercise ids whose stored rollup is not what the sets rebuild, or that have a rollup and no lift. */
  statsDiffer: string[];
};

/** Key order and `updatedAt` aside: Firestore hands keys back sorted, and the stamp is the server's. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (key, v) =>
    key === "updatedAt" ? undefined : v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );

/**
 * How many mismatches of every kind: 0 is the proof. A session this run could not read counts: "0
 * mismatches" must not be said of sets nobody checked.
 */
export const totalMismatches = (r: HistoryReport) =>
  r.unreadable.length + r.verdictMismatches.length + r.exerciseIdsMismatches.length + r.exerciseSessionsDiffer.length +
  r.exerciseSessionsOrphan.length + r.statsDiffer.length;

export function compareHistory(
  sessions: readonly WorkoutSessionDoc[],
  exerciseSessions: readonly ExerciseSessionDoc[],
  stats: readonly ExerciseStatsDoc[]
): HistoryReport {
  const readable = sessions.filter((s) => readLifts(s.lifts) !== null);
  const unreadable = sessions.filter((s) => readLifts(s.lifts) === null).map((s) => s.sessionId);

  const expected = verdictsFromHistory(readable);
  const before = judgeableBefore(sessions.filter((s) => readLifts(s.lifts) === null));
  const verdictMismatches: VerdictMismatch[] = [];
  readable.forEach((stored, i) =>
    stored.lifts.forEach((lift, j) => {
      if (!(stored.startedAt < before)) return;
      const want = expected[i].lifts[j];
      if (lift.verdict !== want.verdict || lift.reason !== want.reason) {
        verdictMismatches.push({
          sessionId: stored.sessionId,
          liftId: lift.id,
          stored: { verdict: lift.verdict, reason: lift.reason },
          expected: { verdict: want.verdict, reason: want.reason },
        });
      }
    })
  );

  const exerciseIdsMismatches = readable
    .filter((s) => canonical(s.exerciseIds) !== canonical(s.lifts.map((l) => l.id)))
    .map((s) => s.sessionId);

  const fromLifts = new Map(
    exerciseSessionsOf(readable).map((e) => [buildExerciseSessionId(e.sessionId, e.exerciseId), e])
  );
  const stored = new Map(exerciseSessions.map((e) => [buildExerciseSessionId(e.sessionId, e.exerciseId), e]));
  const exerciseSessionsDiffer = [...fromLifts]
    .filter(([id, e]) => {
      const have = stored.get(id);
      return !have || canonical([have.fields, have.sets, have.exerciseName]) !== canonical([e.fields, e.sets, e.exerciseName]);
    })
    .map(([id]) => id);
  // Orphans only among the sessions this run could read: a doc of an unreadable session is that session's problem.
  const readableIds = new Set(readable.map((s) => s.sessionId));
  const sessionIds = new Set(sessions.map((s) => s.sessionId));
  const exerciseSessionsOrphan = [...stored]
    .filter(([id, e]) => !fromLifts.has(id) && (readableIds.has(e.sessionId) || !sessionIds.has(e.sessionId)))
    .map(([id]) => id);

  const rebuilt = new Map<string, ExerciseStatsDoc | null>();
  const liftIds = new Set(readable.flatMap((s) => s.lifts.map((l) => l.id)));
  const all = exerciseSessionsOf(readable);
  for (const id of liftIds) rebuilt.set(id, rebuildStatsFromSessions(id, all));
  // A rollup that an unreadable session's lifts fed is not judged: it cannot be rebuilt from sets this run
  // cannot read, so "differs" would be a plausible wrong answer. The session is the finding (`unreadable`).
  const unreadableIds = new Set(unreadable);
  const notJudged = new Set(exerciseSessions.filter((e) => unreadableIds.has(e.sessionId)).map((e) => e.exerciseId));
  const statsDiffer = [
    ...[...liftIds].filter((id) => {
      const have = stats.find((s) => s.exerciseId === id);
      return !notJudged.has(id) && (!have || canonical(have) !== canonical(rebuilt.get(id)));
    }),
    ...stats.filter((s) => !liftIds.has(s.exerciseId) && !notJudged.has(s.exerciseId)).map((s) => s.exerciseId),
  ];

  return {
    sessions: sessions.length,
    lifts: readable.reduce((sum, s) => sum + s.lifts.length, 0),
    unreadable,
    verdictMismatches,
    verdictsNotJudged: readable.filter((s) => !(s.startedAt < before)).length,
    exerciseIdsMismatches,
    exerciseSessionsDiffer,
    exerciseSessionsOrphan,
    statsDiffer,
  };
}

/**
 * Why a rebuild must not write, or null when it may. A rebuild counts only sessions with readable
 * `lifts`, so on a mixed account it lowers every best that came only from the others: a plausible
 * wrong number (CLAUDE.md 2.4). A session logged on the phone after TICKET-081 makes any old-shape
 * account mixed, so this is reachable, not theoretical. A dry run is never refused: it is how
 * the sessions at risk are listed. `ignoreUnreadable` is the explicit way through.
 */
export function rebuildRefusal(
  unreadable: number,
  run: { confirm: boolean; ignoreUnreadable: boolean }
): string | null {
  if (!run.confirm || run.ignoreUnreadable || unreadable === 0) return null;
  return `${unreadable} session(s) have no readable lifts and would not be counted: bests that came only from them would be lowered. Re-import or wipe them first, or pass --ignore-unreadable to rebuild without them.`;
}
