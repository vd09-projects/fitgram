// src/utils/personalBest.ts
//
// Whether a set just logged is a personal best, and what it beat (TICKET-021).
// Kept pure so the rule is tested directly rather than judged off a banner.
// Tests: personalBest.test.ts, next to this file.

import { BestSet, ExerciseHistory } from "../types/exerciseHistory";
import { StoredSetFields } from "../types/workoutSession";
import { NumericFieldMap, parseSet } from "./exerciseFields";
import { formatSessionDate } from "./setDeltas";
import { formatStepValue } from "./setLogger";

/**
 * What a set's weight beat.
 *
 * - `stored` — the all-time record at these reps, from `history.bestAtReps`.
 * - `today` — an earlier set this session at these reps, heavier than the
 *   stored record. `setNumber` is its 1-based position in today's list.
 */
export type BeatenSet =
  | { source: "stored"; weight: number; record: BestSet }
  | { source: "today"; weight: number; setNumber: number };

/**
 * Why a set is not called a personal best. Each is a reason, not a 0.
 *
 * - `notLoaded` — history not `ready`: the record is unknown, so no claim.
 * - `noComparison` — no weight+reps pair (a plank). Never a banner.
 * - `unparsed` — this set's weight or reps did not parse.
 * - `noRecord` — nothing stored at these reps: first time on the exercise, or
 *   first time at this rep count. See `personalBest` for why that is no claim.
 * - `notBeaten` — the bar was not beaten. A tie is here.
 */
export type NoPersonalBestReason = "notLoaded" | "noComparison" | "unparsed" | "noRecord" | "notBeaten";

export type PersonalBest =
  | { kind: "none"; reason: NoPersonalBestReason }
  | { kind: "beat"; weight: number; reps: number; unit: string | undefined; beaten: BeatenSet };

/**
 * Is today's set `setNumber` (1-based) a personal best?
 *
 * **"Best" is `history.bestAtReps` — the heaviest weight at exactly these
 * reps** — the same record the history sheet shows (`sheetBest`). It is not
 * defined again here, so the banner and the sheet cannot disagree about one
 * set. Exact reps only: 70 × 9 is not compared with the 8-rep record.
 *
 * **The bar is `max(stored record, today's best at these reps before this set)`.**
 * The stored record comes from the `exercise_stats` rollup, written only on
 * Finish, so it does not move during a session. Against it alone, 70 × 8 over a
 * stored 65 is a best, and a later 67.5 × 8 would be announced as a second one
 * though it is worse than the set three minutes earlier. Only sets *before*
 * this one count, so removing and re-logging cannot make a set beat itself.
 * When an earlier set today ties the stored record, the record is named:
 * it is the older achievement.
 *
 * **Strictly greater.** Matching the record is not a new one.
 *
 * **No stored record at these reps, no claim** (`noRecord`), even when today's
 * set beats an earlier set today. With no record there is nothing to have
 * beaten but this session, so every heavier set of a first-ever session would
 * be announced. Rejected: calling the first set at a rep count a best, which
 * says the same thing about a first attempt.
 *
 * Units: `bestAtReps` holds records in the live field's unit only
 * (`bestSetsFromStats`), and `todayNumeric` resolves the same live fields, so
 * both sides are one unit. Nothing is converted.
 *
 * Consequence: progressing by reps is never a best. 65 × 10 against an 8-rep
 * record has no 10-rep record to beat (`noRecord`). Falling back to the
 * heaviest at any reps would call it a loss to 70 × 8; a rep or volume record
 * is TICKET-039.
 *
 * Known gap, accepted in TICKET-028: a finished session waiting in the upload
 * queue is absent from the rollup, so its bests are too, and the next session
 * can announce a best already achieved.
 */
export function personalBest(
  history: Pick<ExerciseHistory, "status" | "numericComparisonAvailable" | "bestAtReps">,
  todaySets: StoredSetFields[],
  setNumber: number,
  todayNumeric: NumericFieldMap | null
): PersonalBest {
  if (history.status !== "ready") return { kind: "none", reason: "notLoaded" };
  if (!history.numericComparisonAvailable || !todayNumeric) return { kind: "none", reason: "noComparison" };

  const set = parseSet(todaySets[setNumber - 1], todayNumeric);
  if (set.weight === null || set.reps === null) return { kind: "none", reason: "unparsed" };
  const { weight, reps } = set;

  const record = history.bestAtReps(reps);
  if (!record) return { kind: "none", reason: "noRecord" };

  let beaten: BeatenSet = { source: "stored", weight: record.weight, record };
  todaySets.slice(0, setNumber - 1).forEach((earlier, index) => {
    const parsed = parseSet(earlier, todayNumeric);
    if (parsed.reps !== reps || parsed.weight === null) return;
    if (parsed.weight > beaten.weight) {
      beaten = { source: "today", weight: parsed.weight, setNumber: index + 1 };
    }
  });

  if (weight <= beaten.weight) return { kind: "none", reason: "notBeaten" };
  return { kind: "beat", weight, reps, unit: todayNumeric.weight.unit, beaten };
}

/**
 * The banner's copy: `reps` for the title "Heaviest 8-rep set yet" (the caller
 * sets the number in the mono face) and the detail line
 * "67.5 kg · beat 65 kg from 26 Sep", or "… from set 2 today". A signal, not a
 * celebration: no exclamation. `null` when there is no best to announce.
 */
export function personalBestText(best: PersonalBest): { reps: string; detail: string } | null {
  if (best.kind !== "beat") return null;
  const unit = best.unit ? ` ${best.unit}` : "";
  const from =
    best.beaten.source === "stored"
      ? formatSessionDate(best.beaten.record.performedAt)
      : `set ${best.beaten.setNumber} today`;
  return {
    reps: formatStepValue(best.reps),
    detail: `${formatStepValue(best.weight)}${unit} · beat ${formatStepValue(best.beaten.weight)}${unit} from ${from}`,
  };
}
