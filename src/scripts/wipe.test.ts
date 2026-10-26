// TICKET-042: the wipe deletes only plans, history and the old catalog. Run
// against an in-memory Firestore; nothing here reaches a real database.

import { countWipeTargets, deleteWipeTargets, isConfirmedRun, totalDocs, type WipeDb } from "./wipe";

/** Doc paths only; a collection or a parent doc exists while some path runs through it. */
function fakeFirestore(paths: string[]) {
  let docs = new Set(paths);
  const children = (prefix: string) => [
    ...new Set([...docs].filter((p) => p.startsWith(`${prefix}/`)).map((p) => p.slice(prefix.length + 1).split("/")[0])),
  ];
  const db: WipeDb = {
    collection: (path) => ({ path, listDocuments: async () => children(path).map((id) => ({ id })) }),
    doc: (path) => ({ listCollections: async () => children(path).map((id) => ({ id })) }),
    recursiveDelete: async (ref) => {
      docs = new Set([...docs].filter((p) => !p.startsWith(`${ref.path}/`)));
    },
  };
  return { db, remaining: () => [...docs].sort() };
}

it("deletes plans, history, legacy logs and predefined_exercises only, for every user", async () => {
  const { db, remaining } = fakeFirestore([
    "users/u1/info/data",
    "users/u1/workouts/push",
    "users/u1/sessions/s1",
    "users/u1/exercise_sessions/s1_bench",
    "users/u1/exercise_stats/bench",
    "users/u1/workout_logs/old",
    "users/u1/settings/tour",
    // No users/u2 doc of its own, only subcollections: still wiped.
    "users/u2/workouts/legs",
    "predefined_exercises/bench_press",
    "exercise_catalog/meta",
  ]);

  const counts = await countWipeTargets(db);
  expect(totalDocs(counts)).toBe(7);
  expect(counts.users.find((u) => u.uid === "u1")?.kept).toEqual(["info", "settings"]);

  await deleteWipeTargets(db, counts);
  expect(remaining()).toEqual([
    "exercise_catalog/meta",
    "users/u1/info/data",
    "users/u1/settings/tour",
  ]);
});

it.each([
  ["no flags", false, []],
  ["--confirm", true, ["--confirm"]],
  ["--confirm with --dry-run", false, ["--confirm", "--dry-run"]],
])("%s: deletes = %s", (_label, expected, argv) => {
  expect(isConfirmedRun(argv)).toBe(expected);
});
