// src/utils/monthWindow.ts
//
// TICKET-082: which months of workouts the phone keeps, and what a month is. Pure.
// The workout window (`workoutWindow.ts`) and the measurement of it
// (`scripts/measureWindow.ts`, TICKET-087) both call `chooseMonthsToKeep`: one
// copy of the rule, so the number measured is the rule shipped.
//
// Rule: whole months, newest first, until at least `min` workouts are kept. The
// count therefore floats from `min` up to `min` plus one month's workouts.
// Rejected: an exact count, which leaves a part-month that a month row cannot
// show as complete.

export type MonthsToKeep = {
  /** Month keys to keep, newest first. */
  keptMonths: string[];
  /** Workouts in the kept months. */
  keptCount: number;
  /** Month keys left out, newest first. Empty when the whole history fits. */
  olderMonths: string[];
};

/** `monthCounts`: month key (`YYYY-MM`, so it sorts as text) to its workouts. */
export function chooseMonthsToKeep(monthCounts: ReadonlyMap<string, number>, min: number): MonthsToKeep {
  const keys = [...monthCounts.keys()].sort().reverse();
  const keptMonths: string[] = [];
  let keptCount = 0;
  for (const key of keys) {
    if (keptCount >= min) break;
    keptMonths.push(key);
    keptCount += monthCounts.get(key) ?? 0;
  }
  return { keptMonths, keptCount, olderMonths: keys.slice(keptMonths.length) };
}

// ---------------------------------------------------------------------------
// What a month is. Two clocks, on purpose, and each used for one job.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The phone's local month of a time, `YYYY-MM`: the month the month rows show
 * and the window is cut by. A workout at 23:00 on the last night of a month is
 * in that month for the person who did it, whatever the server's date said.
 */
export const localMonthKey = (time: number): string => {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

/** The first instant of the local month `time` is in, in ms. Where the window starts. */
export const localMonthStart = (time: number): number => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
};

/**
 * The UTC month of a time, `YYYY-MM`: which saved shard holds a workout. Not
 * the local month, so a shard never moves when the phone changes time zone:
 * a shard is storage, and nothing is read from its name but where to find a doc.
 */
export const utcMonthKey = (time: number): string => new Date(time).toISOString().slice(0, 7);

/**
 * The ms range of a local month key: `from` is its first instant, `to` the first instant of
 * the next month, so a workout is in the month when `from <= startedAt < to`. Built from the
 * local calendar, not from 30 days, so a month with a clock change is the right length.
 * Throws for a key that is not `YYYY-MM`: a wrong range would read as an empty month.
 */
export function localMonthRange(month: string): { from: number; to: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error(`Not a month key: ${month}`);
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return { from: new Date(year, index, 1).getTime(), to: new Date(year, index + 1, 1).getTime() };
}
