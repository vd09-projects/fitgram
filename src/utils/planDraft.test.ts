// TICKET-051: Manage Workout edits a draft of the plan; these are its rules.

import { Exercise, WorkoutPlan } from "../types/workoutType";
import {
  EMPTY_PLAN_ERROR,
  addExercise,
  draftFromPlan,
  isDraftDirty,
  planFromDraft,
  raceSave,
  refusedSaveMessage,
  removeExercise,
  renamedFrom,
  setExerciseFields,
  setPendingField,
  validateDraft,
} from "./planDraft";
import { patchField } from "./exerciseFields";
import { validateCustomFields } from "./exerciseValidations";

const plan = (): WorkoutPlan => ({
  id: "push",
  name: "Push",
  exercises: [
    {
      id: "bench_press__barbell",
      name: "",
      nameSnapshot: "Bench Press · Barbell",
      fields: [
        { name: "Weight (kg)", role: "weight", unit: "kg" },
        { name: "Reps", role: "reps" },
        { name: "Notes", role: "other" },
      ],
    },
  ],
});

const pecDeck: Exercise = {
  id: "pec_deck__machine",
  name: "",
  nameSnapshot: "Pec Deck (Machine Fly)",
  fields: [
    { name: "Weight", role: "weight", unit: "kg" },
    { name: "Reps", role: "reps" },
  ],
};

const BENCH = "bench_press__barbell";

describe("the draft", () => {
  it("never mutates the plan it was loaded from (D1)", () => {
    const loaded = plan();
    const before = JSON.stringify(loaded);
    let draft = draftFromPlan(loaded);
    const fields = draft.exercises[0].fields;
    draft = setExerciseFields(draft, BENCH, [patchField(fields[0], { unit: "plates" }), fields[1]]);
    draft = addExercise(draft, pecDeck, "Pec Deck (Machine Fly)");
    draft = removeExercise(draft, BENCH);
    expect(JSON.stringify(loaded)).toBe(before);
  });

  it("is dirty only when Save would write something different", () => {
    const saved = plan();
    const draft = draftFromPlan(saved);
    const [weight, reps, notes] = draft.exercises[0].fields;
    expect(isDraftDirty(saved, draft)).toBe(false);

    const renamed = setExerciseFields(draft, BENCH, [{ ...weight, name: "Weight" }, reps, notes]);
    expect(isDraftDirty(saved, renamed)).toBe(true);
    const renamedBack = setExerciseFields(renamed, BENCH, [{ ...weight, name: "Weight (kg) " }, reps, notes]);
    expect(isDraftDirty(saved, renamedBack)).toBe(false);

    expect(isDraftDirty(saved, setPendingField(draft, BENCH, "Tempo"))).toBe(true);
  });

  it("refuses a version already in the draft, and re-allows one removed (D3)", () => {
    const draft = addExercise(draftFromPlan(plan()), pecDeck, "Pec Deck");
    expect(addExercise(draft, pecDeck, "Pec Deck")).toBe(draft);
    const removed = removeExercise(draft, pecDeck.id);
    expect(addExercise(removed, pecDeck, "Pec Deck").exercises.map((e) => e.id)).toEqual([BENCH, pecDeck.id]);
  });
});

describe("rename warning (D2)", () => {
  it("follows the field, not its index, when a field above is removed", () => {
    const draft = draftFromPlan(plan());
    const [, reps, notes] = draft.exercises[0].fields;
    // Remove Weight (index 0), rename Notes. Notes is now at index 1, where
    // Reps used to be: an index match would flag Reps.
    const edited = setExerciseFields(draft, BENCH, [reps, { ...notes, name: "Cues" }]);
    expect(edited.exercises[0].fields.map(renamedFrom)).toEqual([null, "Notes"]);
  });

  it("never warns for a field or an exercise added in the draft", () => {
    const draft = addExercise(draftFromPlan(plan()), pecDeck, "Pec Deck");
    const added = draft.exercises[1].fields.map((f) => ({ ...f, name: f.name + "!" }));
    expect(added.map(renamedFrom)).toEqual([null, null]);
    expect(renamedFrom({ name: "New", role: "other" })).toBeNull();
  });
});

