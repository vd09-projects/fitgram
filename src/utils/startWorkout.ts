// src/utils/startWorkout.ts
//
// View models for the Start Workout screen (TICKET-022). Pure: the screen issues
// one recent-sessions query and one batched history prefetch on selection, and
// everything it shows is derived here from those results plus local state.

import { ExerciseHistory, ExerciseHistorySession } from "../types/exerciseHistory";
import { SessionTotalVolume, WorkoutSessionDoc } from "../types/workoutSession";
import { ExerciseField, FieldRole, WorkoutPlan } from "../types/workoutType";
import { PendingUpload } from "../types/zustandWorkoutType";
import { parseNumericValue, unitLabel } from "./exerciseFields";
import { buildSessionDocs, computeSessionTotalVolume } from "./exerciseStats";

/** Recent sessions read on open. Plans not done within this window show no date. */
export const RECENT_SESSIONS_WINDOW = 20;

export type PlanRow = {
  id: string;
  name: string;
  exerciseCount: number;
  /** `startedAt` of the plan's latest session, or null when none is known. */
  lastDoneAt: number | null;
  /** "pending" when the latest session is finished but not uploaded yet. */
  lastDoneSource: "uploaded" | "pending" | null;
  /**
   * Volume of that same latest session — never of an older one, so the date and
   * the figure always describe one workout. null when there is no latest
   * session or it predates the stored field.
   */
  volume: SessionTotalVolume | null;
};

type Candidate = {
  startedAt: number;
  source: "uploaded" | "pending";
  volume: SessionTotalVolume | null;
};

/**
 * One row per plan whose name matches `query`, in plan order.
 *
 * **last done** = the newest session of the plan, across two sources:
 *
 * - `sessions`, the most recent uploaded sessions (one query, `startedAt desc`).
 *   A plan absent from that window has no date rather than a guessed one, and no
 *   per-plan fallback query is made.
 * - `pendingUploads` belonging to `uid` — finished workouts not uploaded yet
 *   (TICKET-028). Without them, a workout finished offline yesterday reads as
 *   "8 days ago". Other accounts' entries on this device are ignored.
 *
 * Joined on `workoutId`, never on name, which can change. Compared on start
 * time on both sides: sessions are ordered by `startedAt`, so comparing it with a
 * pending entry's `endedAt` would mix two clocks. On a tie (the same session,
 * mid-upload, in both places) the uploaded copy wins.
 *
 * `sessions === null` means the query has not returned or failed. Then no plan
 * gets a date, pending included: a pending entry can be older than an uploaded
 * session we could not read, and showing it would be a wrong date, not a
 * missing one.
 */
export function buildPlanRows(
  plans: WorkoutPlan[],
  sessions: WorkoutSessionDoc[] | null,
  pendingUploads: PendingUpload[],
  uid: string | null | undefined,
  query: string
): PlanRow[] {
  const latest = new Map<string, Candidate>();

  if (sessions !== null) {
    const consider = (workoutId: string, candidate: Candidate) => {
      const current = latest.get(workoutId);
      // The tie clause is order-independence insurance, redundant today: the
      // sessions loop runs before the pending loop, so on equal `startedAt` the
      // uploaded copy is already `current` and kept. It decides the outcome only
      // if the loops are reordered. No test covers it for that reason.
      if (
        !current ||
        candidate.startedAt > current.startedAt ||
        (candidate.startedAt === current.startedAt && candidate.source === "uploaded")
      ) {
        latest.set(workoutId, candidate);
      }
    };

    for (const session of sessions) {
      consider(session.workoutId, {
        startedAt: session.startedAt,
        source: "uploaded",
        volume: session.volume ?? null,
      });
    }

    for (const entry of pendingUploads) {
      if (!uid || entry.uid !== uid) continue;
      // Same builder the upload will use, so this figure is what gets stored.
      const { exerciseSessions } = buildSessionDocs(entry.workout, entry.endedAt);
      consider(entry.workout.id, {
        startedAt: entry.workout.startTime,
        source: "pending",
        volume: computeSessionTotalVolume(exerciseSessions),
      });
    }
  }

  const needle = query.trim().toLowerCase();
  return plans
    .filter((plan) => plan.name.trim().toLowerCase().includes(needle))
    .map((plan) => {
      const candidate = latest.get(plan.id) ?? null;
      return {
        id: plan.id,
        name: plan.name,
        exerciseCount: plan.exercises.length,
        lastDoneAt: candidate?.startedAt ?? null,
        lastDoneSource: candidate?.source ?? null,
        volume: candidate?.volume ?? null,
      };
    });
}

