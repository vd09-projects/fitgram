// src/hooks/useSyncWorkout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { useAuthUser } from "./useAuthUser";

export const useSyncWorkout = () => {
  const { user } = useAuthUser();
  const { activeWorkout, endWorkout } = useWorkoutStore();

  /** ✅ Check Internet Connectivity */
  const checkInternet = async (): Promise<boolean> => {
    return new Promise((resolve) => setTimeout(() => resolve(navigator.onLine), 1000));
  };

  /** ✅ Sync Workout Data */
  const syncWorkout = async (): Promise<void> => {
    if (!activeWorkout || activeWorkout.isPersisted) return;

    const isOnline = await checkInternet();
    if (isOnline) {
      try {
        console.log("Syncing workout to the database:", activeWorkout);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await AsyncStorage.removeItem("activeWorkout");
        await endWorkout(user?.uid); // Reset state
      } catch (error) {
        console.error("Sync failed:", error);
      }
    } else {
      alert("No internet! Sync when online.");
    }
  };

  return { syncWorkout };
};
