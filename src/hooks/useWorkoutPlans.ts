import { useState, useEffect } from "react";
import { getAllWorkoutPlans } from "../services/db/userDB";
import { WorkoutPlan } from "../types/workoutType";
import { useAuthUser } from "../hooks/useAuthUser";

export default function useWorkoutPlans(param: boolean) {
  const { user } = useAuthUser();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [loadingWorkoutPlans, setLoadingWorkoutPlans] = useState<boolean>(true);
  // A failed load also leaves `workoutPlans` empty; this tells it apart from
  // "no plans yet", so Manage never offers a first plan to someone who has
  // plans but is offline (TICKET-052 D5). No alert: `getAllWorkoutPlans`
  // returned [] on failure until now, so the one here never fired, and adding it
  // would change Start, whose false "No plans yet" is a known gap, not fixed here.
  const [failedToLoad, setFailedToLoad] = useState<boolean>(false);

  useEffect(() => {
    const fetchWorkouts = async () => {
      if (!user) return;
      setLoadingWorkoutPlans(true);
      try {
        const workouts = await getAllWorkoutPlans(user.uid);
        setWorkoutPlans(workouts);
        setFailedToLoad(false);
      } catch (error) {
        console.error("Error fetching workouts:", error);
        setFailedToLoad(true);
      } finally {
        setLoadingWorkoutPlans(false);
      }
    };

    fetchWorkouts();
  }, [user, param]);

  return { workoutPlans, loadingWorkoutPlans, failedToLoad };
}