export type TopSet =
  | { kind: "set"; weight: number; reps: number; unit: string | null; setNumber: number }
  /** An exercise without a weight+reps pair: its best on one measured field. */
  | { kind: "best"; value: number; role: FieldRole; unit: string | null; setNumber: number }
  | {
      kind: "none";
      reason: "no_history" | "no_numeric_pair" | "unit_changed" | "no_parseable_set";
    };

const MEASURED_ROLES: FieldRole[] = ["weight", "reps", "time", "distance"];

/**
 * **last top set** = the heaviest set of the most recent session, by weight;
 * ties go to more reps, then to the earlier set. A set needs both weight and
 * reps to parse. Not an estimated 1RM and not the all-time best — "what did I
 * lift last time", which is what judging a plan before starting it asks.
 *
 * **Without a weight+reps pair** (a plank logged in minutes, burpees as reps
 * only), the top set is the highest value of the exercise's *first measured
 * field* in its definition order — the field the user put first. Rejected: a
 * fixed role priority (time over distance over reps), which would pick for the
 * user on exercises with several measured fields. Known limit: "highest" assumes
 * more is better, which is wrong for a timed run over a fixed distance; no
 * catalog exercise is defined that way today.
 *
 * A last session logged in another unit than today's definition reports
 * `unit_changed`: its values are not comparable and are not converted.
 */
export function lastTopSet(
  history: Pick<ExerciseHistory, "lastSession" | "numericFields" | "fields">
): TopSet {
  const { lastSession, numericFields } = history;
  if (!lastSession) return { kind: "none", reason: "no_history" };
  if (!numericFields) return bestOnFirstMeasuredField(history.fields, lastSession);
  if (!lastSession.comparable) return { kind: "none", reason: "unit_changed" };

  let top: Extract<TopSet, { kind: "set" }> | null = null;
  for (const set of lastSession.sets) {
    if (set.weight === null || set.reps === null) continue;
    if (
      !top ||
      set.weight > top.weight ||
      (set.weight === top.weight && set.reps > top.reps)
    ) {
      top = {
        kind: "set",
        weight: set.weight,
        reps: set.reps,
        unit: numericFields.weight.unit ?? null,
        setNumber: set.setNumber,
      };
    }
  }
  return top ?? { kind: "none", reason: "no_parseable_set" };
}

function bestOnFirstMeasuredField(
  currentFields: ExerciseField[],
  lastSession: ExerciseHistorySession
): TopSet {
  const field = currentFields.find((f) => MEASURED_ROLES.includes(f.role));
  if (!field) return { kind: "none", reason: "no_numeric_pair" };

  // Values are stored under the field's name, so the session's own definition
  // of that name is what says which unit they were logged in.
  const logged = lastSession.fields.find((f) => f.name === field.name);
  if (!logged || logged.role !== field.role) {
    return { kind: "none", reason: "no_parseable_set" };
  }
  if ((logged.unit ?? null) !== (field.unit ?? null)) {
    return { kind: "none", reason: "unit_changed" };
  }

  let best: Extract<TopSet, { kind: "best" }> | null = null;
  for (const set of lastSession.sets) {
    const value = parseNumericValue(set.fields[field.name]);
    if (value === null) continue;
    if (!best || value > best.value) {
      best = { kind: "best", value, role: field.role, unit: field.unit ?? null, setNumber: set.setNumber };
    }
  }
  return best ?? { kind: "none", reason: "no_parseable_set" };
}

/**
 * A run of display text. `numeric` runs render in the mono face, which is the
 * only face numbers may use; everything else in the display face.
 */
export type TextPart = { text: string; numeric?: true };

