// src/scripts/baselineVerdict.ts
//
// The verdict of one lift against its previous session, from the app's own
// comparison (`todaySummary`), shared by the baseline measurement and the
// History fixtures. "Previous session" is the lift's last session before this
// one by `performedAt`, in any workout: what the app's history holds as
// `lastSession`. Definitions of the buckets: measureBaseline.ts.
import type { ExerciseSessionDoc, StatsSessionEntry } from "../types/workoutSession";
import type { ExerciseField } from "../types/workoutType";
import { deriveExerciseHistory } from "../utils/exerciseHistory";
import { buildStatsSessionEntry } from "../utils/exerciseStats";
import { decodeStoredSets } from "../utils/storedSets";
import { todaySummary } from "../utils/setDeltas";


/** Why a measure has no weight x reps pair, by what it does have. */
function noPairKind(fields: ExerciseField[]): string {
  const roles = new Set(fields.map((f) => f.role));
  if (roles.has("time") || roles.has("distance")) return "time or distance";
  if (roles.has("reps") && roles.has("other")) return "assisted (other + reps)";
  if (roles.has("reps") && fields.length === 1) return "reps only";
  return "other";
}

export type Bucket = string;
export type Verdict = { bucket: Bucket; moreSetsOnly: boolean; percent?: number };

export function verdictFor(previous: ExerciseSessionDoc | null, today: ExerciseSessionDoc): Verdict {
  const stats = previous
    ? {
        exerciseId: today.exerciseId,
        exerciseName: today.exerciseName,
        lastPerformedAt: previous.performedAt,
        fields: today.fields,
        recentSessions: [buildStatsSessionEntry(previous) as StatsSessionEntry],
        bestByReps: {},
        volumeHistory: [],
      }
    : null;
  const history = deriveExerciseHistory({ exerciseId: today.exerciseId, status: "ready", stats, error: null }, today.fields);
  const todaySets = decodeStoredSets(today.sets);
  const summary = todaySummary(history, todaySets, today.fields);
  const c = summary.comparison;
  if (c.kind === "percent") {
    const bucket = c.direction > 0 ? "Better" : c.direction < 0 ? "Lower" : "Same";
    let moreSetsOnly = false;
    if (c.direction > 0 && previous && todaySets.length > previous.sets.length) {
      const trimmed = todaySummary(history, todaySets.slice(0, previous.sets.length), today.fields);
      moreSetsOnly = trimmed.comparison.kind === "percent" && trimmed.comparison.direction <= 0;
    }
    return { bucket, moreSetsOnly, percent: c.percent };
  }
  if (c.reason === "noComparison") return { bucket: `none: ${noPairKind(today.fields)}`, moreSetsOnly: false };
  return { bucket: `none: ${c.reason}`, moreSetsOnly: false };
}

