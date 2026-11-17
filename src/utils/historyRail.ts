// src/utils/historyRail.ts
//
// TICKET-085a stage 2: the rows of the History home's Workouts tab, as data. Pure: workouts in, a flat
// row list out, so every rule here is tested without a screen, and a wrong grouping cannot hide as a
// plausible list (CLAUDE.md 3.2). The screen draws rows and owns the taps.
//
// What the list is, top to bottom (boards HistHome01 to 25):
// 1. The full section: the current month's workouts, and when they number fewer than
//    `HISTORY_RAIL_MIN_FULL`, the next newest ones until it has that many. Each month in it has a
//    label row. The last month may be cut: its newest workouts are here.
// 2. "Earlier": one collapsed row per month left on the phone. A cut month's row counts only what
//    is left ("6 more workouts"). A row opened in place lists its workouts under it.
// 3. The older workouts loaded by page (`older`), with plain month labels and no count: the phone
//    does not know how many a month holds (TICKET-088). A month with no workouts between two of them
//    is one quiet line.
// 4. Last: the "Older workouts" row while there may be more, or "Your first workout" once not.

import { buildSessionDocs } from "./exerciseStats";
import { withVerdicts } from "./liftRecord";
import { workoutVerdict, type LiftVerdictResult, type WorkoutVerdict } from "./liftVerdict";
import { localMonthKey } from "./monthWindow";
import { compareSessions } from "./workoutWindow";
import { HISTORY_RAIL_MIN_FULL } from "../config/display";
import type { PendingUpload } from "../types/zustandWorkoutType";
import type { ExerciseStatsDoc, WorkoutSessionDoc } from "../types/workoutSession";

/** `uploaded`: on the server. `waiting`: queued, never rejected. `failed`: the server rejected it at least once. */
export type RailWorkout = { session: WorkoutSessionDoc; state: "uploaded" | "waiting" | "failed" };

export type RailRow =
  | { kind: "monthLabel"; key: string; month: string; label: string }
  | { kind: "workout"; key: string; workout: RailWorkout; verdict: WorkoutVerdict | null }
  | { kind: "earlier"; key: string }
  | { kind: "monthRow"; key: string; month: string; label: string; count: number; cut: boolean; open: boolean }
  | { kind: "gap"; key: string; text: string }
  | { kind: "olderMore"; key: string }
  | { kind: "end"; key: string; text: string; onlyOne: boolean };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A month's name, with its year when it is not the current year's: "November", "March 2025".
 * A month key is `YYYY-MM` (`localMonthKey`).
 */
export function monthLabel(month: string, nowMonth: string): string {
  const [year, number] = month.split("-");
  const name = MONTH_NAMES[Number(number) - 1];
  return year === nowMonth.split("-")[0] ? name : `${name} ${year}`;
}