const num = (text: string): TextPart => ({ text, numeric: true });
const txt = (text: string): TextPart => ({ text });

/** Plain-text form of parts, for accessibility labels and tests. */
export const partsToString = (parts: TextPart[]) => parts.map((p) => p.text).join("");

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * "today", "yesterday", "N days ago" under two weeks, "N weeks ago" under 60
 * days, then "N months ago" (30-day months).
 *
 * Counted in local calendar days, not 24-hour blocks: a workout at 23:00 read at
 * 08:00 is "yesterday", which is how the user remembers it. A time in the future
 * (device clock moved back) reads "today".
 */
export function formatSince(time: number, now: number): TextPart[] {
  const days = Math.max(
    0,
    Math.round((startOfLocalDay(now) - startOfLocalDay(time)) / DAY_MS)
  );
  if (days === 0) return [txt("today")];
  if (days === 1) return [txt("yesterday")];
  if (days < 14) return [num(String(days)), txt(" days ago")];
  if (days < 60) return [num(String(Math.floor(days / 7))), txt(" weeks ago")];
  return [num(String(Math.floor(days / 30))), txt(" months ago")];
}

/**
 * Thousands-separated, at most one decimal. Hand-rolled because Hermes'
 * `toLocaleString` grouping varies by build and locale data.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const [whole, fraction] = String(rounded).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * The row's volume figure. Every state of `SessionTotalVolume` says something,
 * so the stored shape can be judged on a device:
 *
 *   totals            "4,980 kg", "1,955 kg · 115 plates" (one per unit, never
 *                     converted; + " · 1 not weighted" when a plank was excluded)
 *   unparseable       "volume n/a · 2 of 3 lifts readable"
 *   no weighted lifts "no weighted lifts"
 *   field absent      "volume not recorded" (a session saved before TICKET-022,
 *                     or in the single-total shape before TICKET-044)
 *
 * `null` input (no known session) renders nothing — the row has no date either.
 */
export function formatVolume(
  volume: SessionTotalVolume | null,
  hasSession: boolean
): TextPart[] {
  if (!hasSession) return [];
  // A doc stored before TICKET-044 has `value`/`unit` and no `totals`.
  if (!volume || !Array.isArray(volume.totals)) return [txt("volume not recorded")];

  const excluded = volume.exercisesTotal - volume.exercisesWeighted;
  switch (volume.unavailableReason) {
    case "no_weighted_exercises":
      return [txt("no weighted lifts")];
    case "unparseable":
      return [
        txt("volume n/a · "),
        num(String(volume.exercisesCounted)),
        txt(" of "),
        num(String(volume.exercisesWeighted)),
        txt(" lifts readable"),
      ];
    case null:
      break;
  }

  const parts: TextPart[] = [];
  volume.totals.forEach((total, index) => {
    const value = formatNumber(total.value);
    if (index > 0) parts.push(txt(" · "));
    parts.push(num(value));
    if (total.unit) parts.push(txt(` ${unitLabel(value, total.unit)}`));
  });
  if (excluded > 0) parts.push(txt(" · "), num(String(excluded)), txt(" not weighted"));
  return parts;
}

/** "24 kg × 10", "1 plate × 12", "1.5 min", "20 reps", or why there is no number. */
export function formatTopSet(top: TopSet): TextPart[] {
  if (top.kind === "best") {
    const value = formatNumber(top.value);
    const suffix = top.unit ? ` ${unitLabel(value, top.unit)}` : top.role === "reps" ? " reps" : "";
    return [num(value), ...(suffix ? [txt(suffix)] : [])];
  }
  if (top.kind === "set") {
    const weight = formatNumber(top.weight);
    return [
      num(weight),
      ...(top.unit ? [txt(` ${unitLabel(weight, top.unit)}`)] : []),
      txt(" × "),
      num(String(top.reps)),
    ];
  }
  switch (top.reason) {
    case "no_history":
      return [txt("not done yet")];
    case "unit_changed":
      return [txt("unit changed")];
    case "no_numeric_pair":
    case "no_parseable_set":
      return [txt("—")];
  }
}
