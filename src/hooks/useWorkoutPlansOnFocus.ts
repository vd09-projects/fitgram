// src/hooks/useWorkoutPlansOnFocus.ts

import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthUser } from "./useAuthUser";
import { usePlansStore } from "../stores/usePlansStore";
import useWorkoutPlans from "./useWorkoutPlans";

/**
 * `useWorkoutPlans`, checked each time the screen comes into view, not only on
 * mount. The Workout stack keeps its screens mounted underneath (WorkoutNavigator
 * `singleCopy`), so for the hub, All plans, Manage and History "the screen
 * opens" is a focus (TICKET-070 D4). The check is skipped if one succeeded in
 * the last 2 minutes, so hub → Start → Manage costs one read.
 *
 * Coming back from the background is not a focus, and the hub is often left
 * open for hours, so while the screen is focused a return to the foreground
 * checks too (D4: a phone left open in the background must not show a
 * laptop's edit late; PR #48 review). Rejected: the hub's own AppState
 * listener, which would cover the hub only.
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
      if (!uid) return;
      usePlansStore.getState().open(uid);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") usePlansStore.getState().open(uid);
      });
      return () => subscription.remove();
    }, [uid])
  );
  return useWorkoutPlans({ check: "none" });
}
