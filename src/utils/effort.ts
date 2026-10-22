// src/utils/effort.ts
//
// Per-set effort marks (TICKET-034): pairing the stored marks with their sets,
// last session's mark for the set card, and the counts the history sheet shows.
// Pure; tests in effort.test.ts.
//
// Records and shows only. Nothing here, and nothing that calls it, changes a
// ghost target, a delta or a rest duration.

import { ExerciseHistory } from "../types/exerciseHistory";
import { Effort, EFFORTS } from "../types/workoutSession";

export type ZippedEffort = {
  /** One entry per set, in set order. null: not marked, or unavailable. */
  marks: (Effort | null)[];
  /** True when the stored marks could not be paired with the sets. */
  unavailable: boolean;
};

/** Button and label text for each mark. */
export const EFFORT_LABEL: Record<Effort, string> = { [Effort.Easy]: "Easy", [Effort.Hard]: "Hard" };
/** The letter `EffortBadge` draws. */
export const EFFORT_LETTER: Record<Effort, string> = { [Effort.Easy]: "E", [Effort.Hard]: "H" };

const isEffort = (value: unknown): value is Effort => (EFFORTS as readonly unknown[]).includes(value);

/**
 * Pair a session's stored `setEffort` with its `setCount` sets.
 *
 * - **Missing array** (a doc saved before TICKET-034): every set unmarked, not
 *   unavailable. Nothing could have been marked then, so "not marked" is true.
 * - **Not an array** (null, or a hand-edited doc): every set null and
 *   `unavailable`. Something was stored, and it is not marks.
 * - **Length mismatch**: every set null and `unavailable`. The array is built
 *   from the same live sets as `sets`, so this only happens if something wrote
 *   one without the other; pairing by position would then put a mark on the
 *   wrong set, which reads as data. Rejected: pairing the overlap — the
 *   misalignment could be anywhere, so no position is trustworthy.
 * - **An unknown value** (a later app version's third mark, or a typo in a
 *   hand-edited doc): that set reads null. The others stand.
 */
export function zipSetEffort(setCount: number, setEffort: unknown): ZippedEffort {
  const none = () => Array.from({ length: setCount }, () => null);
  if (setEffort === undefined) return { marks: none(), unavailable: false };
  if (!Array.isArray(setEffort) || setEffort.length !== setCount) return { marks: none(), unavailable: true };
  return { marks: setEffort.map((value) => (isEffort(value) ? value : null)), unavailable: false };
}

/**
 * The mark after tapping `picked` on a set marked `current`. Tapping the mark
 * already chosen clears it, on every surface that offers marks, so "tap again
 * to clear" learnt in one place works in the other.
 */
export const toggleEffort = (current: Effort | null, picked: Effort): Effort | null =>
  current === picked ? null : picked;

/** What each live set stores. Absent (a set logged before 034) is null, never undefined: Firestore rejects undefined. */
export const storedEffort = (sets: readonly { effort?: Effort | null }[]): (Effort | null)[] =>
  sets.map((set) => set.effort ?? null);

/** "1 easy · 1 hard", "2 hard", or null when nothing was marked. */
export function effortCountText(marks: readonly (Effort | null)[]): string | null {
  const easy = marks.filter((mark) => mark === Effort.Easy).length;
  const hard = marks.filter((mark) => mark === Effort.Hard).length;
  const parts = [easy > 0 ? `${easy} easy` : null, hard > 0 ? `${hard} hard` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Spoken form of a mark, appended to a set's label: ", felt hard". Empty when unmarked. */
export const effortSpeech = (effort: Effort | null | undefined): string =>
  effort ? `, felt ${effort}` : "";

/**
 * Set N's mark from **the last session only**, for the set card (TICKET-034).
 * null when that set was not marked, was not done last time, or history is not
 * loaded.
 *
 * No fallback to an older session's mark. The card shows this beside last
 * session's numbers for the same set, so "felt hard" from three weeks ago next
 * to last week's 65 × 8 would pair a mark with a set it was never about. Older
 * marks stay readable in the history sheet, per session.
 *
 * Independent of the ghost target: a mark is about how the set felt, so a unit
 * change or an unparseable weight does not hide it.
 */
export function lastTimeEffort(
  history: Pick<ExerciseHistory, "status" | "lastSession" | "setAt">,
  setNumber: number
): { effort: Effort; performedAt: number } | null {
  if (history.status !== "ready" || !history.lastSession) return null;
  const effort = history.setAt(setNumber)?.effort ?? null;
  return effort === null ? null : { effort, performedAt: history.lastSession.performedAt };
}
