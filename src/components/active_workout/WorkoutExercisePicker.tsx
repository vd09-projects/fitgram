// src/components/active_workout/WorkoutExercisePicker.tsx
//
// The Add Exercise picker over the active workout, in one of two modes:
// swap one of today's exercises (TICKET-047, boards SwapPicker, SwapVersion,
// SwapBack) or add one at the end (TICKET-056, boards AddPicker, AddVersion).
// The same component as Manage Workout's, with today's exercises taken
// instead of the plan's. One wrapper for both because everything but the mode
// and the pick is the same; it was SwapExercisePicker before 056.
//
// Mounted only while open, and it is what loads the picker's data: the user's
// plans (custom exercises) and recent sessions (Recent, last-used versions).
// Starting a workout therefore costs no extra reads; each open costs those two.
// Rejected: loading them on the active workout screen, which would read on
// every workout start for a feature most workouts never use. The catalog and
// search words are the phone's cached copy; no sync is started here.
// Until the reads land, the picker shows A–Z without Recent and no custom
// exercises, as Manage does while its own load is out.

import React, { useMemo } from "react";
import ExercisePicker, { type PickerMode } from "../exercise_picker/ExercisePicker";
import { useCatalogStore } from "../../stores/useCatalogStore";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { useAuthUser } from "../../hooks/useAuthUser";
import useWorkoutPlans from "../../hooks/useWorkoutPlans";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { customExercisesFromPlans } from "../../utils/exerciseSearch";
import { buildRecentHistory } from "../../utils/recents";
import { exerciseDisplayName } from "../../utils/catalog";
import show from "../../utils/toastUtils";
import type { Exercise } from "../../types/workoutType";
import type { LoggedExercise } from "../../types/zustandWorkoutType";

/** What the picker is open for: replacing one slot, or appending. */
export type WorkoutPickerPurpose = { kind: "swap"; replacing: LoggedExercise } | { kind: "add" };

type Props = {
  /** Today's exercises: every id is taken (one id per session, see `swapExercise`). */
  exercises: readonly LoggedExercise[];
  purpose: WorkoutPickerPurpose;
  onClose: () => void;
};

export default function WorkoutExercisePicker({ exercises, purpose, onClose }: Props) {
  const { user } = useAuthUser();
  const uid = user?.uid;
  const catalog = useCatalogStore((s) => s.catalog);
  const searchWords = useCatalogStore((s) => s.searchWords);
  const swapExercise = useWorkoutStore((s) => s.swapExercise);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const pendingUploads = useWorkoutStore((s) => s.pendingUploads);

  const { workoutPlans } = useWorkoutPlans(false);
  const customExercises = useMemo(() => customExercisesFromPlans(workoutPlans), [workoutPlans]);
  const myPendingCount = pendingUploads.filter((entry) => entry.uid === uid).length;
  const sessions = useRecentSessions(uid, myPendingCount);
  const recentHistory = useMemo(
    () => (catalog ? buildRecentHistory(sessions, pendingUploads, uid, catalog.index, customExercises) : null),
    [catalog, sessions, pendingUploads, uid, customExercises]
  );

  const taken = useMemo(() => new Set(exercises.map((e) => e.id)), [exercises]);
  const index = catalog?.index ?? null;
  const title = (exercise: Exercise) => exerciseDisplayName(exercise, index).title;

  let mode: PickerMode;
  if (purpose.kind === "swap") {
    const { replacing } = purpose;
    mode = {
      kind: "swap",
      replacing: { id: replacing.id, title: title(replacing) },
      planned: replacing.planned ? { exercise: replacing.planned, title: title(replacing.planned) } : null,
      added: replacing.added === true,
    };
  } else {
    const last = exercises[exercises.length - 1];
    mode = { kind: "add", after: last ? title(last) : null };
  }

  const onPick = async (exercise: Exercise) => {
    onClose();
    if (purpose.kind === "swap") {
      const result = await swapExercise(purpose.replacing.id, exercise);
      if (result.status === "refused") show.alert("Couldn't swap", result.reason);
    } else {
      const result = await addExercise(exercise);
      if (result.status === "refused") show.alert("Couldn't add", result.reason);
    }
  };

  return (
    <ExercisePicker
      movements={catalog?.movements ?? null}
      searchWords={searchWords?.words ?? null}
      customExercises={customExercises}
      inPlan={taken}
      mode={mode}
      recentHistory={recentHistory}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
