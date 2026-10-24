// src/utils/setDeltas.ts
//
// The derived values behind the "Today" list under the set card: how each of
// this session's sets compares with the same set last time, and how today's
// volume compares with the previous session. Kept pure so the maths is tested
// directly rather than judged off a screen. Tests: setDeltas.test.ts.
//
// Sibling of setLogger.ts rather than part of it: that module is about the set
// about to be logged, this one about the sets already logged. The history gate
// is shared — `resolveGhostTarget` decides both "is there a ghost for set n"
// and "is there a delta for set n", so the two can never disagree about why.

import { ExerciseHistory, HistorySet } from "../types/exerciseHistory";
import { StoredSetFields } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import { computeSessionVolume, SessionVolume } from "./exerciseStats";
import { NumericFieldMap, parseSet, resolveNumericFields, withUnit } from "./exerciseFields";
import { formatStepValue, GhostTarget, resolveGhostTarget } from "./setLogger";

/**
 * How one set compares with the same set last time.
 *
 * - `improved` — set volume (weight × reps) went up.
 * - `down` — set volume went down.
 * - `even` — volume equal, numbers differ: 60×10 → 50×12. Not "matched"; the
 *   label says what changed.
 * - `matched` — weight and reps both identical.
 *
 * `even` and `matched` are separate verdicts, not one verdict with a branch:
 * their labels are built differently (what moved vs the word "matched"), and
 * that difference is the reason the distinction exists.
 */
export type SetVerdict = "improved" | "even" | "matched" | "down";

/**
 * Why a row has no delta. Everything except `available` from `GhostTarget`,
 * plus the two ways a set can fail to parse.
 *
 * - `pastUnparsed` — last time's weight or reps is null: unparseable, or a
 *   field renamed since (TICKET-030). Not treated as 0, which would score any
 *   set today as an improvement.
 * - `todayUnparsed` — today's set has no parseable weight or reps.
 */
export type NoDeltaReason =
  | Exclude<GhostTarget["kind"], "available">
  | "pastUnparsed"
  | "todayUnparsed";

export type SetDelta =
  | { kind: "none"; reason: NoDeltaReason }
  | { kind: "delta"; verdict: SetVerdict; label: string };

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** "+2.5 kg", "−5 lb", "+1 plate", "+2.5" with no unit. Minus is U+2212, as typeset. */
function weightChange(diff: number, unit: string | undefined): string {
  const magnitude = formatStepValue(Math.abs(diff));
  return `${diff > 0 ? "+" : "−"}${withUnit(magnitude, unit)}`;
}

/** "+1 rep", "−2 reps". */
function repsChange(diff: number): string {
  const magnitude = formatStepValue(Math.abs(diff));
  return `${diff > 0 ? "+" : "−"}${magnitude} ${Math.abs(diff) === 1 ? "rep" : "reps"}`;
}

/**
 * Verdict and label for two parsed sets.
 *
 * **Verdict from set volume**, weight × reps: the only comparison that handles
 * both dimensions moving. Rejected: comparing weight and ignoring reps, which
 * calls 67.5×8 an improvement on 65×12. Rejected: a composite score — a lifter
 * reads the two numbers, not a scalar.
 *
 * One refinement: when volume ties but only one dimension moved, that dimension
 * decides. This only differs from plain volume at a 0 factor — a bodyweight set
 * logged as 0 kg, where 0×8 → 0×10 has equal volume but is plainly two more
 * reps. With both factors above 0, one dimension moving always moves volume.
 *
 * **Label from what moved**: reps only → "+1 rep"; weight only → "+2.5 kg";
 * both → "+2.5 kg · −1 rep", with the verdict colour carrying the direction.
 */
export function compareSets(
  today: { weight: number; reps: number },
  past: { weight: number; reps: number },
  unit: string | undefined
): { verdict: SetVerdict; label: string } {
  const weightDiff = today.weight - past.weight;
  const repsDiff = today.reps - past.reps;
  if (weightDiff === 0 && repsDiff === 0) return { verdict: "matched", label: "matched" };

  const parts: string[] = [];
  if (weightDiff !== 0) parts.push(weightChange(weightDiff, unit));
  if (repsDiff !== 0) parts.push(repsChange(repsDiff));
  const label = parts.join(" · ");

  let direction = sign(today.weight * today.reps - past.weight * past.reps);
  if (direction === 0 && (weightDiff === 0 || repsDiff === 0)) {
    direction = sign(weightDiff + repsDiff);
  }
  const verdict: SetVerdict = direction > 0 ? "improved" : direction < 0 ? "down" : "even";
  return { verdict, label };
}

