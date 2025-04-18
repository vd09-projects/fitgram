import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { getAllWorkoutPlans } from "../services/db/userDB";
import { WorkoutPlan } from "../types/workoutType";
import { useAuthUser } from "../hooks/useAuthUser";

export default function useWorkoutPlans(param: boolean) {
  const { user } = useAuthUser();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);

  useEffect(() => {
    const fetchWorkouts = async () => {
      if (!user) return;
      try {
        const workouts = await getAllWorkoutPlans(user.uid);
        setWorkoutPlans(workouts);
      } catch (error) {
        console.error("Error fetching workouts:", error);
        Alert.alert("Error", "Could not fetch workouts.");
      }
    };

    fetchWorkouts();
  }, [user, param]);

  return workoutPlans;
}