describe("planFromDraft", () => {
  it("stores trimmed names and the pending text, never draft-only keys or undefined", () => {
    let draft = draftFromPlan(plan());
    const [weight, reps] = draft.exercises[0].fields;
    // Weight → time: kg is not a time unit and must not be written as one.
    draft = setExerciseFields(draft, BENCH, [{ ...weight, name: " Load " }, patchField(reps, { role: "time" })]);
    draft = setPendingField(draft, BENCH, " Tempo ");
    const stored = planFromDraft(draft);
    expect(stored.exercises[0].fields).toStrictEqual([
      { name: "Load", role: "weight", unit: "kg" },
      { name: "Reps", role: "time" },
      { name: "Tempo", role: "other" },
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/savedName|pendingField/);
  });

  it("does not add pending text that repeats a field", () => {
    const draft = setPendingField(draftFromPlan(plan()), BENCH, "Reps");
    expect(planFromDraft(draft).exercises[0].fields.map((f) => f.name)).toEqual(["Weight (kg)", "Reps", "Notes"]);
  });
});

describe("validateDraft (D4)", () => {
  it("refuses an empty plan", () => {
    const result = validateDraft(removeExercise(draftFromPlan(plan()), BENCH));
    expect(result).toEqual({ plan: EMPTY_PLAN_ERROR, rows: {}, ok: false });
  });

  it("puts a field error on its own row", () => {
    let draft = addExercise(draftFromPlan(plan()), pecDeck, "Pec Deck");
    draft = setExerciseFields(draft, pecDeck.id, []);
    expect(validateDraft(draft)).toEqual({ plan: null, rows: { [pecDeck.id]: "At least one field is required." }, ok: false });
  });
});

it("a refused Save names the first failing exercise and counts the rest", () => {
  let draft = addExercise(draftFromPlan(plan()), pecDeck, "Pec Deck");
  draft = setExerciseFields(setExerciseFields(draft, BENCH, []), pecDeck.id, []);
  const nameOf = (e: { id: string }) => (e.id === BENCH ? "Bench Press · Barbell" : "Pec Deck");
  expect(refusedSaveMessage(draft, validateDraft(draft), nameOf)).toBe(
    "Bench Press · Barbell: at least one field is required (and 1 more)."
  );
});

describe("role and unit (D6 d)", () => {
  it("drops a unit the new role does not offer, keeps one it does", () => {
    const weight = { name: "Weight", role: "weight" as const, unit: "kg" as const, savedName: "Weight" };
    expect(patchField(weight, { role: "time" })).toEqual({ name: "Weight", role: "time", savedName: "Weight" });
    expect(patchField({ name: "Load", role: "other" as const }, { role: "weight" })).toEqual({ name: "Load", role: "weight" });
  });

  it("keeps the catalog's Assistance kg on a rename (role other, no unit chips)", () => {
    const assistance = { name: "Assistance", role: "other" as const, unit: "kg" as const };
    expect(patchField(assistance, { name: "Assist" })).toEqual({ name: "Assist", role: "other", unit: "kg" });
    expect(validateCustomFields([assistance, { name: "Reps", role: "reps" }])).toBeNull();
  });

  it("refuses a unit that is not one of its role's", () => {
    expect(validateCustomFields([{ name: "Hold", role: "time", unit: "kg" }])).toBe(
      'Field "Hold" cannot use kg as a time unit.'
    );
  });
});

describe("raceSave (offline rule)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("says pending when the write has not settled within the grace", async () => {
    const result = raceSave(new Promise<void>(() => {}), 10_000);
    jest.advanceTimersByTime(10_000);
    await expect(result).resolves.toBe("pending");
  });

  it("says saved when the write lands in time, and rethrows a rejection", async () => {
    await expect(raceSave(Promise.resolve(), 10_000)).resolves.toBe("saved");
    await expect(raceSave(Promise.reject(new Error("denied")), 10_000)).rejects.toThrow("denied");
  });
});
