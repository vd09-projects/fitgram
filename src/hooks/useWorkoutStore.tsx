// src/hooks/useWorkoutStore.tsx
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WorkoutPlan, Exercise } from "../types/workoutType";
import { ActiveWorkout, ExerciseSet } from "../types/zustandWorkoutType";
import { saveActiveWorkoutLog } from "../services/db/userDB";
import show from "../utils/toastUtils";

// Zustand Store Type
interface WorkoutStoreState {
  activeWorkout: ActiveWorkout | null;

  // Actions
  startWorkout: (workout: WorkoutPlan) => Promise<void>;
  addSetToExercise: (exerciseId: string, newSet: ExerciseSet) => Promise<void>;
  updateSet: (exerciseId: string, setId: number, updatedFields: Record<string, string | number>) => Promise<void>;
  endWorkout: (userId : string | undefined) => Promise<void>;
  cancelWorkout: () => Promise<void>;
  loadWorkoutFromStorage: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  activeWorkout: null,

  /** 🔹 Start a Workout */
  startWorkout: async (workout: WorkoutPlan) => {
    const startTime = Date.now();
    const newWorkout: ActiveWorkout = {
      id: workout.id,
      name: workout.name,
      startTime,
      lastUpdated: startTime,
      exercises: workout.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        fields: ex.fields,
        sets: [], // Empty sets initially
      })),
      isPersisted: false,
      currentExerciseIndex: workout.exercises.length > 0 ? 0 : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(newWorkout));
    set({ activeWorkout: newWorkout });
  },

  /** 🔹 Add a New Set to an Exercise */
  addSetToExercise: async (exerciseId, newSet) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        const newSetId = exercise.sets.length > 0 ? exercise.sets[exercise.sets.length - 1].id + 1 : 1;
        return {
          ...exercise,
          sets: [...exercise.sets, { ...newSet, id: newSetId }],
        };
      }
      return exercise;
    });

    const exerciseIndex = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
      currentExerciseIndex: exerciseIndex !== -1 ? exerciseIndex : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
  },

  /** 🔹 Update an Existing Set */
  updateSet: async (exerciseId, setId, updatedFields) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.id === setId ? { ...set, fields: { ...set.fields, ...updatedFields } } : set
          ),
        };
      }
      return exercise;
    });

    const exerciseIndex = activeWorkout.exercises.findIndex((ex) => ex.id === exerciseId);

    const updatedWorkout: ActiveWorkout = {
      ...activeWorkout,
      exercises: updatedExercises,
      lastUpdated: Date.now(),
      currentExerciseIndex: exerciseIndex !== -1 ? exerciseIndex : null,
    };

    await AsyncStorage.setItem("activeWorkout", JSON.stringify(updatedWorkout));
    set({ activeWorkout: updatedWorkout });
  },

  /** 🔹 End Workout & Persist Data */
  endWorkout: async (userId : string | undefined) => {
    if (!userId) {
      show.alert("User is not logined in.");
      return;
    }

    const { activeWorkout } = get();
    if (!activeWorkout) return;

    try {
      // 🔄 Simulating data persistence (Replace with actual API call)
      const isOnline = true; // Replace with actual connectivity check
      if (isOnline) {
        console.log("Uploading workout to database:", activeWorkout);
        await saveActiveWorkoutLog(userId, activeWorkout); // Replace with actual user ID
        show.info("Workout saved successfully!");
        await AsyncStorage.removeItem("activeWorkout"); // Clear local storage
        set({ activeWorkout: null });
      } else {
        // ❌ No internet - Store offline and mark as not persisted
        await AsyncStorage.setItem("activeWorkout", JSON.stringify({ ...activeWorkout, isPersisted: false }));
        alert("No internet! Workout saved locally. Sync when online.");
      }
    } catch (error) {
      console.error("Failed to persist workout:", error);
    }
  },

  /** 🔹 Cancel Workout (Discard Without Saving) */
  cancelWorkout: async () => {
    try {
      await AsyncStorage.removeItem("activeWorkout"); // Remove stored workout
      set({ activeWorkout: null });
      console.log("Workout cancelled successfully.");
    } catch (error) {
      console.error("Failed to cancel workout:", error);
    }
  },

  /** 🔹 Load Workout from AsyncStorage (For Offline Handling) */
  loadWorkoutFromStorage: async () => {
    const storedWorkout = await AsyncStorage.getItem("activeWorkout");
    if (storedWorkout) {
      set({ activeWorkout: JSON.parse(storedWorkout) });
    }
  },
}));