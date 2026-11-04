// src/utils/sessionDuration.ts
//
// How long a workout took, in whole minutes: the plan card's "about 50 min last
// time" (TICKET-065) and the "Saved · Push · 52 min" message after Finish
// (TICKET-066). One rule, so the two never disagree about the same session.
// Tests: sessionDuration.test.ts, and planCard.test.ts through the card.

/**
 * `endedAt − startedAt`, rounded to the minute. `null`, never 0, when the span
 * is not a positive finite number (a clock moved back, a missing end): 0 would
 * be the plausible wrong number (CLAUDE.md 2.4). A span under 30 s rounds to
 * 0; callers say "under 1 min" for it. Rejected: summing per-exercise time,
 * which is not recorded.
 */
export function sessionMinutes(startedAt: number, endedAt: number | null): number | null {
  const span = endedAt === null ? NaN : endedAt - startedAt;
  return Number.isFinite(span) && span > 0 ? Math.round(span / 60_000) : null;
}

/**
 * The body of the toast when a finished workout reaches the server:
 * "Push · 52 min", "Push · under 1 min", or just "Push" when the minutes are
 * unknown (`sessionMinutes`). Shown with the title "Saved" by every upload,
 * on Finish and when a queued workout lands later, so either way the user
 * learns which workout was saved.
 */
export function savedSummary(workoutName: string, startedAt: number, endedAt: number): string {
  const minutes = sessionMinutes(startedAt, endedAt);
  if (minutes === null) return workoutName;
  return `${workoutName} · ${minutes < 1 ? "under 1" : minutes} min`;
}
