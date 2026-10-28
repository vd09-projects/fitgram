// src/utils/planDraft.ts
//
// Manage Workout's edit model (TICKET-051). The screen edits a draft copy of
// the plan, never the plan object it loaded: the old screen spliced into the
// plan held by `useWorkoutPlans`, so edits it "discarded" survived a plan
// switch (D1). Everything here is pure, so the edits, the dirty check, the
// validation and the plan that gets written are tested without a screen.

import { Exercise, ExerciseField, WorkoutPlan } from "../types/workoutType";
import { validateCustomFields } from "./exerciseValidations";
import { planExerciseFromPick } from "./catalog";

/**
 * A field as edited. `savedName` is the name it had in the saved plan, so a
 * rename is detected by comparing against it (D2). Fields have no id, and
 * matching by index would flag the wrong field after one above it is removed.
 * Absent on a field added in this draft: it has no history to lose. Draft only;
 * `planFromDraft` strips it, so it is never stored.
 */
export type DraftField = ExerciseField & { savedName?: string };

/**
 * A plan exercise as edited. Keyed by `id`: a version is in a plan at most once
 * (D3), so the id is unique within the draft. `pendingField` is text typed in
 * the row's add box and not committed with +; Save accepts it, as before.
 */
export type DraftExercise = Omit<Exercise, "fields"> & {
  fields: DraftField[];
  pendingField: string;
};

export type PlanDraft = {
  id: string;
  name: string;
  exercises: DraftExercise[];
};

export function draftFromPlan(plan: WorkoutPlan): PlanDraft {
  return {
    id: plan.id,
    name: plan.name,
    exercises: plan.exercises.map((exercise) => ({
      ...exercise,
      fields: exercise.fields.map((field) => ({ ...field, savedName: field.name })),
      pendingField: "",
    })),
  };
}

/**
 * The fields Save would store for one exercise: names trimmed, the pending
 * add-box text appended as an `other` field unless it repeats a name. Built key
 * by key, so no `undefined` reaches Firestore (which rejects it) and no
 * `savedName` is stored.
 */
function fieldsToStore(exercise: DraftExercise): ExerciseField[] {
  const fields: ExerciseField[] = exercise.fields.map((field) => ({
    name: field.name.trim(),
    role: field.role,
    ...(field.unit !== undefined ? { unit: field.unit } : {}),
  }));
  const pending = exercise.pendingField.trim();
  if (pending !== "" && !fields.some((field) => field.name === pending))
    fields.push({ name: pending, role: "other" });
  return fields;
}

/** The plan document Save writes: the whole plan, as the draft now reads. */
export function planFromDraft(draft: PlanDraft): WorkoutPlan {
  return {
    id: draft.id,
    name: draft.name,
    exercises: draft.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      ...(exercise.nameSnapshot ? { nameSnapshot: exercise.nameSnapshot } : {}),
      fields: fieldsToStore(exercise),
    })),
  };
}

/** Order-sensitive: reordering exercises or fields is a change. */
function canonical(plan: WorkoutPlan): string {
  return JSON.stringify({
    name: plan.name,
    exercises: plan.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      nameSnapshot: exercise.nameSnapshot ?? null,
      fields: exercise.fields.map((field) => ({
        name: field.name.trim(),
        role: field.role,
        unit: field.unit ?? null,
      })),
    })),
  });
}

/**
 * Does Save have anything to write? Compares what Save would store against the
 * saved plan, not an "edited" flag: renaming a field and renaming it back is
 * not a change, and pending add-box text is.
 */
export function isDraftDirty(saved: WorkoutPlan, draft: PlanDraft): boolean {
  return canonical(saved) !== canonical(planFromDraft(draft));
}

const mapExercise = (
  draft: PlanDraft,
  exerciseId: string,
  update: (exercise: DraftExercise) => DraftExercise
): PlanDraft => ({
  ...draft,
  exercises: draft.exercises.map((exercise) => (exercise.id === exerciseId ? update(exercise) : exercise)),
});

/**
 * The field list as the field editor returns it. The editor spreads each field
 * it edits and filters the one it removes, so `savedName` rides along with its
 * own field, and a field it adds has none.
 */
export const setExerciseFields = (draft: PlanDraft, exerciseId: string, fields: DraftField[]): PlanDraft =>
  mapExercise(draft, exerciseId, (exercise) => ({ ...exercise, fields }));

export const setPendingField = (draft: PlanDraft, exerciseId: string, text: string): PlanDraft =>
  mapExercise(draft, exerciseId, (exercise) => ({ ...exercise, pendingField: text }));

export const removeExercise = (draft: PlanDraft, exerciseId: string): PlanDraft => ({
  ...draft,
  exercises: draft.exercises.filter((exercise) => exercise.id !== exerciseId),
});

/**
 * Add a picked exercise with its catalog fields, at the end. A version already
 * in the draft is refused (D3): the draft is returned unchanged. The picker
 * already greys it, from the same draft. Its fields carry no `savedName`: an
 * exercise added in this draft has nothing to warn about, even if the same
 * version was removed and re-added.
 */
export function addExercise(draft: PlanDraft, picked: Exercise, label: string): PlanDraft {
  if (draft.exercises.some((exercise) => exercise.id === picked.id)) return draft;
  const planExercise = planExerciseFromPick(picked, label, picked.fields);
  return {
    ...draft,
    exercises: [...draft.exercises, { ...planExercise, fields: planExercise.fields.map((f) => ({ ...f })), pendingField: "" }],
  };
}

