// TICKET-051: Manage Workout edits a draft of the plan; these are its rules.

import { Exercise, WorkoutPlan } from "../types/workoutType";
import {
  EMPTY_PLAN_ERROR,
  addExercise,
  draftAfterQueued,
  draftAfterSave,
  draftFromPlan,
  isDraftDirty,
  newPlan,
  openPlanRefresh,
  planFromDraft,
  raceSave,
  refusedSaveMessage,
  removeExercise,
  renamedFrom,
  setExerciseFields,
  setPendingField,
  validateDraft,
  withArchived,
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
    const stored = planFromDraft(draft, "s");
    expect(stored.exercises[0].fields).toStrictEqual([
      { name: "Load", role: "weight", unit: "kg" },
      { name: "Reps", role: "time" },
      { name: "Tempo", role: "other" },
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/savedName|pendingField/);
  });

  it("does not add pending text that repeats a field", () => {
    const draft = setPendingField(draftFromPlan(plan()), BENCH, "Reps");
    expect(planFromDraft(draft, "s").exercises[0].fields.map((f) => f.name)).toEqual(["Weight (kg)", "Reps", "Notes"]);
  });
});

// TICKET-073 D6: a draft holds the version it is based on (`rev`, `saveId`),
// and Save writes the next one, based on it. Left behind when its version
// moves, every later Save is refused.
describe("a draft's version (TICKET-073)", () => {
  const atRev = (rev: number | undefined, name = "Push"): WorkoutPlan => ({
    ...plan(),
    name,
    ...(rev === undefined ? {} : { rev, saveId: `s${rev}` }),
  });
  const edited = (rev: number) => setPendingField(draftFromPlan(atRev(rev)), BENCH, "Tempo");

  it("Save writes the loaded rev + 1, its own saveId, based on the loaded one; rev is not an edit", () => {
    expect(planFromDraft(draftFromPlan(atRev(3)), "new")).toMatchObject({ rev: 4, saveId: "new", baseSaveId: "s3" });
    expect(planFromDraft(draftFromPlan(atRev(undefined)), "new")).toMatchObject({ rev: 1, baseSaveId: null });
    expect(isDraftDirty(atRev(3), draftFromPlan(atRev(7)))).toBe(false);
  });

  it("moves to a confirmed Save's version, edited since or not", () => {
    const saved = planFromDraft(edited(3), "s4");
    expect(draftAfterSave(edited(3), saved)).toMatchObject({ rev: 4, saveId: "s4" });
    expect(draftAfterSave(setPendingField(edited(3), BENCH, "Tempo2"), saved)).toMatchObject({ rev: 4, saveId: "s4" });
  });

  // PR #50 review, B1: the second Save names the first as its base, so the
  // rule refuses it if it refuses the first, whatever another device's rev.
  it("moves to a queued Save's version, so a second Save offline is based on it; never back", () => {
    const first = planFromDraft(edited(3), "s4"); // queued
    const draft = draftAfterQueued(edited(3), first)!;
    expect(planFromDraft(draft, "s5")).toMatchObject({ rev: 5, baseSaveId: "s4" });
    // The first lands after a second was queued.
    expect(draftAfterSave({ ...draft, rev: 5, saveId: "s5" }, first)).toMatchObject({ rev: 5, saveId: "s5" });
  });

  it("refresh on open: a newer version or a console edit replaces an untouched draft; typed into, it stays", () => {
    const opened = atRev(3);
    expect(openPlanRefresh(opened, atRev(4), draftFromPlan(opened))?.rev).toBe(4);
    expect(openPlanRefresh(opened, { ...opened, saveId: "other" }, draftFromPlan(opened))?.saveId).toBe("other");
    expect(openPlanRefresh(opened, atRev(3, "Push (console)"), draftFromPlan(opened))?.name).toBe("Push (console)");
    expect(openPlanRefresh(opened, atRev(3), draftFromPlan(opened))).toBeNull();
    expect(openPlanRefresh(opened, atRev(4), edited(3))).toBeNull();
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

// TICKET-052: a new plan, named by the user, under a generated id.
describe("newPlan (TICKET-052 D1, D2)", () => {
  const makeId = () => "generated_id";

  it("refuses an empty or whitespace-only name", () => {
    expect(newPlan("", [plan()], makeId)).toEqual({ ok: false, error: "Name the plan." });
    expect(newPlan(" \t ", [plan()], makeId)).toEqual({ ok: false, error: "Name the plan." });
  });

  it("refuses a name a loaded plan already has, ignoring case and spacing", () => {
    expect(newPlan("  pUSH ", [plan()], makeId)).toEqual({ ok: false, error: 'A plan named "Push" already exists.' });
    const pushDay = { ...plan(), id: "Push_Day", name: "Push Day" };
    expect(newPlan("Push   Day", [pushDay], makeId)).toMatchObject({ ok: false });
  });

  it("never reuses an existing id: a name that slugs to one gets the generated id", () => {
    // "Push Day" slugged to Push_Day, the id of a plan named differently.
    const existing = { ...plan(), id: "Push_Day", name: "Legs" };
    expect(newPlan(" Push  Day ", [existing], makeId)).toEqual({
      ok: true,
      plan: { id: "generated_id", name: "Push Day", exercises: [] },
    });
  });

  it("allows any characters and refuses only past 40", () => {
    expect(newPlan("Push · Chest & Triceps / A", [], makeId)).toMatchObject({ ok: true });
    expect(newPlan("x".repeat(40), [], makeId)).toMatchObject({ ok: true });
    expect(newPlan("x".repeat(41), [], makeId)).toEqual({ ok: false, error: "A plan name can be at most 40 characters." });
  });
});

// TICKET-061: Archive is an edit to the draft, and Save writes it with the plan.
describe("archive state through a draft", () => {
  it("is an unsaved edit until Save, and survives other edits", () => {
    const saved = plan();
    const archived = withArchived(draftFromPlan(saved), true);
    expect(isDraftDirty(saved, archived)).toBe(true);
    expect(planFromDraft(archived, "s").archived).toBe(true);

    const edited = addExercise(archived, pecDeck, "Pec Deck (Machine Fly)");
    expect(planFromDraft(edited, "s").archived).toBe(true);
    // Saved archived and reopened: nothing to save.
    expect(isDraftDirty(withArchived(saved, true), draftFromPlan(withArchived(saved, true)))).toBe(false);
  });

  it("drops the key when unarchived, so Save never writes undefined", () => {
    const draft = withArchived(draftFromPlan(withArchived(plan(), true)), false);
    expect("archived" in planFromDraft(draft, "s")).toBe(false);
    expect(isDraftDirty(withArchived(plan(), true), draft)).toBe(true);
  });
});
