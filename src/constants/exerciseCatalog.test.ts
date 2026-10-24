// TICKET-042: version ids are history keys, so they never change once shipped.
// This list pins every one. A renamed or removed id fails here; so does a new
// one until it is added below, which is the moment it becomes a contract.
//
// Before TICKET-046 ships its catalog, this list is the hand-made stage 1
// catalog's and is replaced wholesale, deliberately, along with it.

import { EXERCISE_CATALOG } from "./exerciseCatalog";

const SHIPPED_VERSION_IDS = [
  "bench_press__barbell",
  "bench_press__dumbbell",
  "bench_press__smith_machine",
  "bench_press__machine",
  "bench_press__barbell__incline",
  "bench_press__dumbbell__incline",
  "bench_press__barbell__decline",
  "bench_press__barbell__close_grip",
  "triceps_pushdown__cable__rope",
  "triceps_pushdown__cable__straight_bar",
  "triceps_pushdown__cable__v_bar",
  "lateral_raise__dumbbell",
  "lateral_raise__cable",
  "lateral_raise__cable__one_side",
  "pec_deck__machine",
  "plank__bodyweight",
  "pull_up__pull_up_bar",
  "pull_up__assisted_machine",
];

it("every shipped version id is unchanged", () => {
  const ids = EXERCISE_CATALOG.flatMap((movement) => movement.versions.map((version) => version.id));
  expect([...ids].sort()).toEqual([...SHIPPED_VERSION_IDS].sort());
});
