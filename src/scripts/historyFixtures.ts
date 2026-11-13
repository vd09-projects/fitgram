// src/scripts/historyFixtures.ts
//
// TICKET-087 stage 3: fixture workouts for the stored-shape comparison, and the
// two shapes themselves. Pure and seeded: the same call gives the same bytes.
//
// Fixtures are built by the importer's own path (`buildImport`, so the app's
// `buildSessionDocs`), from catalog lifts the real imported history uses, so
// field lists, ids, names and the set record are the app's, not invented. What
// is invented, and says so: which lifts a workout has, the weights and reps,
// and which sets are drop sets (`DROP_SET_SHARE`).
//
// The two shapes (what a `sessions` record holds):
//   A  `lifts` only; the sets stay in `exercise_sessions`, which stays.
//   B  `lifts` also hold their `fields` and `sets`; `exercise_sessions` is dropped.
// `lifts` is TICKET-081's: { id, name, verdict, reason } (`swappedFrom` and
// `added` are left out: they are absent on most lifts, so they would not move a
// size).
import type { ExerciseSessionDoc, StoredSet, WorkoutSessionDoc } from "../types/workoutSession";
import type { ExerciseField } from "../types/workoutType";
import type { FieldUnit } from "../constants/units";
import { verdictFor } from "./baselineVerdict";
import { buildImport, type ImportFile } from "./historyImport";

/** Lifts per workout and sets per lift, as the ticket asks. */
export const LIFTS_PER_WORKOUT = 8;
export const SETS_PER_LIFT = 5;
/**
 * Share of sets that are drop sets (a second segment). Higher than the real
 * history's share on purpose: the ticket asks for drop sets in the fixture, and
 * a larger share makes the held size an upper bound, not a flattering one.
 */
export const DROP_SET_SHARE = 0.2;

type PoolLift = { id: string; unit?: FieldUnit; bar?: number };
const POOL: Record<string, PoolLift[]> = {
  chest: [
    { id: "cable_crossover__cable", unit: "kg" },
    { id: "bench_press__machine", unit: "plates" },
    { id: "chest_fly__cable", unit: "kg" },
    { id: "bench_press__machine__incline", unit: "plates" },
    { id: "pullover__dumbbell", unit: "kg" },
    { id: "triceps_pushdown__cable__rope", unit: "kg" },
    { id: "chest_press__machine", unit: "kg" },
    { id: "bench_press__smith_machine", unit: "kg", bar: 20 },
  ],
  back: [
    { id: "lat_pulldown__cable", unit: "plates" },
    { id: "seated_row__cable", unit: "kg" },
    { id: "bent_over_row__barbell", unit: "kg", bar: 20 },
    { id: "bicep_curl__dumbbell", unit: "kg" },
    { id: "hammer_curl__cable__rope", unit: "kg" },
    { id: "reverse_curl__cable", unit: "kg" },
    { id: "straight_arm_pulldown__cable__rope", unit: "kg" },
    { id: "back_extension__added_weight", unit: "kg" },
  ],
  legs: [
    { id: "lying_leg_curl__machine", unit: "plates" },
    { id: "leg_extension__machine", unit: "plates" },
    { id: "leg_press__smith_machine", unit: "kg", bar: 20 },
    { id: "sumo_squat__dumbbell", unit: "kg" },
    { id: "lunge__dumbbell__one_side", unit: "kg" },
    { id: "standing_calf_raise__smith_machine", unit: "kg", bar: 20 },
    { id: "lateral_raise__dumbbell", unit: "kg" },
    { id: "shrug__dumbbell", unit: "kg" },
  ],
  shoulders: [
    { id: "shoulder_press__machine", unit: "plates" },
    { id: "lateral_raise__dumbbell", unit: "kg" },
    { id: "front_raise__dumbbell", unit: "kg" },
    { id: "rear_delt_fly__dumbbell", unit: "kg" },
    { id: "shrug__dumbbell", unit: "kg" },
    { id: "arnold_press__dumbbell", unit: "kg" },
    { id: "face_pull__cable__rope", unit: "kg" },
    { id: "lateral_raise__cable", unit: "kg" },
  ],
};
const PLAN_KEYS = Object.keys(POOL);