/** The saved name a field was renamed from, or null if it was not renamed (D2). */
export function renamedFrom(field: DraftField): string | null {
  if (field.savedName === undefined) return null;
  return field.savedName !== field.name.trim() ? field.savedName : null;
}

/** A collapsed row's summary: "Weight kg · Reps". Plain names only, no roles. */
export function fieldSummary(fields: ExerciseField[]): string {
  if (fields.length === 0) return "No fields";
  return fields.map((field) => (field.unit ? `${field.name.trim()} ${field.unit}` : field.name.trim())).join(" · ");
}

export const PLAN_NAME_MAX = 40;

/** A plan name as stored and compared: trimmed, runs of whitespace as one space. */
export const normalizePlanName = (name: string): string => name.trim().replace(/\s+/g, " ");

/**
 * Why a new plan's name is refused, or null (TICKET-052 D2). Any characters:
 * the id is generated, so the name never reaches a doc path, and the boards
 * name plans "Push · Chest & Triceps". A duplicate is one of the loaded plans
 * with the same normalised name, ignoring case: Start lists plans by name, so
 * two "Push Day"s could not be told apart. Only the loaded plans are checked,
 * not one still queued offline.
 */
export function validatePlanName(name: string, plans: WorkoutPlan[]): string | null {
  const normalized = normalizePlanName(name);
  if (normalized === "") return "Name the plan.";
  if (normalized.length > PLAN_NAME_MAX) return `A plan name can be at most ${PLAN_NAME_MAX} characters.`;
  const key = normalized.toLowerCase();
  const existing = plans.find((plan) => normalizePlanName(plan.name).toLowerCase() === key);
  return existing ? `A plan named "${existing.name}" already exists.` : null;
}

/**
 * A new plan, empty, under a generated id (TICKET-052 D1). Not the name as a
 * slug: that let a typed name land on an existing plan's id, and its first Save
 * (whole-doc write) replaced that plan. `makeId` is Firestore's local id maker
 * on the device (`newPlanId`), a stub in tests. Nothing is written here: the
 * plan is first stored by Save changes, with its first exercise (D6 b).
 */
export function newPlan(
  name: string,
  plans: WorkoutPlan[],
  makeId: () => string
): { ok: true; plan: WorkoutPlan } | { ok: false; error: string } {
  const error = validatePlanName(name, plans);
  if (error) return { ok: false, error };
  return { ok: true, plan: { id: makeId(), name: normalizePlanName(name), exercises: [] } };
}

export const EMPTY_PLAN_ERROR = "A plan needs at least one exercise.";

export type DraftErrors = {
  /** About the plan as a whole, or null. */
  plan: string | null;
  /** Per exercise id, the first problem with its fields. */
  rows: Record<string, string>;
  ok: boolean;
};

/**
 * What would stop Save, by row (D4). Fields are validated as Save would store
 * them, pending text included. Exercise names are not checked: a version is
 * not editable here, so a row's name is the one it was saved or picked with.
 */
export function validateDraft(draft: PlanDraft): DraftErrors {
  const plan = planFromDraft(draft);
  const rows: Record<string, string> = {};
  for (const exercise of plan.exercises) {
    const error = validateCustomFields(exercise.fields);
    if (error) rows[exercise.id] = error;
  }
  const planError = plan.exercises.length === 0 ? EMPTY_PLAN_ERROR : null;
  return { plan: planError, rows, ok: planError === null && Object.keys(rows).length === 0 };
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The toast for a refused Save: the plan's problem, or the first row's, named
 * by its exercise ("Bench Press · Barbell: at least one field is required.").
 * The toast sits at the bottom of the screen, so it names the row rather than
 * pointing at it (device review, round 1). Rows follow the draft's order.
 */
export function refusedSaveMessage(
  draft: PlanDraft,
  errors: DraftErrors,
  nameOf: (exercise: DraftExercise) => string
): string {
  if (errors.plan) return errors.plan;
  const failing = draft.exercises.filter((exercise) => exercise.id in errors.rows);
  if (failing.length === 0) return "";
  const error = lowerFirst(errors.rows[failing[0].id]);
  const message = failing.length > 1 ? `${error.replace(/\.$/, "")} (and ${failing.length - 1} more).` : error;
  return `${nameOf(failing[0])}: ${message}`;
}

/**
 * How long Save waits for the server before saying the plan is not saved yet.
 * With `memoryLocalCache` (firebase.ts), `setDoc` resolves only on the server's
 * acknowledgement and never while offline, so an unbounded await would leave
 * Save spinning (offline rule, D4).
 */
export const SAVE_GRACE_MS = 10_000;

/**
 * Race a write against `graceMs`. "saved" if it resolved in time, "pending" if
 * not; a rejection is rethrown. A pending write is not cancelled: it may still
 * land, and the caller listens on the same promise for that.
 */
export async function raceSave(write: Promise<void>, graceMs: number = SAVE_GRACE_MS): Promise<"saved" | "pending"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      write.then(() => "saved" as const),
      new Promise<"pending">((resolve) => {
        timer = setTimeout(() => resolve("pending"), graceMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
