// src/scripts/heldWindow.ts
//
// TICKET-087: which months the phone holds under TICKET-082's rule. Pure, so the
// measurement of the window (measureWindow.ts) rests on a tested function.
//
// Rule: whole months, newest first, until at least `min` workouts are held. The
// held count therefore floats from `min` up to `min` plus one month's workouts.
// Rejected: an exact count, which leaves a part-month that a month row cannot
// show as complete.

export type HeldWindow = {
  /** Month keys held, newest first. */
  held: string[];
  heldCount: number;
  /** Month keys not held, newest first. Empty when the whole history fits. */
  older: string[];
};

/** `monthCounts`: month key (`YYYY-MM`, so it sorts as text) to its workouts. */
export function selectHeldMonths(monthCounts: ReadonlyMap<string, number>, min: number): HeldWindow {
  const keys = [...monthCounts.keys()].sort().reverse();
  const held: string[] = [];
  let heldCount = 0;
  for (const key of keys) {
    if (heldCount >= min) break;
    held.push(key);
    heldCount += monthCounts.get(key) ?? 0;
  }
  return { held, heldCount, older: keys.slice(held.length) };
}
