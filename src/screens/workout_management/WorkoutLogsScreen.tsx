import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import ScrollableScreen from "../../components/ScrollableScreen";
import SearchableInputDropdown, { DropdownSelection } from "../../components/SearchableInputDropdown";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../../constants/styles";
import useWorkoutPlans from "../../hooks/useWorkoutPlans";
import { Exercise, WorkoutPlan } from "../../types/workoutType";
import { getWorkoutLogs } from "../../services/db/userDB";
import { useAuthUser } from "../../hooks/useAuthUser";
import show from "../../utils/toastUtils";
import { WorkoutLog } from "../../types/workoutLogs";
import ExerciseLogTableFlatList from "../../components/ExerciseLogTableFlatList";
import ExerciseSetLogTable from "../../components/ExerciseSetLogTable";

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

      const setNumberAllLabel = "All";
      const convertedSetNumber = useMemo(() => {
            const result = [{
                  label: setNumberAllLabel,
                  value: setNumberAllLabel,
                  isCustom: false,
            }];
            if (!workoutLogs || !selectedExercises) return result;

            const seen = new Set();
            for (const log of workoutLogs) {
                  const selectedExerciseLog = log.exercises.find(
                        (exercise) => exercise.exerciseId === selectedExercises.value?.id
                  );

                  if (!selectedExerciseLog) continue;

                  for (const set of selectedExerciseLog.sets) {
                        const setValue = set.fields["Sets"];
                        if (!seen.has(setValue)) {
                              seen.add(setValue);
                              result.push({
                                    label: setValue,
                                    value: setValue,
                                    isCustom: false,
                              });
                        }
                  }
            }
            return result;
      }, [workoutLogs, selectedExercises]);
      const [selectedSetNumber, setSelectedSetNumber] = useState<DropdownSelection<string> | undefined>(convertedSetNumber[0]);

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
                        {workoutLogs && workoutLogs.length > 0 &&
                              <SearchableInputDropdown<string>
                                    placeholder="Sets"
                                    data={convertedSetNumber ?? []}
                                    value={selectedSetNumber}
                                    onChange={setSelectedSetNumber}
                                    title="Sets"
                                    allowCustomInput={false}
                              />
                        }
                  </View>

                  {/* 🔘 Show Data Button */}
                  <TouchableOpacity style={styles.toggleButton} onPress={fetchLogs}>
                        <Text style={styles.toggleText}>
                              {loadingLogs ? "Loading..." : "Show Data"}
                        </Text>
                  </TouchableOpacity>

                  {/* 🔽 Workout Logs */}
                  {workoutLogs && selectedExercises &&
                        <View>
                              {workoutLogs.length === 0 && (
                                    <Text style={styles.noLogsTitle}>
                                          No logs found for <Text style={{ fontWeight: "bold" }}>{selectedExercises.label}</Text>
                                    </Text>
                              )}
                              {selectedSetNumber?.value !== setNumberAllLabel &&
                                    <ExerciseSetLogTable
                                          workoutLog={workoutLogs}
                                          selectedSetNumber={selectedSetNumber?.value}
                                          selectedExercise={selectedExercises.value}
                                    />
                              }
                              {selectedSetNumber?.value === setNumberAllLabel &&
                                    workoutLogs.map((log, logIndex) => {
                                          const selectedExerciseLog = log.exercises.find(
                                                (exercise) => exercise.exerciseId === selectedExercises.value?.id
                                          );

                                          if (!selectedExerciseLog) return null;

                                          return (
                                                <ExerciseLogTableFlatList
                                                      key={logIndex}
                                                      log={selectedExerciseLog}
                                                      enableVerticalScroll={false} // Change to true if logs are long
                                                />
                                          );
                                    })}
                        </View>
                  }

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
            flexGrow: 1,
      },
      toggleText: {
            fontSize: FONT_SIZES.medium,
            color: COLORS.textSecondary,
      },
      noLogsTitle: {
            fontSize: FONT_SIZES.large,
            color: COLORS.textPrimary,
            textAlign: "center",
            marginTop: SPACING.medium,
      },
      logCard: {
            // backgroundColor: COLORS.tertiary,
            // padding: SPACING.medium,
            borderRadius: 10,
            // marginBottom: SPACING.medium,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
      },
      logTitle: {
            fontSize: FONT_SIZES.large,
            fontWeight: "bold",
            color: COLORS.textSecondary,
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