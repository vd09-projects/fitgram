// src/hooks/useWorkoutPlansOnFocus.ts

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import useWorkoutPlans from "./useWorkoutPlans";

/**
 * `useWorkoutPlans`, re-read each time the screen comes back into view, not
 * only on mount. The Workout stack keeps its screens mounted underneath
 * (WorkoutNavigator `singleCopy`), so a plan edited in Manage Workout showed its
 * old exercises until the app restarted (device, 2026-11-03). Flipping the
 * hook's refetch flag reuses its one read; the first focus is the mount, which
 * already reads. Used by the hub and All plans (TICKET-066), the two screens
 * that list plans and stay mounted.
 *
 * Rejected: a focus refetch inside `useWorkoutPlans`, which other screens and
 * components use, some outside a navigator in their tests.
 *
 * `loadingWorkoutPlans` is true only for a first load, with nothing to show
 * yet: a refetch keeps the list on screen.
 */
export function useWorkoutPlansOnFocus() {
  const [refetch, setRefetch] = useState(true);
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) setRefetch((flag) => !flag);
      focusedBefore.current = true;
    }, [])
  );
  const { workoutPlans, loadingWorkoutPlans, failedToLoad } = useWorkoutPlans(refetch);
  return {
    workoutPlans,
    loadingWorkoutPlans: loadingWorkoutPlans && workoutPlans.length === 0,
    failedToLoad,
  };
}