/** The month before `month` (`YYYY-MM`). */
const monthBefore = (month: string): string => {
  const [year, number] = month.split("-").map(Number);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, "0")}`;
};

/**
 * The quiet line for the months with no workouts between `newer` and `older` (both keys of months that
 * have workouts), or null when they are neighbours. One month: "No workouts in September". More: one line
 * for the whole break, "No workouts from March to July", oldest month first as the list reads.
 */
export function gapLine(newer: string, older: string, nowMonth: string): string | null {
  const newestEmpty = monthBefore(newer);
  if (newestEmpty <= older) return null;
  let oldestEmpty = newestEmpty;
  while (monthBefore(oldestEmpty) > older) oldestEmpty = monthBefore(oldestEmpty);
  return oldestEmpty === newestEmpty
    ? `No workouts in ${monthLabel(newestEmpty, nowMonth)}`
    : `No workouts from ${monthLabel(oldestEmpty, nowMonth)} to ${monthLabel(newestEmpty, nowMonth)}`;
}

/**
 * The word for a workout, or null when it has none to show. `pending` (a lift not computed yet, or older
 * than a lift's rollup window) is a verdict with no word (`workoutVerdict`); a workout whose lifts could
 * not be read has no verdict at all, and the screen says so (`session.liftsUnreadable`).
 */
export const verdictOf = (session: WorkoutSessionDoc): WorkoutVerdict | null =>
  session.liftsUnreadable
    ? null
    : workoutVerdict(
        session.lifts.map((lift): LiftVerdictResult =>
          lift.verdict !== null ? { verdict: lift.verdict, reason: null } : { verdict: null, reason: lift.reason ?? "pending" }
        )
      );

/**
 * The workouts of this user that are in the upload queue, as rail workouts with provisional verdicts:
 * `withVerdicts` over the held summaries, as the stats transaction will compute them, never stored. A
 * lift stays `pending` (no word) when the summaries are not held at all (`summaryOf` null): a missing
 * summary would otherwise read as "nothing before", a guessed "First time" (CLAUDE.md 2.4). With them held,
 * an exercise that has none is first time, as the stats transaction will find it. An entry
 * whose session is already in `held` (uploaded, queue not yet drained) is the held copy, not a second row.
 */
export function mergePending(
  held: readonly WorkoutSessionDoc[],
  pending: readonly PendingUpload[],
  uid: string | undefined,
  summaryOf: ((exerciseId: string) => Pick<ExerciseStatsDoc, "recentSessions"> | null) | null
): RailWorkout[] {
  const heldIds = new Set(held.map((session) => session.sessionId));
  const waiting = pending
    .filter((entry) => entry.uid === uid && !heldIds.has(entry.sessionId))
    .map((entry): RailWorkout => {
      const { session } = buildSessionDocs(entry.workout, entry.endedAt);
      const lifts = summaryOf === null ? session.lifts : withVerdicts(session, summaryOf);
      return { session: { ...session, lifts }, state: entry.failedAttempts > 0 ? "failed" : "waiting" };
    });
  return [...held.map((session): RailWorkout => ({ session, state: "uploaded" })), ...waiting].sort((a, b) =>
    compareSessions(a.session, b.session)
  );
}

export type RailInput = {
  /** The window's workouts plus the queue (`mergePending`), any order. Not the floor: a plan's old newest workout is no month's. */
  held: readonly RailWorkout[];
  /** Workouts loaded by page, all older than everything in `held`, any order. */
  older: readonly RailWorkout[];
  now: number;
  /** Month keys opened in place. */
  openMonths: ReadonlySet<string>;
  /** Only this plan's workouts, or null for all. */
  planId: string | null;
  /**
   * Is the oldest workout there is on the phone? True when the window holds the whole history, or paging reached the first
   * workout. Then there is no "Older workouts" row, and the list ends with the first-workout line.
   */
  reachedStart: boolean;
};

export function buildRail(input: RailInput): RailRow[] {
  const { now, openMonths, planId, reachedStart } = input;
  const keep = (workout: RailWorkout) => planId === null || workout.session.workoutId === planId;
  const held = input.held.filter(keep).sort((a, b) => compareSessions(a.session, b.session));
  const older = input.older.filter(keep).sort((a, b) => compareSessions(a.session, b.session));
  const nowMonth = localMonthKey(now);
  const month = (workout: RailWorkout) => localMonthKey(workout.session.startedAt);
  const workoutRow = (workout: RailWorkout): RailRow => ({
    kind: "workout",
    key: workout.session.sessionId,
    workout,
    verdict: workout.state === "uploaded" ? verdictOf(workout.session) : null,
  });

  // The current month in full, and at least HISTORY_RAIL_MIN_FULL workouts. A workout dated after
  // the current month (a wrong clock) counts as current: it must not drop out of the rail.
  const inCurrentMonth = held.filter((workout) => month(workout) >= nowMonth).length;
  const fullCount = Math.min(held.length, Math.max(inCurrentMonth, HISTORY_RAIL_MIN_FULL));
  const full = held.slice(0, fullCount);
  const rest = held.slice(fullCount);

  const rows: RailRow[] = [];
  let lastMonth: string | null = null;
  for (const workout of full) {
    if (month(workout) !== lastMonth) {
      lastMonth = month(workout);
      rows.push({ kind: "monthLabel", key: `label-${lastMonth}`, month: lastMonth, label: monthLabel(lastMonth, nowMonth) });
    }
    rows.push(workoutRow(workout));
  }

  if (rest.length > 0) {
    rows.push({ kind: "earlier", key: "earlier" });
    const months = new Map<string, RailWorkout[]>();
    for (const workout of rest) months.set(month(workout), [...(months.get(month(workout)) ?? []), workout]);
    for (const [key, workouts] of months) {
      const open = openMonths.has(key);
      rows.push({
        kind: "monthRow",
        key: `month-${key}`,
        month: key,
        label: monthLabel(key, nowMonth),
        count: workouts.length,
        // Cut: the full section already shows this month's newest workouts.
        cut: lastMonth === key,
        open,
      });
      if (open) rows.push(...workouts.map(workoutRow));
    }
  }

  // The older workouts, by page: plain month labels, no counts, quiet lines for empty months. The gap between
  // the last month on the phone and the first loaded one is worked out from the two dates, with no read.
  let previousMonth = held.length > 0 ? month(held[held.length - 1]) : null;
  for (const workout of older) {
    const key = month(workout);
    if (key !== previousMonth) {
      const gap = previousMonth === null ? null : gapLine(previousMonth, key, nowMonth);
      if (gap) rows.push({ kind: "gap", key: `gap-${key}`, text: gap });
      rows.push({ kind: "monthLabel", key: `label-${key}`, month: key, label: monthLabel(key, nowMonth) });
      previousMonth = key;
    }
    rows.push(workoutRow(workout));
  }

  const all = [...held, ...older];
  if (!reachedStart) rows.push({ kind: "olderMore", key: "older-more" });
  else if (all.length > 0) {
    const first = all[all.length - 1].session.startedAt;
    rows.push({ kind: "end", key: "end", text: `Your first workout, ${formatFirst(first)}`, onlyOne: all.length === 1 });
  }
  return rows;
}

const formatFirst = (time: number): string => {
  const date = new Date(time);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};
