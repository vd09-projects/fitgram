// src/utils/recents.ts
//
// What the picker remembers (TICKET-050, board A1): the movements the user has
// logged, newest first, and the version each was last logged as. Pure: built
// from the recent workouts store (TICKET-075), plus the workouts finished on
// this phone and not uploaded yet. No read of its own.

import type { Movement, MovementVersion } from "../types/catalog";
import type { LiftRecord, WorkoutSessionDoc } from "../types/workoutSession";
import type { Exercise } from "../types/workoutType";
import type { PendingUpload } from "../types/zustandWorkoutType";
import type { CatalogIndex } from "./catalog";
import { buildSessionDocs } from "./exerciseStats";
import { formatSessionDate } from "./setDeltas";
import { RECENT_LIMIT } from "../config/display";

// RECENT_LIMIT: value and reason in src/config/display.ts.

export type LastUsed = { movement: Movement; version: MovementVersion; performedAt: number };

export type RecentRow =
  | ({ kind: "movement" } & LastUsed)
  | { kind: "custom"; exercise: Exercise; performedAt: number };

export type RecentHistory = {
  /** Movement id → the version last logged. Every movement in the window, not only the first RECENT_LIMIT. */
  lastUsed: ReadonlyMap<string, LastUsed>;
  /** Newest first, one row per movement (never per combination: user, 2026-10-24), at most RECENT_LIMIT. */
  recents: readonly RecentRow[];
};

/**
 * The user's recent history, or null when it is unknown.
 *
 * **"Last used"** = the version of the movement in the newest session that has
 * any of its versions, compared on the session's start time (`startedAt`, or a
 * pending workout's `startTime`: the same clock, as in `buildPlanRows`). Two
 * versions of one movement in the same session (bench and close-grip bench):
 * the first one listed wins; either was used that day.
 *
 * **KNOWN GAP: only as deep as `sessions`**, the months on the phone (TICKET-082; it was
 * the newest 5 of each plan, TICKET-075). A movement last logged before them is
 * not recent and its sheet preselects nothing: one not used in those months.
 * Accepted for the MVP (user, 2026-10-27, D0); `exercise_stats` ordered by `lastPerformedAt` is the
 * deeper source if it matters.
 *
 * `sessions === null` (the query has not returned, or failed) gives null,
 * pending workouts included, like `buildPlanRows`: a pending workout alone
 * would pass itself off as the whole history (user, 2026-10-27).
 *
 * Skipped: ids no longer in the catalog that no plan holds and no workout
 * named. A custom exercise a plan holds is a recent row of its own (D5); one no
 * plan holds any more is named by the workout that logged it (`lifts[].name`,
 * TICKET-082), with the fields it was logged with.
 *
 * Known gap: a lift cannot say whether its id was a custom exercise or a catalog
 * version removed since (neither stores a flag), so a removed catalog version
 * that a workout on the phone used also reads as a Custom row, under its logged name.
 * The fix is a field on the lift at write time; raised in TICKET-082, not built.
 */
export function buildRecentHistory(
  sessions: readonly WorkoutSessionDoc[] | null,
  pendingUploads: readonly PendingUpload[],
  uid: string | null | undefined,
  index: CatalogIndex,
  customExercises: readonly Exercise[]
): RecentHistory | null {
  if (sessions === null) return null;

  const logged: Array<{ exerciseIds: readonly string[]; lifts: ReadonlyArray<Pick<LiftRecord, "id" | "name" | "fields">>; performedAt: number }> =
    sessions.map((s) => ({ exerciseIds: s.exerciseIds, lifts: s.lifts, performedAt: s.startedAt }));
  for (const entry of pendingUploads) {
    if (!uid || entry.uid !== uid) continue;
    // Same builder the upload uses, so an exercise with no sets is not "logged" here either.
    const { session } = buildSessionDocs(entry.workout, entry.endedAt);
    logged.push({ exerciseIds: session.exerciseIds, lifts: session.lifts, performedAt: session.startedAt });
  }
  // Stable sort: on a tie (one session both uploaded and still pending) either copy names the same ids.
  logged.sort((a, b) => b.performedAt - a.performedAt);

  const customById = new Map(customExercises.map((e) => [e.id, e]));
  const lastUsed = new Map<string, LastUsed>();
  const recents: RecentRow[] = [];
  const seenCustom = new Set<string>();
  for (const { exerciseIds, lifts, performedAt } of logged) {
    const liftById = new Map(lifts.map((lift) => [lift.id, lift]));
    for (const id of exerciseIds) {
      const entry = index.get(id);
      if (entry) {
        if (lastUsed.has(entry.movement.id)) continue;
        const last = { movement: entry.movement, version: entry.version, performedAt };
        lastUsed.set(entry.movement.id, last);
        recents.push({ kind: "movement", ...last });
        continue;
      }
      if (seenCustom.has(id)) continue;
      // A plan's own copy first; else the name the workout was logged under (`lifts[].name`, the
      // newest session's, as sessions are newest first). A session whose `lifts` are unreadable
      // names nothing, and its custom exercise is skipped: no name, no row (CLAUDE.md 2.4).
      const lift = liftById.get(id);
      const custom = customById.get(id) ?? (lift?.name.trim() ? { id, name: lift.name, fields: lift.fields } : undefined);
      if (custom) {
        seenCustom.add(id);
        recents.push({ kind: "custom", exercise: custom, performedAt });
      }
    }
  }
  return { lastUsed, recents: recents.slice(0, RECENT_LIMIT) };
}

/** "22 Oct", or "22 Oct 2025" when not this year, in local time. */
export function recentDateLabel(performedAt: number, now: number): string {
  const year = new Date(performedAt).getFullYear();
  const label = formatSessionDate(performedAt);
  return year === new Date(now).getFullYear() ? label : `${label} ${year}`;
}
