// src/scripts/historyImport.ts
//
// Pure half of importHistory.ts: turns a hand-transcribed history file (the
// user's gym notes, see research/history-import/) into the same docs the app
// writes on Finish. No Firestore here, so all of it is testable.
//
// The docs are built by the app's own `buildSessionDocs` from an
// `ActiveWorkout`, not assembled by hand: an import that wrote its own shape
// would drift from the app's the first time either changed.

import { CATALOG } from "../catalog";
import type { FieldUnit } from "../constants/units";
import type { Effort, ExerciseSessionDoc, WorkoutSessionDoc } from "../types/workoutSession";
import type { Exercise, ExerciseField, WorkoutPlan } from "../types/workoutType";
import type { ActiveWorkout, ExerciseSet, LoggedExercise } from "../types/zustandWorkoutType";
import { planExerciseForVersion } from "../utils/catalog";
import { buildSessionDocs } from "../utils/exerciseStats";

export type ImportExercise = {
  /** A catalog version id. Anything else is refused, not imported as custom. */
  id: string;
  /** Unit of the weight field. Omitted for an exercise that logs reps only. */
  unit?: FieldUnit;
  /** Bar weight in kg when the notes give the load per side. */
  bar?: number;
  sets: string[];
};

export type ImportSession = {
  /** YYYY-MM-DD. The session starts at SESSION_HOUR local time on it. */
  date: string;
  plan: string;
  source: string;
  exercises: ImportExercise[];
};

export type ImportPlan = { key: string; id: string; name: string };

export type ImportFile = { email: string; plans: ImportPlan[]; sessions: ImportSession[] };

/** The user's sessions were in the evening; the notes carry no times (user, 2026-11-01). */
export const SESSION_HOUR = 20;

type ParsedSegment = { weight: number | null; reps: number };
export type ParsedSet = { segments: ParsedSegment[]; effort: Effort | null };

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const SEGMENT = new RegExp(`^(?:(${NUMBER})-)?(\\d+)$`);

/**
 * One set in the transcription grammar: `W-R`, or `R` alone for reps only,
 * segments joined by ` / `, an optional trailing ` E` or ` H`. Throws on
 * anything else: a set that does not parse is a transcription error to fix,
 * never a set to guess at.
 */
export function parseSet(text: string): ParsedSet {
  let body = text.trim();
  let effort: Effort | null = null;
  const mark = body.match(/\s+([EH])$/);
  if (mark) {
    effort = mark[1] === "E" ? "easy" : "hard";
    body = body.slice(0, mark.index).trim();
  }
  const segments = body.split("/").map((part) => {
    const match = part.trim().match(SEGMENT);
    if (!match) throw new Error(`Unreadable set "${text}"`);
    return { weight: match[1] === undefined ? null : Number(match[1]), reps: Number(match[2]) };
  });
  return { segments, effort };
}

/**
 * The load stored for one written weight. The notes give a barbell's load per
 * side (user, 2026-11-01: "20 kg rod plus 7.5 on one side ... log it as 35"),
 * and the app never adds a bar weight itself (units.ts), so the total is
 * computed here: bar + 2 × per side. Rejected: storing the per-side number,
 * which made a switch from the 20 kg to the 10 kg curl bar read as progress.
 */
export const totalLoad = (written: number, bar: number | undefined) =>
  bar === undefined ? written : bar + 2 * written;

const VERSIONS = new Map(
  CATALOG.flatMap((movement) => movement.versions.map((version) => [version.id, { movement, version }] as const))
);

/** The plan exercise for a version, its weight field set to the unit the notes used. */
export function planExercise(entry: ImportExercise): Exercise {
  const found = VERSIONS.get(entry.id);
  if (!found) throw new Error(`"${entry.id}" is not a catalog version id`);
  const exercise = planExerciseForVersion(found.movement, found.version);
  const weight = exercise.fields.find((field) => field.role === "weight");
  if (weight && !entry.unit) throw new Error(`${entry.id}: logs a weight, so it needs a unit`);
  if (!weight && (entry.unit || entry.bar !== undefined)) throw new Error(`${entry.id}: logs no weight, so no unit or bar`);
  if (weight && entry.unit) weight.unit = entry.unit;
  return exercise;
}

const fieldName = (fields: ExerciseField[], role: "weight" | "reps") => fields.find((f) => f.role === role)?.name;

function loggedExercise(entry: ImportExercise): LoggedExercise {
  const exercise = planExercise(entry);
  const weightName = fieldName(exercise.fields, "weight");
  const repsName = fieldName(exercise.fields, "reps");
  if (!repsName) throw new Error(`${entry.id}: has no reps field`);

  const sets: ExerciseSet[] = entry.sets.map((text, index) => {
    const parsed = parseSet(text);
    const segments = parsed.segments.map((segment) => {
      if ((segment.weight === null) !== !weightName) throw new Error(`${entry.id}: set "${text}" does not match its fields`);
      // Strings, as the set card writes them (setLogger).
      const values: Record<string, string> = { [repsName]: String(segment.reps) };
      if (weightName && segment.weight !== null) values[weightName] = String(totalLoad(segment.weight, entry.bar));
      return values;
    });
    return { id: index + 1, segments, effort: parsed.effort };
  });

  return { id: exercise.id, name: exercise.name, nameSnapshot: exercise.nameSnapshot, fields: exercise.fields, sets };
}

export function sessionStart(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Bad date "${date}"`);
  return new Date(year, month - 1, day, SESSION_HOUR).getTime();
}

export type BuiltImport = {
  plans: WorkoutPlan[];
  sessions: { session: WorkoutSessionDoc; exerciseSessions: ExerciseSessionDoc[] }[];
};

/**
 * Every doc the import writes.
 *
 * - Each plan holds the exercises of its most recent session: the routine as
 *   it stands now. Rejected: every exercise the plan ever had, which would put
 *   one-off swaps (hammer curls on 21 Oct) back into today's plan.
 * - The end time is unknown, so `endedAt` equals the start. Nothing reads a
 *   duration from it today.
 */
export function buildImport(file: ImportFile): BuiltImport {
  const plansByKey = new Map(file.plans.map((plan) => [plan.key, plan]));
  const ordered = [...file.sessions].sort((a, b) => sessionStart(a.date) - sessionStart(b.date));

  const sessions = ordered.map((entry) => {
    const plan = plansByKey.get(entry.plan);
    if (!plan) throw new Error(`${entry.date}: unknown plan "${entry.plan}"`);
    const start = sessionStart(entry.date);
    const workout: ActiveWorkout = {
      id: plan.id,
      name: plan.name,
      startTime: start,
      exercises: entry.exercises.map(loggedExercise),
      currentExerciseIndex: null,
    };
    return buildSessionDocs(workout, start);
  });

  const plans = file.plans.map((plan): WorkoutPlan => {
    const latest = ordered.filter((s) => s.plan === plan.key).pop();
    if (!latest) throw new Error(`Plan "${plan.key}" has no sessions`);
    return { id: plan.id, name: plan.name, exercises: latest.exercises.map(planExercise) };
  });

  return { plans, sessions };
}
