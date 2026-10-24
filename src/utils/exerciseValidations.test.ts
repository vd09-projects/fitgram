// TICKET-048: catalog names such as "Pull-Ups" were refused by the exercise name
// rule (letters and spaces only), so they could not be added to a plan.

import { DropdownSelection } from "../components/SearchableInputDropdown";
import { Exercise } from "../types/workoutType";
import { validateExerciseSelection } from "./exerciseValidations";
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