/** Small seeded generator (mulberry32), so a fixture is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
/** `perDay` workouts a day from a fixed date, so ids and months are stable. */
const dateOf = (index: number, perDay: number) => {
  const d = new Date(Date.UTC(2019, 0, 1) + Math.floor(index / perDay) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export type Fixture = { sessions: WorkoutSessionDoc[]; exerciseSessions: ExerciseSessionDoc[] };

/** Workouts a day when a caller says nothing: one every other day, the first stage 3 spacing. */
export const DEFAULT_WORKOUTS_PER_DAY = 0.5;

export function generateFixture(workouts: number, seed = 1, perDay = DEFAULT_WORKOUTS_PER_DAY): Fixture {
  const next = rng(seed);
  const base = new Map<string, number>();
  const file: ImportFile = {
    email: "fixture@example.com",
    plans: PLAN_KEYS.map((key) => ({ key, id: `fixture_${key}`, name: `${key} fixture` })),
    sessions: [],
  };
  for (let i = 0; i < workouts; i++) {
    const plan = PLAN_KEYS[i % PLAN_KEYS.length];
    file.sessions.push({
      date: dateOf(i, perDay),
      plan,
      source: "fixture",
      exercises: POOL[plan].slice(0, LIFTS_PER_WORKOUT).map((lift) => {
        const key = `${plan}:${lift.id}:${lift.bar ?? ""}`;
        // A slow random walk per lift, so verdicts spread instead of all rising.
        const weight = Math.max(2, (base.get(key) ?? 10 + Math.floor(next() * 30)) + (next() < 0.5 ? -1 : 1) * Math.floor(next() * 3));
        base.set(key, weight);
        const sets = Array.from({ length: SETS_PER_LIFT }, () => {
          const reps = 6 + Math.floor(next() * 8);
          const main = `${weight}-${reps}`;
          const drop = next() < DROP_SET_SHARE ? ` / ${Math.max(1, weight - 4)}-${3 + Math.floor(next() * 4)}` : "";
          const mark = next() < 0.1 ? (next() < 0.5 ? " E" : " H") : "";
          return lift.unit ? `${main}${drop}${mark}` : `${reps}${mark}`;
        });
        return { id: lift.id, unit: lift.unit, bar: lift.bar, sets };
      }),
    });
  }
  const built = buildImport(file);
  return {
    sessions: built.sessions.map((s) => s.session),
    exerciseSessions: built.sessions.flatMap((s) => s.exerciseSessions),
  };
}

// ---------------------------------------------------------------------------
// The two shapes
// ---------------------------------------------------------------------------

export type LiftRecord = { id: string; name: string; verdict: "better" | "lower" | "same" | null; reason: string | null };
export type LiftRecordWithSets = LiftRecord & { fields: ExerciseField[]; sets: StoredSet[] };
export type RecordA = WorkoutSessionDoc & { lifts: LiftRecord[] };
export type RecordB = WorkoutSessionDoc & { lifts: LiftRecordWithSets[] };

const VERDICT_WORD: Record<string, LiftRecord["verdict"]> = { Better: "better", Lower: "lower", Same: "same" };
const REASON: Record<string, string> = {
  "none: firstTime": "first_time",
  "none: unitChanged": "unit_changed",
  "none: pastUnavailable": "unreadable",
};

export type Shapes = { a: RecordA[]; b: RecordB[]; exerciseSessions: ExerciseSessionDoc[] };

/** Every workout in both shapes, verdicts from the app's own comparison. Oldest first. */
export function buildShapes(fixture: Fixture): Shapes {
  const byLift = new Map<string, ExerciseSessionDoc[]>();
  fixture.exerciseSessions.forEach((e) => byLift.set(e.exerciseId, [...(byLift.get(e.exerciseId) ?? []), e]));
  const verdicts = new Map<string, ReturnType<typeof verdictFor>>();
  for (const list of byLift.values()) {
    list.sort((x, y) => x.performedAt - y.performedAt || x.sessionId.localeCompare(y.sessionId));
    list.forEach((today, i) => verdicts.set(`${today.sessionId}|${today.exerciseId}`, verdictFor(i === 0 ? null : list[i - 1], today)));
  }
  const bySession = new Map<string, ExerciseSessionDoc[]>();
  fixture.exerciseSessions.forEach((e) => bySession.set(e.sessionId, [...(bySession.get(e.sessionId) ?? []), e]));

  const a: RecordA[] = [];
  const b: RecordB[] = [];
  for (const session of fixture.sessions) {
    const lifts = (bySession.get(session.sessionId) ?? []).map((e) => {
      const v = verdicts.get(`${e.sessionId}|${e.exerciseId}`)!;
      const verdict = VERDICT_WORD[v.bucket] ?? null;
      const lift: LiftRecord = { id: e.exerciseId, name: e.exerciseName, verdict, reason: verdict ? null : (REASON[v.bucket] ?? "no_volume") };
      return { lift, e };
    });
    a.push({ ...session, lifts: lifts.map((l) => l.lift) });
    b.push({ ...session, lifts: lifts.map((l) => ({ ...l.lift, fields: l.e.fields, sets: l.e.sets })) });
  }
  return { a, b, exerciseSessions: fixture.exerciseSessions };
}

/** Shard key of a workout: its start month, UTC, so a shard never moves with the phone's time zone. */
export const monthKey = (startedAt: number) => new Date(startedAt).toISOString().slice(0, 7);