/**
 * Delta for today's set `setNumber` (1-based position, which since TICKET-019's
 * renumbering is also its id) against last session's set at the same position.
 *
 * Gated by `resolveGhostTarget`: not loaded, first time, no weight+reps pair,
 * last session in another unit (decided by `lastSession.comparable`, not
 * `unitMismatch`), or last session stopped earlier — each is a reason, not a 0.
 *
 * `todayNumeric` is resolved from the live exercise's fields, not history's:
 * history's map describes the last *recorded* session's shape.
 */
export function setDelta(
  history: Pick<
    ExerciseHistory,
    "status" | "hasHistory" | "numericComparisonAvailable" | "lastSession" | "setAt"
  >,
  setNumber: number,
  todayFields: StoredSetFields,
  todayNumeric: NumericFieldMap | null
): SetDelta {
  const target = resolveGhostTarget(history, setNumber);
  if (target.kind !== "available") return { kind: "none", reason: target.kind };

  const past: HistorySet = target.set;
  if (past.weight === null || past.reps === null) return { kind: "none", reason: "pastUnparsed" };

  const today = parseSet(todayFields, todayNumeric);
  if (today.weight === null || today.reps === null) return { kind: "none", reason: "todayUnparsed" };

  return {
    kind: "delta",
    ...compareSets(
      { weight: today.weight, reps: today.reps },
      { weight: past.weight, reps: past.reps },
      todayNumeric?.weight.unit
    ),
  };
}

/**
 * A row's logged values as one line: "60 kg × 12" when weight and reps both
 * parse, otherwise every non-empty field in definition order with its unit,
 * "45 s · light band". Raw values are shown as typed in the fallback, so an
 * unparseable entry is visible as what it is rather than hidden.
 */
