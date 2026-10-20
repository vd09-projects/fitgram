// src/utils/historySheet.ts
//
// The derived values behind the exercise history sheet (TICKET-020): one past
// session set by set beside today's, the best set, and the volume trend. Kept
// pure so the maths is tested directly rather than judged off a screen.
// Tests: historySheet.test.ts.
//
// No verdicts are computed here. Every delta comes from `setDelta`, the same
// function the Today list uses, so the same two sets can never read "improved"
// in one place and "even" in the other.

import {
  BestSet,
  ExerciseHistory,
  ExerciseHistorySession,
  HistorySet,
  VolumePoint,
} from "../types/exerciseHistory";
import { StoredSetFields } from "../types/workoutSession";
import { ExerciseField } from "../types/workoutType";
import { parseSet, resolveNumericFields } from "./exerciseFields";
import { computeSessionVolume } from "./exerciseStats";
import { SetDelta, setDelta, setValuesText, volumeText } from "./setDeltas";

type SheetHistory = Pick<
  ExerciseHistory,
  "status" | "hasHistory" | "numericComparisonAvailable" | "numericFields" | "lastSession" | "setAt"
>;

/**
 * What the sheet's body shows before any session: `null` when there are
 * sessions to show. Each not-ready status says which, so the pill never opens
 * a sheet that looks broken or empty for a reason it does not give.
 */
export function sheetStatusMessage(history: Pick<ExerciseHistory, "status" | "hasHistory">): string | null {
  switch (history.status) {
    case "loading":
      return "Loading history…";
    case "error":
      return "Couldn't load history";
    case "idle":
      return "History not loaded";
    case "ready":
      return history.hasHistory ? null : "No history yet. Sessions you finish will show here.";
  }
}

/**
 * A past session's sets with weight and reps read from **that session's own
 * fields**, not the exercise's current ones.
 *
 * The hook parses every session with today's field names, so a field renamed
 * since ("Weight (kg)" → "Weight") reads as null (TICKET-030). The session's
 * own snapshot is resolved by role, which survives a rename. Doing it here
 * keeps the sheet correct before 030 changes the hook. Chosen over showing a
 * reason for the null: the value is recoverable, so recover it.
 *
 * Only for a comparable session. An incomparable one keeps null numbers, as
 * the hook does, so its values are shown and never compared.
 */
export function sessionSets(session: ExerciseHistorySession): HistorySet[] {
  const own = session.comparable ? resolveNumericFields(session.fields) : null;
  return session.sets.map((set) => ({ ...set, ...parseSet(set.fields, own) }));
}

export type SheetRow = {
  /** 1-based; the join key between the two columns. */
  setNumber: number;
  /** The selected session's set as one line, or null when it stopped earlier. */
  past: string | null;
  /** Today's set as one line, or null when it is not logged yet. */
  today: string | null;
  /** The row of the set about to be logged. */
  isNext: boolean;
  /**
   * From `setDelta`. `null` when either side is absent — an unmatched row has
   * nothing to compare, which is not a reason worth a word per row.
   */
  delta: SetDelta | null;
};

export type SheetSession = {
  sessionId: string;
  performedAt: number;
  workoutName: string;
  setCount: number;
  /** "1,955 kg", "volume unavailable (2 of 3 sets)", or null (a plank). */
  volume: string | null;
  rows: SheetRow[];
  /** Why this session's rows carry no deltas, or some of them; null when all can. */
  notice: string | null;
};

/**
 * One session laid out against today, rows aligned by set index.
 *
 * Deltas go through `setDelta` with the selected session standing in as
 * "last session". For the actual last session that is exactly the Today list's
 * call, so the two agree by construction. For an older session it is the same
 * gate (not loaded, no weight+reps, other unit, unparsed) and the same verdicts.
 *
 * The comparability gate is the **session's** `comparable`, not
 * `history.unitMismatch` (TICKET-018's correction): a kg session is still
 * comparable when some other session in the window was lb.
 */
export function sheetSession(
  history: SheetHistory,
  session: ExerciseHistorySession,
  todaySets: StoredSetFields[],
  todayFields: ExerciseField[]
): SheetSession {
  const sets = sessionSets(session);
  const todayNumeric = resolveNumericFields(todayFields);
  const asLast: SheetHistory = {
    ...history,
    lastSession: { ...session, sets },
    setAt: (setNumber) => sets[setNumber - 1] ?? null,
  };

  const nextSet = todaySets.length + 1;
  const rowCount = Math.max(sets.length, todaySets.length);
  const rows: SheetRow[] = [];
  for (let index = 0; index < rowCount; index++) {
    const setNumber = index + 1;
    const past = sets[index];
    const today = todaySets[index];
    rows.push({
      setNumber,
      past: past ? setValuesText(session.fields, past.fields) : null,
      today: today ? setValuesText(todayFields, today) : null,
      isNext: setNumber === nextSet,
      delta: past && today ? setDelta(asLast, setNumber, today, todayNumeric) : null,
    });
  }

  // Volume in the session's own unit, from its own fields. No pair on either
  // side (a plank) means no volume line at all, not "unavailable (0 of 3)".
  const own = resolveNumericFields(session.fields);
  const volume =
    own && history.numericComparisonAvailable
      ? volumeText(
          computeSessionVolume(
            session.sets.map((set) => set.fields),
            own
          ),
          own.weight.unit
        )
      : null;

  return {
    sessionId: session.sessionId,
    performedAt: session.performedAt,
    workoutName: session.workoutName,
    setCount: sets.length,
    volume,
    rows,
    notice: sessionNotice(history, session, sets, own?.weight.unit ?? null, own !== null),
  };
}

