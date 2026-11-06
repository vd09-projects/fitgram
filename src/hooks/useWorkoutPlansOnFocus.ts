// src/hooks/useWorkoutPlansOnFocus.ts

import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthUser } from "./useAuthUser";
import { usePlansStore } from "../stores/usePlansStore";
import useWorkoutPlans from "./useWorkoutPlans";

/**
 * `useWorkoutPlans`, checked each time the screen comes into view, not only on
 * mount. The Workout stack keeps its screens mounted underneath (WorkoutNavigator
 * `singleCopy`), so for the hub and All plans "the screen opens" is a focus
 * (TICKET-070 D4). The check is skipped if one succeeded in the last 2
 * minutes, so hub → Start → Manage costs one read.
 *
 * Until TICKET-070 this re-read every plan on every focus, so a plan edited in
 * Manage showed here (device, 2026-11-03). Manage's Save now updates the store
 * itself (D8), so that needs no read: the screen re-renders from the store.
 * The focus check stays because D4 asks for one on each open, not to see Save.
 *
 * Rejected: a focus check inside `useWorkoutPlans`, which components outside a
 * navigator also use (the picker, and screens in their tests).
 */
export function useWorkoutPlansOnFocus() {
  const { user } = useAuthUser();
  const uid = user?.uid;
  useFocusEffect(
    useCallback(() => {
      if (uid) usePlansStore.getState().open(uid);
    }, [uid])
  );
  return useWorkoutPlans({ check: "none" });
}
