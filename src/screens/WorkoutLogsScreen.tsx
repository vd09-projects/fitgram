import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import ScrollableScreen from "../components/ScrollableScreen";
import SearchableInputDropdown, { DropdownSelection } from "../components/SearchableInputDropdown";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import { Exercise, WorkoutPlan } from "../types/workoutType";
import { getWorkoutLogs } from "../services/db/userDB";
import { useAuthUser } from "../hooks/useAuthUser";
import show from "../utils/toastUtils";
import { WorkoutLog } from "../types/workoutLogs";

export default function WorkoutLogsScreen() {
      const { user } = useAuthUser();
      const workoutPlans = useWorkoutPlans(true);

      const convertedWorkoutPlans = useMemo(() =>
            workoutPlans.map((plan) => ({
                  label: plan.name,
                  value: plan,
                  isCustom: false,
            })),
            [workoutPlans]
      );
      const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection<WorkoutPlan> | undefined>(convertedWorkoutPlans[0]);

      const convertedExercises = useMemo(() => {
            return selectedWorkout?.value?.exercises.map((exercise) => ({
                  label: exercise.name,
                  value: exercise,
                  isCustom: false,
            })) || [];
      }, [selectedWorkout]);
      const [selectedExercises, setSelectedExercises] = useState<DropdownSelection<Exercise> | undefined>(convertedExercises ? convertedExercises[0] : undefined);

      const [loadingLogs, setLoadingLogs] = useState(false);
      const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[] | null>(null);

      useEffect(() => {
            if (convertedWorkoutPlans.length > 0 && !selectedWorkout) {
                  setSelectedWorkout(convertedWorkoutPlans[0]);
            }
      });
      useEffect(() => {
            if (convertedExercises && convertedExercises.length > 0) {
                  setSelectedExercises(convertedExercises[0]);
            }
      }, [selectedWorkout]);

      const fetchLogs = async () => {
            if (!selectedWorkout?.value || !selectedExercises?.value) {
                  show.warn("Please select a workout and an exercise");
                  return;
            }
            if (!user) {
                  show.alert("User is not Logined in");
                  return;
            }

            setLoadingLogs(true);
            try {
                  const logs = await getWorkoutLogs(
                        user?.uid,
                        selectedWorkout.value.id,
                        {
                              exerciseId: selectedExercises.value.id,
                              page: 1,
                              limit: 10,
                        }
                  );
                  console.log("Fetched logs:", logs);
                  setWorkoutLogs(logs);
            } catch (error) {
                  setWorkoutLogs(null);
                  console.error("Error fetching logs:", error);
                  show.alert("Error fetching logs", "Please try again.");
            } finally {
                  setLoadingLogs(false);
            }
      };


      return (
            <ScrollableScreen title={<Text style={styles.title}>Workout Logs</Text>}>

                  {/* 🔽 Filters */}
                  <View style={styles.filtersContainer}>
                        <SearchableInputDropdown<WorkoutPlan>
                              placeholder="Select Workout"
                              data={convertedWorkoutPlans}
                              value={selectedWorkout}
                              onChange={setSelectedWorkout}
                              title="Workout Plan"
                              allowCustomInput={false}
                        />

                        {/* Multi-select Exercise Dropdown (to be implemented later) */}
                        <SearchableInputDropdown<Exercise>
                              placeholder="Select Exercises"
                              data={convertedExercises ?? []}
                              value={selectedExercises}
                              onChange={setSelectedExercises}
                              title="Exercises"
                              allowCustomInput={false}
                        />

                  </View>

                  {/* 🔘 Show Data Button */}
                  <TouchableOpacity style={styles.toggleButton} onPress={fetchLogs}>
                        <Text style={styles.toggleText}>
                              {loadingLogs ? "Loading..." : "Show Data"}
                        </Text>
                  </TouchableOpacity>

                  {/* 🔽 Workout Logs */}
                  {workoutLogs && workoutLogs.map((log, index) => (
                        <View key={index} style={styles.logCard}>
                              <Text style={styles.logTitle}>{log.workoutId}</Text>
                              {
                                    log.exercises.map((exercise) => (
                                          <View key={exercise.exerciseId}>
                                                <Text style={styles.logTitle}>{exercise.exerciseName}</Text>
                                                {exercise.sets.map((set, setIndex) => (
                                                      <Text key={setIndex} style={styles.logSubtitle}>
                                                            Set {setIndex + 1}: {JSON.stringify(set)}
                                                      </Text>
                                                ))}
                                          </View>
                                    ))
                              }
                        </View>
                  ))}


            </ScrollableScreen>
      );
}

const styles = StyleSheet.create({
      title: {
            fontSize: FONT_SIZES.xLarge,
            fontWeight: "bold",
            color: COLORS.textPrimary,
            textAlign: "center",
            marginBottom: SPACING.medium,
      },
      filtersContainer: {
            marginBottom: SPACING.medium,
      },
      toggleButton: {
            backgroundColor: COLORS.button,
            padding: SPACING.medium,
            borderRadius: BORDER_RADIUS,
            alignItems: "center",
            marginVertical: SPACING.medium,
      },
      toggleText: {
            fontSize: FONT_SIZES.medium,
            color: COLORS.textSecondary,
      },
      logCard: {
            backgroundColor: COLORS.tertiary,
            padding: SPACING.medium,
            borderRadius: 10,
            marginBottom: SPACING.medium,
      },
      logTitle: {
            fontSize: FONT_SIZES.large,
            fontWeight: "bold",
            color: COLORS.textPrimary,
      },
      logSubtitle: {
            fontSize: FONT_SIZES.small,
            color: COLORS.textSecondary,
            marginTop: 4,
      },
      pagination: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: SPACING.medium,
      },
      pageButton: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: COLORS.button,
            borderRadius: 6,
      },
      disabledButton: {
            opacity: 0.5,
      },
      pageButtonText: {
            color: COLORS.primary,
            fontWeight: "bold",
      },
      pageText: {
            color: COLORS.textPrimary,
            fontSize: FONT_SIZES.medium,
      },
});