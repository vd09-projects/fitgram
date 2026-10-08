/**
 * verifyHistoryReads — proves the two claims the exercise-first history model
 * exists to make:
 *
 *   1. "What did I do last time on this exercise" answers across workouts. The
 *      last bench press is the last bench press, whichever plan it was in.
 *   2. Starting a workout costs ONE history fetch and every reader after that
 *      costs ZERO, however many exercises are visited or sets logged.
 *
 *   npx tsx src/scripts/verifyHistoryReads.ts
 *
 * A harness, not a test suite — no test runner is installed and adding one is a
 * separate decision.
 *
 * What is real here: `useWorkoutStore.startWorkout`, `useExerciseHistoryStore`,
 * `deriveExerciseHistory`, and the whole pure write path — `buildSessionDocs`,
 * `applySessionToStats`, `rebuildStatsFromSessions`. The fake stands in for
 * Firestore I/O only, and counts reads at that boundary.
 *
 * What is NOT covered: real Firestore round trips, composite indexes, security
 * rules, and the offline behaviour of `writeBatch` vs `runTransaction`. Those
 * need a run against the real backend.
 */

import * as fs from "fs";
import * as path from "path";
import type { ExerciseStatsDoc, ExerciseSessionDoc } from "../types/workoutSession";
import type { Exercise, ExerciseField, WorkoutPlan } from "../types/workoutType";
import type { ActiveWorkout } from "../types/zustandWorkoutType";

// ---------------------------------------------------------------------------
// Module stubs — installed before any real module is loaded
// ---------------------------------------------------------------------------

const stubModule = (request: string, exports: Record<string, unknown>) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  } as unknown as NodeModule;
};

/* eslint-disable @typescript-eslint/no-var-requires */
// The pure write path and rollup maths are the real thing.
const {
  applySessionToStats,
  bestKey,
  buildSessionDocs,
  rebuildStatsFromSessions,
  computeSessionVolume,
} = require("../utils/exerciseStats") as typeof import("../utils/exerciseStats");

/** In-memory stand-in for Firestore. */
const backend = {
  stats: {} as Record<string, ExerciseStatsDoc>,
  sessions: [] as ExerciseSessionDoc[],
};

/** Every history fetch this run has issued, in order. */
const fetches: string[][] = [];
let fetchBehaviour: "ok" | "throw" = "ok";

stubModule(path.join(__dirname, "../services/db/workoutSessions"), {
  __esModule: true,
  getExerciseStats: async (_userId: string, exerciseIds: string[]) => {
    fetches.push([...exerciseIds]);
    if (fetchBehaviour === "throw") throw new Error("simulated network failure");
    const out: Record<string, ExerciseStatsDoc | null> = {};
    for (const id of exerciseIds) out[id] = backend.stats[id] ?? null;
    return out;
  },
  saveWorkoutSession: async (_userId: string, workout: ActiveWorkout) => {
    const { exerciseSessions } = buildSessionDocs(workout, Date.now());
    for (const exerciseSession of exerciseSessions) {
      backend.sessions.push(exerciseSession);
      backend.stats[exerciseSession.exerciseId] = applySessionToStats(
        backend.stats[exerciseSession.exerciseId] ?? null,
        exerciseSession
      );
    }
    return { sessionId: "s", rollupApplied: true };
  },
  getExerciseSessions: async () => ({ sessions: [], lastDoc: null }),
});

const memory: Record<string, string> = {};
stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    setItem: async (k: string, v: string) => {
      memory[k] = v;
    },
    getItem: async (k: string) => memory[k] ?? null,
    removeItem: async (k: string) => {
      delete memory[k];
    },
  },
});

stubModule(path.join(__dirname, "../utils/toastUtils"), {
  __esModule: true,
  default: {
    success: () => undefined,
    error: () => undefined,
    info: () => undefined,
    warning: () => undefined,
    warn: () => undefined,
    alert: () => undefined,
  },
});

const { useWorkoutStore } =
  require("../stores/useWorkoutStore") as typeof import("../stores/useWorkoutStore");