function sessionNotice(
  history: SheetHistory,
  session: ExerciseHistorySession,
  sets: HistorySet[],
  ownUnit: string | null,
  ownHasPair: boolean
): string | null {
  if (!history.numericComparisonAvailable) return "No weight × reps to compare";
  if (!session.comparable) {
    const today = history.numericFields?.weight.unit;
    if (!ownHasPair) {
      return "Logged with different fields, so not compared";
    }
    return ownUnit && today
      ? `Logged in ${ownUnit}, today in ${today}, so not compared`
      : "Logged in a different unit, so not compared";
  }
  if (sets.some((set) => set.weight === null || set.reps === null)) {
    return "Some sets have no weight × reps, so no comparison for them";
  }
  return null;
}

/**
 * The best set the sheet shows, or null when there is none to show.
 *
 * "Best" means **the heaviest weight at one rep count**, which is what
 * `BestSet` records. Which rep count:
 *
 * - `atReps` — the reps of the set about to be logged, when last session gives
 *   it a target: "best 8-rep set" is the number that matters for the next set.
 * - `heaviest` — otherwise, the heaviest record at any rep count; ties go to
 *   more reps, then the more recent.
 *
 * Rejected: the highest weight × reps, a volume record that nobody lifts to;
 * an estimated one-rep max, a number the user never did.
 *
 * Records in another unit are already excluded by the hook, so a unit change
 * can make this null while history exists.
 */
export type SheetBest = { kind: "atReps" | "heaviest"; set: BestSet } | null;

export function sheetBest(
  history: Pick<ExerciseHistory, "best" | "bestAtReps" | "numericComparisonAvailable">,
  targetReps: number | null
): SheetBest {
  if (!history.numericComparisonAvailable || history.best.length === 0) return null;
  if (targetReps !== null) {
    const atReps = history.bestAtReps(targetReps);
    if (atReps) return { kind: "atReps", set: atReps };
  }
  const heaviest = [...history.best].sort(
    (a, b) => b.weight - a.weight || b.reps - a.reps || b.performedAt - a.performedAt
  )[0];
  return { kind: "heaviest", set: heaviest };
}

export type TrendBar = {
  sessionId: string;
  performedAt: number;
  volume: number | null;
  /** 0–1 of the largest volume shown; null where `volume` is null (a gap). */
  ratio: number | null;
};

export type SheetTrend =
  | { kind: "bars"; bars: TrendBar[]; newest: { volume: number; performedAt: number } | null }
  | { kind: "none"; reason: string | null };

/**
 * Volume trend as bars, oldest to newest.
 *
 * Gaps: a null `volume` is a bar with no height and stays in its slot, so a
 * session whose volume is unavailable is visibly missing, not drawn as 0.
 *
 * Hidden when `unitMismatch` is set. `VolumePoint` carries no unit, and the
 * hook does not say which points came from the other-unit session, so a bar
 * of 80 lb-volume beside kg-volume bars could not be told apart. Hiding it is
 * over-cautious when the mismatched session is outside the trend window; a
 * wrong bar is worse. TICKET-036 puts a unit on `VolumePoint` so only the
 * other-unit point drops out.
 *
 * `reason: null` — nothing to say (a plank: the sessions notice covers it).
 */
export function sheetTrend(
  history: Pick<ExerciseHistory, "volumeTrend" | "numericComparisonAvailable" | "unitMismatch">
): SheetTrend {
  if (!history.numericComparisonAvailable) return { kind: "none", reason: null };
  if (history.unitMismatch) {
    return { kind: "none", reason: "Volume trend hidden: a recent session used a different unit" };
  }
  const points: VolumePoint[] = history.volumeTrend;
  const known = points.filter((point) => point.volume !== null) as (VolumePoint & { volume: number })[];
  if (known.length === 0) {
    return { kind: "none", reason: points.length === 0 ? null : "Volume unavailable for recent sessions" };
  }
  const max = Math.max(...known.map((point) => point.volume));
  const bars = points.map((point) => ({
    sessionId: point.sessionId,
    performedAt: point.performedAt,
    volume: point.volume,
    ratio: point.volume === null ? null : max > 0 ? point.volume / max : 0,
  }));
  const last = points[points.length - 1];
  return {
    kind: "bars",
    bars,
    newest: last.volume === null ? null : { volume: last.volume, performedAt: last.performedAt },
  };
}
