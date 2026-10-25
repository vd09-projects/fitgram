// TICKET-048: catalog names such as "Pull-Ups" were refused by the exercise name
// rule (letters and spaces only), so they could not be added to a plan.

import { DropdownSelection } from "../components/SearchableInputDropdown";
import { Exercise } from "../types/workoutType";
import { validateExerciseSelection, validateWorkoutAndExercises } from "./exerciseValidations";
import { toExerciseId } from "./validation";

const select = (name: string, id: string): DropdownSelection<Exercise> =>
  ({ label: name, value: { id, name, fields: [] } }) as DropdownSelection<Exercise>;

describe("exercise name rule", () => {
  it.each([
    ["Pull-Ups", "pull_ups"],
    ["Pec Deck (Machine Fly)", "pec_deck_machine_fly"],
    ["Farmer’s Walk", "farmers_walk"],
  ])("accepts %s", (name, id) => {
    expect(validateExerciseSelection(select(name, id), new Set())).toBeNull();
  });

  it("refuses a character outside the allowed set and names the set", () => {
    expect(validateExerciseSelection(select("Bench@Press", "bench_press"), new Set())).toBe(
      'Exercise Name contains an invalid character: "@". Only letters, numbers, spaces and - ( ) / \' & are allowed.'
    );
  });
});

describe("toExerciseId", () => {
  // A custom exercise's id comes from its typed name, so punctuation the name
  // rule now allows must still yield an id isValidId accepts — and the catalog's.
  it.each([
    ["Pull-Ups", "pull_ups"],
    ["Farmer’s Walk", "farmers_walk"],
    ["Pec Deck (Machine Fly)", "pec_deck_machine_fly"],
  ])("maps %s to %s", (name, id) => {
    expect(toExerciseId(name)).toBe(id);
  });
});

// TICKET-042 stage 2: catalog names are built ("Bench Press · Dumbbell,
// incline") and stored only as a snapshot, so the name rule never meets them.
describe("a plan holding a catalog version", () => {
  const fields = [
    { name: "Weight", role: "weight" as const, unit: "kg" as const },
    { name: "Reps", role: "reps" as const },
  ];
  const incline = {
    id: "bench_press__dumbbell__incline",
    name: "",
    nameSnapshot: "Bench Press · Dumbbell, incline",
    fields,
  };

  it("saves, and is added from the picker by its built name", () => {
    expect(validateWorkoutAndExercises({ id: "push", name: "Push", exercises: [incline] })).toBeNull();
    const picked = { label: incline.nameSnapshot, value: incline } as DropdownSelection<Exercise>;
    expect(validateExerciseSelection(picked, new Set())).toBeNull();
  });

  it("still refuses a custom name with that character, and names a duplicate as the user sees it", () => {
    const custom = { id: "bench_press", name: "Bench · Press", fields };
    expect(validateWorkoutAndExercises({ id: "push", name: "Push", exercises: [custom] })).toMatch(/invalid character: "·"/);
    expect(validateWorkoutAndExercises({ id: "push", name: "Push", exercises: [incline, incline] })).toBe(
      'Exercise "Bench Press · Dumbbell, incline" is duplicated.'
    );
  });
});
