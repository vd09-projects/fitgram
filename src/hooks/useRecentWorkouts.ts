// src/hooks/useRecentWorkouts.ts

import { useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRecentWorkoutsStore } from "../stores/useRecentWorkoutsStore";
import { heldSessions } from "../utils/workoutsSync";
import type { WorkoutSessionDoc } from "../types/workoutSession";

/**
 * The recent workouts for `buildPlanRows` and `buildRecentHistory`: every held
 * session, newest first, from the shared workouts store (TICKET-075). Replaces
 * `useRecentSessions`, which read the newest 20 on every focus of each screen.
 *
 * `null` while nothing is held for `uid` (nothing stored and no answer yet, or
 * the plans store holds nothing): readers then say "last session unknown",
 * never "not done". A failed check keeps what is held.
 *
 * Checked on focus, and on a return to the foreground while focused, as
 * `useWorkoutPlansOnFocus` (TICKET-070 D4), with the same 2-minute skip: one
 * hub → Start → Manage visit costs one check. A workout uploaded while the
 * screen is open needs no read: the upload puts it in the store
 * (`applyFinished`), and the screen re-renders.
 */
export function useRecentWorkouts(uid: string | undefined): WorkoutSessionDoc[] | null {
  const byPlan = useRecentWorkoutsStore((s) => (s.uid === uid ? s.byPlan : null));

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      useRecentWorkoutsStore.getState().open(uid);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") useRecentWorkoutsStore.getState().open(uid);
      });
      return () => subscription.remove();
    }, [uid])
  );

  return useMemo(() => (byPlan === null ? null : heldSessions(byPlan)), [byPlan]);
}
