// TICKET-050 stage 1: recents and last-used, on the real catalog.

import { CATALOG } from "../catalog";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import type { Exercise } from "../types/workoutType";
import type { PendingUpload } from "../types/zustandWorkoutType";
import { buildCatalogIndex } from "./catalog";
import { buildRecentHistory, recentDateLabel } from "./recents";

const index = buildCatalogIndex(CATALOG);
const DAY = 86_400_000;

const session = (startedAt: number, exerciseIds: string[]): WorkoutSessionDoc => ({
  lifts: [], sessionId: `s${startedAt}`,
  workoutId: "push",
  workoutName: "Push",
  startedAt,
  endedAt: startedAt + 3600_000,
  exerciseIds,
});

/** A finished workout on this phone, not uploaded. `ids` with sets; `skipped` logged with none. */
const pending = (uid: string, startTime: number, ids: string[], skipped: string[] = []): PendingUpload => ({
  sessionId: `p${startTime}`,
  uid,
  workout: {
    id: "push",
    name: "Push",
    startTime,
    currentExerciseIndex: null,
    exercises: [
      ...ids.map((id) => ({ id, name: "", fields: [], sets: [{ id: 1, segments: [{ Reps: "8" }] }] })),
      ...skipped.map((id) => ({ id, name: "", fields: [], sets: [] })),
    ],
  },
  endedAt: startTime + 3600_000,
  failedAttempts: 0,
  lastError: null,
});

const custom: Exercise = { id: "custom_1", name: "Gym Sled Thing", fields: [] };

test("one row per movement, newest first, as the version last logged; pending merged, gaps skipped", () => {
  const history = buildRecentHistory(
    [
      session(3 * DAY, ["bench_press__barbell__close_grip", "no_longer__in_catalog", custom.id]),
      session(1 * DAY, ["bench_press__dumbbell", "lat_pulldown__cable", "custom_gone"]),
    ],
    [pending("me", 5 * DAY, ["triceps_pushdown__cable__rope"], ["lat_pulldown__cable"]), pending("someone-else", 9 * DAY, ["seated_cable_fly__cable"])],
    "me",
    index,
    [custom]
  )!;
  const rows = history.recents.map((r) => (r.kind === "movement" ? `${r.version.id}@${r.performedAt / DAY}` : `custom:${r.exercise.id}`));
  expect(rows).toEqual([
    "triceps_pushdown__cable__rope@5", // pending, newest; its set-less Lat Pulldown is not "logged"
    "bench_press__barbell__close_grip@3", // not the older dumbbell bench: one row per movement
    "custom:custom_1", // a custom exercise a plan holds; "custom_gone" and the removed id are skipped
    "lat_pulldown__cable@1",
  ]);
  expect(history.lastUsed.get("bench_press")?.version.id).toBe("bench_press__barbell__close_grip");
});

test("a custom exercise no plan holds is named by the workout that logged it (TICKET-082)", () => {
  const lift = (id: string, name: string) => ({ id, name, fields: [], sets: [], verdict: null, reason: null }) as WorkoutSessionDoc["lifts"][number];
  const logged = (startedAt: number, lifts: WorkoutSessionDoc["lifts"]): WorkoutSessionDoc => ({ ...session(startedAt, lifts.map((l) => l.id)), lifts });
  const rows = (sessions: WorkoutSessionDoc[], plans: Exercise[] = []) =>
    buildRecentHistory(sessions, [], "me", index, plans)!.recents.map((r) => (r.kind === "custom" ? `${r.exercise.id}:${r.exercise.name}` : r.version.id));

  // Newest session's name wins; a plan's own copy wins over both.
  expect(rows([logged(2 * DAY, [lift("sled", "Sled push")]), logged(DAY, [lift("sled", "Sled")])])).toEqual(["sled:Sled push"]);
  expect(rows([logged(DAY, [lift("custom_1", "Logged name")])], [custom])).toEqual(["custom_1:Gym Sled Thing"]);
  // Unreadable `lifts` name nothing: skipped, as before, never a row with no name.
  expect(rows([{ ...session(DAY, ["sled"]), liftsUnreadable: true }])).toEqual([]);
});

test("no sessions result yet (or a failed query): no history at all, pending workouts included", () => {
  expect(buildRecentHistory(null, [pending("me", DAY, ["bench_press__dumbbell"])], "me", index, [])).toBeNull();
  expect(buildRecentHistory([], [], "me", index, [])).toEqual({ lastUsed: new Map(), recents: [] });
});

test("dates: '22 Oct' this year, with the year otherwise", () => {
  const now = new Date(2026, 9, 27).getTime();
  expect(recentDateLabel(new Date(2026, 9, 22).getTime(), now)).toBe("22 Oct");
  expect(recentDateLabel(new Date(2025, 11, 30).getTime(), now)).toBe("30 Dec 2025");
});