export function setValuesText(fields: ExerciseField[], values: StoredSetFields): string {
  const numeric = resolveNumericFields(fields);
  const { weight, reps } = parseSet(values, numeric);
  if (numeric && weight !== null && reps !== null) {
    return `${withUnit(formatStepValue(weight), numeric.weight.unit)} × ${formatStepValue(reps)}`;
  }
  return fields
    .map((field) => {
      const raw = String(values[field.name] ?? "").trim();
      if (raw === "") return null;
      return withUnit(raw, field.unit);
    })
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * What today's volume is compared against.
 *
 * - `firstN` — today has fewer sets than last time, so compare with last
 *   session's first `n` sets. Rejected: today's running total against last
 *   session's full total, which reads as −60% two sets into a five-set
 *   session every time, until the last set.
 * - `session` — today has as many sets as last time, or more, so first-N is
 *   impossible or identical: compare totals. By then today has done at least as
 *   many sets, so total against total is meaningful.
 */
export type VolumeBase = { kind: "firstN"; n: number } | { kind: "session"; performedAt: number };

export type VolumeComparison =
  | {
      kind: "none";
      reason:
        | NoDeltaReasonForVolume
        /** Last session's sets in the base did not all parse. */
        | "pastUnavailable"
        /** Last session's volume in the base was 0 — no percentage of nothing. */
        | "pastZero";
      /** Present for `pastUnavailable`, so the footer can give the counts. */
      pastVolume?: SessionVolume;
      /**
       * For `unitChanged`: last session's weight unit, so the caption can name
       * it ("Last time was in kg"). Null when it had none, or no weight+reps pair.
       */
      lastUnit?: string | null;
    }
  | { kind: "percent"; percent: number; direction: -1 | 0 | 1; base: VolumeBase };

/** History-level reasons the footer has no comparison. */
type NoDeltaReasonForVolume =
  | "notLoaded"
  | "firstTime"
  | "noComparison"
  | "unitChanged"
  | "noSets"
  | "todayUnavailable";

export type TodaySummary = {
  setCount: number;
  /**
   * Today's volume, from the live exercise's fields. `null` when the exercise
   * has no weight+reps pair (a plank): no volume line at all, rather than 0.
   * Otherwise all-or-nothing, as `computeSessionVolume`.
   */
  volume: SessionVolume | null;
  comparison: VolumeComparison;
};

/**
 * Set count, today's volume, and today's volume against last session.
 *
 * Today's numeric fields come from `todayExerciseFields` (the live exercise);
 * last session's from `history.numericFields`, which is that session's shape.
 * Both sides are all-or-nothing: one unparseable set among the first N last
 * time and the comparison is unavailable, never understated.
 */
export function todaySummary(
  history: Pick<
    ExerciseHistory,
    "status" | "hasHistory" | "numericComparisonAvailable" | "lastSession" | "numericFields"
  >,
  todaySets: StoredSetFields[],
  todayExerciseFields: ExerciseField[]
): TodaySummary {
  const todayNumeric = resolveNumericFields(todayExerciseFields);
  const setCount = todaySets.length;
  const volume = todayNumeric ? computeSessionVolume(todaySets, todayNumeric) : null;
  const none = (reason: NoDeltaReasonForVolume): TodaySummary => ({
    setCount,
    volume,
    comparison: { kind: "none", reason },
  });

  if (!todayNumeric) return none("noComparison");
  if (history.status !== "ready") return none("notLoaded");
  const last = history.lastSession;
  if (!history.hasHistory || !last) return none("firstTime");
  if (!history.numericComparisonAvailable) return none("noComparison");
  if (!last.comparable) {
    return {
      setCount,
      volume,
      comparison: {
        kind: "none",
        reason: "unitChanged",
        lastUnit: resolveNumericFields(last.fields)?.weight.unit ?? null,
      },
    };
  }
  if (setCount === 0) return none("noSets");
  if (volume?.value == null) return none("todayUnavailable");

  const base: VolumeBase =
    setCount < last.sets.length
      ? { kind: "firstN", n: setCount }
      : { kind: "session", performedAt: last.performedAt };
  const pastSets = base.kind === "firstN" ? last.sets.slice(0, base.n) : last.sets;
  const pastVolume = computeSessionVolume(
    pastSets.map((set) => set.fields),
    history.numericFields
  );

  if (pastVolume.value === null) {
    return { setCount, volume, comparison: { kind: "none", reason: "pastUnavailable", pastVolume } };
  }
  if (pastVolume.value === 0) {
    return { setCount, volume, comparison: { kind: "none", reason: "pastZero" } };
  }

  const percent = ((volume.value - pastVolume.value) / pastVolume.value) * 100;
  return {
    setCount,
    volume,
    comparison: { kind: "percent", percent, direction: sign(volume.value - pastVolume.value), base },
  };
}

/** "1,955" — grouped thousands, up to one decimal. Manual: Hermes' Intl varies. */
export function formatVolume(value: number): string {
  const [whole, fraction] = String(Number(value.toFixed(1))).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Sep", in local time. */
export function formatSessionDate(performedAt: number): string {
  const date = new Date(performedAt);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "3 sets", "1 set". */
export function setCountText(count: number): string {
  return `${count} ${count === 1 ? "set" : "sets"}`;
}

/**
 * The volume part of the footer header: "1,955 kg", "115 plates", or the reason there is no
 * number — "volume unavailable (3 of 4 sets)" with the counts, never a partial
 * sum. `null` when the exercise has no volume at all (a plank).
 */
export function volumeText(volume: SessionVolume | null, unit: string | undefined): string | null {
  if (volume === null || volume.setsTotal === 0) return null;
  if (volume.value === null) {
    return `volume unavailable (${volume.setsCounted} of ${volume.setsTotal} sets)`;
  }
  return withUnit(formatVolume(volume.value), unit);
}

/**
 * The comparison line: "+3.1% volume vs first 2 sets", "−5.4% volume vs 26 Sep",
 * or the reason there is none. It always names its base — a bare percentage
 * with a shifting denominator is unreadable.
 *
 * `null` where something else already says why: no sets yet (the list says
 * so), history not loaded or first time (the card's notice says so), and
 * today's own volume unavailable (the header says so, with counts).
 */
export function comparisonText(comparison: VolumeComparison): string | null {
  if (comparison.kind === "percent") {
    const magnitude = Math.abs(comparison.percent).toFixed(1);
    const signed =
      comparison.direction > 0 ? `+${magnitude}` : comparison.direction < 0 ? `−${magnitude}` : "0.0";
    const base =
      comparison.base.kind === "firstN"
        ? comparison.base.n === 1
          ? "set 1"
          : `first ${comparison.base.n} sets`
        : formatSessionDate(comparison.base.performedAt);
    return `${signed}% volume vs ${base}`;
  }
  switch (comparison.reason) {
    case "noComparison":
      return "No weight × reps to compare";
    case "unitChanged":
      return comparison.lastUnit
        ? `Last time was in ${comparison.lastUnit}, so no comparison`
        : "Last time used a different unit, so no comparison";
    case "pastUnavailable": {
      const past = comparison.pastVolume;
      return past
        ? `Last session's volume unavailable (${past.setsCounted} of ${past.setsTotal} sets)`
        : "Last session's volume unavailable";
    }
    case "pastZero":
      return "No volume last time to compare";
    default:
      return null;
  }
}
