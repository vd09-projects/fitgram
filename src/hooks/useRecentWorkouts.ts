// src/hooks/useRecentWorkouts.ts

import { useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRecentWorkoutsStore } from "../stores/useRecentWorkoutsStore";
import { lookUpPlanIds, plansToLookUp, sessionsWithLastOfEachPlan } from "../utils/workoutWindow";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import type { WorkoutPlan } from "../types/workoutType";

const NO_PLANS: ReadonlySet<string> = new Set();

/**
 * The workouts for `buildPlanRows` and `buildRecentHistory`: the window's and the floor's
 * (the newest of every plan, however old), newest first, from the shared workouts store
 * (TICKET-075, TICKET-082). Replaces `useRecentSessions`, which read the newest 20 on every
 * focus of each screen.
 *
 * `null` while nothing is held for `uid` (nothing stored and no answer yet): readers then say
 * "last session unknown", never "not done". A failed check keeps what is held. Which plans have
 * no date yet is `useLastDoneUnknown`.
 *
 * Checked on focus, and on a return to the foreground while focused, as
 * `useWorkoutPlansOnFocus` (TICKET-070 D4), with the same check skip: one
 * hub → Start → Manage visit costs one check. A workout uploaded while the
 * screen is open needs no read: the upload puts it in the store
 * (`applyFinished`), and the screen re-renders.
 */
export function useRecentWorkouts(uid: string | undefined): WorkoutSessionDoc[] | null {
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));

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

  return useMemo(() => (workoutWindow === null ? null : sessionsWithLastOfEachPlan(workoutWindow)), [workoutWindow]);
}

/**
 * The plans whose last workout is not known yet: not looked up (a first launch before the plans
 * arrived, a plan whose newest workout was deleted). `buildPlanRows` gives them no date and
 * `lastDoneKnown: false`, so a screen says "last session unknown" and not "never done"
 * (CLAUDE.md 2.4). Empty once every plan is looked up.
 */
export function useLastDoneUnknown(uid: string | undefined, plans: readonly WorkoutPlan[]): ReadonlySet<string> {
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  return useMemo(() => {
    if (workoutWindow === null) return NO_PLANS;
    const unknown = plansToLookUp(workoutWindow, lookUpPlanIds(plans) ?? []);
    return unknown.length === 0 ? NO_PLANS : new Set(unknown);
  }, [workoutWindow, plans]);
}