const { useExerciseHistoryStore } =
  require("../stores/useExerciseHistoryStore") as typeof import("../stores/useExerciseHistoryStore");
const { useAuthStore } =
  require("../stores/authStore") as typeof import("../stores/authStore");
const { deriveExerciseHistory } =
  require("../utils/exerciseHistory") as typeof import("../utils/exerciseHistory");
const { toExerciseId } =
  require("../utils/validation") as typeof import("../utils/validation");
/* eslint-enable @typescript-eslint/no-var-requires */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BENCH = "bench_press";
const PLANK = "plank";
const SQUAT = "squats";
const BRAND_NEW = "cable_fly";

const KG_FIELDS: ExerciseField[] = [
  { name: "Weight (kg)", role: "weight", unit: "kg" },
  { name: "Reps", role: "reps" },
];
const LB_FIELDS: ExerciseField[] = [
  { name: "Weight (lb)", role: "weight", unit: "lb" },
  { name: "Reps", role: "reps" },
];
const PLANK_FIELDS: ExerciseField[] = [
  { name: "Total Time (min)", role: "time", unit: "min" },
  { name: "Notes", role: "other" },
];

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

const exercise = (id: string, name: string, fields: ExerciseField[]): Exercise => ({
  id,
  name,
  fields,
});

/** Workout 1 — has bench. */
const W1: WorkoutPlan = {
  id: "push_a",
  name: "Push A",
  exercises: [
    exercise(BENCH, "Bench Press", KG_FIELDS),
    exercise(PLANK, "Plank", PLANK_FIELDS),
    exercise(BRAND_NEW, "Cable Fly", KG_FIELDS),
  ],
};
/** Workout 2 — no bench. */
const W2: WorkoutPlan = {
  id: "legs",
  name: "Legs",
  exercises: [exercise(SQUAT, "Squats", KG_FIELDS)],
};
/** Workout 3 — also has bench. The cross-workout case. */
const W3: WorkoutPlan = {
  id: "full_body",
  name: "Full Body",
  exercises: [
    exercise(BENCH, "Bench Press", KG_FIELDS),
    exercise(SQUAT, "Squats", KG_FIELDS),
  ],
};

type SetSpec = Record<string, string | number>;

/** Seed a session straight into the fake backend, bypassing the live store. */
const seedSession = (
  workout: { id: string; name: string },
  exerciseId: string,
  exerciseName: string,
  fields: ExerciseField[],
  performedAt: number,
  sets: SetSpec[]
) => {
  const active: ActiveWorkout = {
    id: workout.id,
    name: workout.name,
    startTime: performedAt,
    lastUpdated: performedAt,
    isPersisted: false,
    currentExerciseIndex: 0,
    exercises: [
      {
        id: exerciseId,
        name: exerciseName,
        fields,
        sets: sets.map((f, i) => ({ id: performedAt + i, fields: f })),
      },
    ],
  };
  const { exerciseSessions } = buildSessionDocs(active, performedAt);
  for (const doc of exerciseSessions) {
    backend.sessions.push(doc);
    backend.stats[doc.exerciseId] = applySessionToStats(
      backend.stats[doc.exerciseId] ?? null,
      doc
    );
  }
  return exerciseSessions[0];
};

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let failures = 0;
let checks = 0;

const check = (label: string, condition: boolean, detail?: string) => {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const section = (title: string) => console.log(`\n${title}`);

const historyFor = (exerciseId: string, fields?: ExerciseField[]) =>
  deriveExerciseHistory(
    useExerciseHistoryStore.getState().entries[exerciseId],
    fields
  );

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const run = async () => {
  useAuthStore.setState({ user: { uid: "u1" } as never });

  // Bench pressed in Push A, then later in Full Body. Squats in both Legs and
  // Full Body. Plank only in Push A.
  seedSession(W1, BENCH, "Bench Press", KG_FIELDS, T0, [
    { "Weight (kg)": "60", Reps: "10" },
    { "Weight (kg)": "65", Reps: "8" },
    { "Weight (kg)": "70", Reps: "6" },
  ]);
  seedSession(W1, PLANK, "Plank", PLANK_FIELDS, T0, [
    { "Total Time (min)": "1.5", Notes: "solid" },
  ]);
  seedSession(W2, SQUAT, "Squats", KG_FIELDS, T0 + DAY, [
    { "Weight (kg)": "100", Reps: "5" },
  ]);
  seedSession(W3, SQUAT, "Squats", KG_FIELDS, T0 + 2 * DAY, [
    { "Weight (kg)": "105", Reps: "5" },
  ]);
  // The most recent bench press — in a DIFFERENT workout.
  seedSession(W3, BENCH, "Bench Press", KG_FIELDS, T0 + 2 * DAY, [
    // A real number, not a string: values come back as written.
    { "Weight (kg)": 62.5, Reps: "10" },
    { "Weight (kg)": "67.5", Reps: 8 },
  ]);

  // -- 1. Cross-workout lookup ---------------------------------------------
  section("1. Last bench press is cross-workout, not per-plan");
  await useWorkoutStore.getState().startWorkout(W1);
  await new Promise((resolve) => setImmediate(resolve));

  const bench = historyFor(BENCH, KG_FIELDS);
  check("history found while starting Push A", bench.hasHistory === true);
  check(
    "last session is the Full Body one, not the Push A one",
    bench.lastSession?.workoutId === "full_body",
    bench.lastSession?.workoutId
  );
  check(
    "it carries the workout name so a consumer can label it",
    bench.lastSession?.workoutName === "Full Body",
    bench.lastSession?.workoutName
  );
  check(
    "both sessions are visible",
    bench.sessions.length === 2,
    String(bench.sessions.length)
  );
  check(
    "sessions span both workouts",
    new Set(bench.sessions.map((s) => s.workoutId)).size === 2
  );

  // -- 2. One fetch on workout start ---------------------------------------
  section("2. startWorkout issues exactly one history fetch");
  check("one fetch issued", fetches.length === 1, `fetches=${fetches.length}`);
  check(
    "it batched every exercise in the plan",
    fetches[0]?.length === 3,
    `ids=${fetches[0]?.join(",")}`
  );
  check(
    "store's own counter agrees",
    useExerciseHistoryStore.getState().fetchCount === 1,
    String(useExerciseHistoryStore.getState().fetchCount)
  );

  // -- 3. Readers cost nothing ---------------------------------------------
  section("3. Readers issue zero further fetches");
  const before = fetches.length;
  const store = useWorkoutStore.getState();
  for (let i = 0; i < 100; i += 1) {
    for (const ex of W1.exercises) {
      const h = historyFor(ex.id, ex.fields);
      void h.lastSession;
      void h.sessions.length;
      void h.best.length;
      void h.volumeTrend.length;
      void h.setAt(i % 5);
      void h.bestAtReps(8);
    }
    await store.addSetToExercise(BENCH, {
      id: Date.now() + i,
      fields: { "Weight (kg)": "72.5", Reps: "8" },
    });
  }
  check(
    "300 exercise reads + 100 logged sets issued no fetches",
    fetches.length === before,
    `fetches=${fetches.length}, was ${before}`
  );

  // -- 4. Dedupe ------------------------------------------------------------
  section("4. Cached and concurrent prefetches are free");
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BENCH, PLANK]);
  check("fully cached batch: no fetch", fetches.length === 1);

  const beforeConcurrent = fetches.length;
  await Promise.all(
    [1, 2, 3, 4, 5].map(() =>
      useExerciseHistoryStore.getState().prefetchExerciseHistory("u1", [SQUAT])
    )
  );
  check(
    "five concurrent callers, one fetch",
    fetches.length === beforeConcurrent + 1,
    `delta=${fetches.length - beforeConcurrent}`
  );

  const beforeOverlap = fetches.length;
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BENCH, SQUAT, "lat_pulldown"]);
  const squats = historyFor(SQUAT, KG_FIELDS);
  check(
    "squats history spans Legs and Full Body",
    squats.sessions.length === 2,
    String(squats.sessions.length)
  );
  check(
    "squats' newest session is the Full Body one",
    squats.lastSession?.workoutId === "full_body",
    squats.lastSession?.workoutId
  );

  check(
    "an overlapping batch fetches only the missing exercise",
    fetches.length === beforeOverlap + 1 &&
      fetches[fetches.length - 1].join(",") === "lat_pulldown",
    fetches[fetches.length - 1]?.join(",")
  );

  // -- 5. First-ever exercise ----------------------------------------------
  section("5. A first-ever exercise returns empty history, no throw");
  const fresh = historyFor(BRAND_NEW, KG_FIELDS);
  check("hasHistory false", fresh.hasHistory === false);
  check("status ready, not error", fresh.status === "ready", fresh.status);
  check("lastSession null", fresh.lastSession === null);
  check("sessions empty", fresh.sessions.length === 0);
  check("best empty", fresh.best.length === 0);
  check("volumeTrend empty", fresh.volumeTrend.length === 0);
  check("setAt(1) null", fresh.setAt(1) === null);
  check("bestAtReps(8) null", fresh.bestAtReps(8) === null);
  check(
    "fields still resolved from the plan",
    fresh.numericComparisonAvailable === true
  );

  // -- 6. No weight/reps pair ----------------------------------------------
  section("6. A plank returns sessions with numbers reported unavailable");
  const plank = historyFor(PLANK, PLANK_FIELDS);
  check("hasHistory true", plank.hasHistory === true);
  check("numericFields null", plank.numericFields === null);
  check(
    "numericComparisonAvailable false",
    plank.numericComparisonAvailable === false
  );
  check("sessions present", plank.sessions.length === 1);
  check(
    "raw values still readable",
    plank.lastSession?.sets[0]?.fields["Total Time (min)"] === "1.5"
  );
  check(
    "no fabricated numbers",
    plank.lastSession?.sets[0]?.weight === null &&
      plank.lastSession?.sets[0]?.reps === null
  );
  check("volume null, not 0", plank.lastSession?.volume.value === null);
  check("best empty", plank.best.length === 0);
  check(
    "trend points null, not 0",
    plank.volumeTrend.every((p) => p.volume === null)
  );

  // -- 7. Set addressing ---------------------------------------------------
  section("7. Sets addressed by set number");
  const set2 = bench.setAt(2);
  check("setAt(2) is the second set", set2?.setNumber === 2);
  check("setAt(2) weight parsed", set2?.weight === 67.5, String(set2?.weight));
  check("setAt(2) reps parsed from a number", set2?.reps === 8);
  check(
    "setAt(1) parsed from a real number value",
    bench.setAt(1)?.weight === 62.5
  );
  check("setAt(0) null", bench.setAt(0) === null);
  check("setAt(99) null", bench.setAt(99) === null);
  check(
    "trend runs oldest to newest",
    bench.volumeTrend[0].performedAt === T0 &&
      bench.volumeTrend[bench.volumeTrend.length - 1].performedAt === T0 + 2 * DAY
  );

  // -- 8. best, all-time and cross-workout ----------------------------------
  section("8. best is heaviest at each exact rep count, all-time");
  check("best at 10 reps", bench.bestAtReps(10)?.weight === 62.5);
  check("best at 8 reps", bench.bestAtReps(8)?.weight === 67.5);
  check(
    "best at 6 reps survives from the older workout",
    bench.bestAtReps(6)?.weight === 70,
    String(bench.bestAtReps(6)?.weight)
  );
  check(
    "the 6-rep record is attributed to Push A",
    bench.bestAtReps(6)?.workoutId === "push_a",
    bench.bestAtReps(6)?.workoutId
  );
  check(
    "one entry per rep count, ascending",
    bench.best.map((b) => b.reps).join(",") === "6,8,10",
    bench.best.map((b) => b.reps).join(",")
  );
  check("undone rep count is null", bench.bestAtReps(3) === null);

  // A record is not displaced by an equal lift, and is by a heavier one.
  const tied = applySessionToStats(
    backend.stats[BENCH],
    seedSession(W1, BENCH, "Bench Press", KG_FIELDS, T0 + 3 * DAY, [
      { "Weight (kg)": "70", Reps: "6" },
    ])
  );
  check(
    "a matched record keeps the original session",
    tied.bestByReps[bestKey(6, "kg")].performedAt === T0,
    String(tied.bestByReps[bestKey(6, "kg")].performedAt)
  );
  check(
    "records are keyed per (reps, unit)",
    bestKey(8, "kg") !== bestKey(8, "lb")
  );

  // -- 9. Volume is all-or-nothing ------------------------------------------
  section("9. A session with an unparseable set reports no volume, not less");
  const partial = computeSessionVolume(
    [
      { "Weight (kg)": "60", Reps: "10" },
      { "Weight (kg)": "", Reps: "8" },
    ],
    { weight: KG_FIELDS[0], reps: KG_FIELDS[1] }
  );
  check("value null", partial.value === null);
  check(
    "but the gap is explained, not hidden",
    partial.setsCounted === 1 && partial.setsTotal === 2,
    `${partial.setsCounted}/${partial.setsTotal}`
  );
  const whole = computeSessionVolume(
    [
      { "Weight (kg)": "60", Reps: "10" },
      { "Weight (kg)": "65", Reps: "8" },
    ],
    { weight: KG_FIELDS[0], reps: KG_FIELDS[1] }
  );
  check("a fully parsed session reports a real total", whole.value === 1120);

  // -- 10. Unit mismatch ----------------------------------------------------
  section("10. A unit change is reported, never converted");
  // Same exercise, later session, defined in pounds.
  seedSession(W3, BENCH, "Bench Press", LB_FIELDS, T0 + 4 * DAY, [
    { "Weight (lb)": "160", Reps: "8" },
  ]);
  useExerciseHistoryStore.getState().invalidateExercises([BENCH]);
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BENCH]);

  const mixed = historyFor(BENCH, KG_FIELDS);
  check("mismatch flagged", mixed.unitMismatch === true);
  const lbSession = mixed.sessions.find((s) => s.performedAt === T0 + 4 * DAY);
  check("the lb session is present", lbSession !== undefined);
  check("it is marked not comparable", lbSession?.comparable === false);
  check(
    "it contributes no numbers",
    lbSession?.sets[0]?.weight === null && lbSession?.volume.value === null
  );
  check(
    "its raw value is still readable",
    lbSession?.sets[0]?.fields["Weight (lb)"] === "160"
  );
  check(
    "160 lb did not become a 160 kg record",
    (mixed.bestAtReps(8)?.weight ?? 0) !== 160,
    String(mixed.bestAtReps(8)?.weight)
  );
  check(
    "the 67.5 kg 8-rep record survived the unit change",
    mixed.bestAtReps(8)?.weight === 67.5,
    String(mixed.bestAtReps(8)?.weight)
  );
  check(
    "read in pounds, the lb record is the one returned",
    historyFor(BENCH, LB_FIELDS).bestAtReps(8)?.weight === 160,
    String(historyFor(BENCH, LB_FIELDS).bestAtReps(8)?.weight)
  );

  // -- 11. Rollup integrity -------------------------------------------------
  section("11. Rollup is idempotent and rebuildable");
  const doc = backend.sessions.find(
    (s) => s.exerciseId === SQUAT && s.workoutId === "legs"
  )!;
  const once = applySessionToStats(null, doc, 1);
  const twice = applySessionToStats(once, doc, 1);
  check(
    "re-applying a session does not duplicate it",
    twice.recentSessions.length === 1,
    String(twice.recentSessions.length)
  );
  check(
    "nor its volume point",
    twice.volumeHistory.length === 1,
    String(twice.volumeHistory.length)
  );

  const incremental = backend.stats[BENCH];
  const rebuilt = rebuildStatsFromSessions(
    BENCH,
    backend.sessions,
    incremental.updatedAt
  );
  check(
    "a full rebuild matches the incremental fold",
    JSON.stringify(rebuilt) === JSON.stringify(incremental)
  );
  check(
    "rebuilding an unperformed exercise returns null",
    rebuildStatsFromSessions("never_done", backend.sessions) === null
  );

  // -- 12. Offline ----------------------------------------------------------
  section("12. A failed fetch never blocks logging");
  fetchBehaviour = "throw";

  useExerciseHistoryStore.getState().invalidateExercises([BRAND_NEW]);
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BRAND_NEW]);
  const offline = historyFor(BRAND_NEW, KG_FIELDS);
  check("status error", offline.status === "error", offline.status);
  check("error surfaced", offline.error !== null);
  check("hasHistory false, no throw", offline.hasHistory === false);
  check("setAt still callable", offline.setAt(1) === null);

  const setsBefore =
    useWorkoutStore
      .getState()
      .activeWorkout?.exercises.find((e) => e.id === BENCH)?.sets.length ?? 0;
  await useWorkoutStore.getState().addSetToExercise(BENCH, {
    id: Date.now(),
    fields: { "Weight (kg)": "75", Reps: "5" },
  });
  const setsAfter =
    useWorkoutStore
      .getState()
      .activeWorkout?.exercises.find((e) => e.id === BENCH)?.sets.length ?? 0;
  check("set logged while offline", setsAfter === setsBefore + 1);

  await useWorkoutStore.getState().startWorkout(W3);
  await new Promise((resolve) => setImmediate(resolve));
  check(
    "startWorkout completed with a failing prefetch",
    useWorkoutStore.getState().activeWorkout?.id === "full_body"
  );

  // Cached data outlives a failed refetch.
  fetchBehaviour = "ok";
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BENCH], { force: true });
  fetchBehaviour = "throw";
  await useExerciseHistoryStore
    .getState()
    .prefetchExerciseHistory("u1", [BENCH], { force: true });
  const stale = historyFor(BENCH, KG_FIELDS);
  check("stale data still served", stale.hasHistory === true);
  check("status stays ready", stale.status === "ready", stale.status);
  check("failure still reported", stale.error !== null);
  fetchBehaviour = "ok";

  // -- 12b. Exercise identity is the join key -------------------------------
  section("12b. A typed exercise name maps to one canonical id");
  check(
    "case and spacing variants collapse to one id",
    toExerciseId("Cable Fly") === "cable_fly" &&
      toExerciseId("cable fly") === "cable_fly" &&
      toExerciseId("  Cable   Fly  ") === "cable_fly",
    [toExerciseId("Cable Fly"), toExerciseId("cable fly")].join(",")
  );
  check(
    "a typed name lands on the catalog's id, so the two share one history",
    toExerciseId("Bench Press") === BENCH,
    toExerciseId("Bench Press")
  );
  check(
    "ids stay valid for Firestore and for isValidId",
    /^[a-z0-9_]+$/.test(toExerciseId("Barbell Row"))
  );

  // -- 13. The hook cannot fetch -------------------------------------------
  section("13. useExerciseHistory has no path to a fetch");
  const hookSource = fs.readFileSync(
    path.join(__dirname, "../hooks/useExerciseHistory.ts"),
    "utf8"
  );
  const importLines = hookSource
    .split("\n")
    .filter((line) => line.trimStart().startsWith("import "));
  check(
    "imports no data-access module",
    !importLines.some((line) => /services\/db|firebase|firestore/.test(line)),
    importLines.join(" | ")
  );
  const body = hookSource
    .split("\n")
    .filter(
      (line) =>
        !line.trimStart().startsWith("*") && !line.trimStart().startsWith("/*")
    )
    .join("\n");
  check(
    "never calls prefetchExerciseHistory",
    !/prefetchExerciseHistory\s*\(/.test(body)
  );
  check(
    "never calls invalidateExercises",
    !/invalidateExercises\s*\(/.test(body)
  );

  // -- Summary --------------------------------------------------------------
  console.log(`\nhistory fetches this run: ${fetches.length}`);
  fetches.forEach((ids, i) => console.log(`  ${i + 1}. [${ids.join(", ")}]`));
  console.log(
    `\n${checks - failures}/${checks} checks passed${
      failures ? ` — ${failures} FAILED` : ""
    }`
  );
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("harness crashed:", error);
  process.exit(1);
});
