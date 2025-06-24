import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import useWorkoutPlans from "../../hooks/useWorkoutPlans";
import { WorkoutPlan } from "../../types/workoutType";
import { BORDER_RADIUS, FONT_SIZES, SPACING } from "../../constants/styles";
import ScrollableScreen from "../../components/ScrollableScreen";
import SearchBox from "../../components/SearchBox";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import show from "../../utils/toastUtils";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { useNavigation } from "@react-navigation/native";
import { TextBase } from "../../components/TextBase";
import AlertBase from "../../components/AlertBase";
import LoadingData from "../../components/LoadingData";
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { START_WOURKOUT_STEP_NAMES } from "../../tour_steps/startWorkout";
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.StartWorkout>;

export default function StartWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();

  const [showAlert, setShowAlert] = useState(true);
  const { startWorkout, cancelWorkout, activeWorkout } = useWorkoutStore();

  useEffect(() => {
    setShowAlert(activeWorkout !== null);
  }, []);

  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlans(true);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter workouts based on search query
  let filteredWorkouts = workoutPlans.filter((workout) =>
    workout.name.trim().toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  if (selectedWorkout && filteredWorkouts.some(workout => workout.id === selectedWorkout.id)) {
    filteredWorkouts = [
      selectedWorkout,
      ...filteredWorkouts.filter((workout) => workout.id !== selectedWorkout.id),
    ];
  }

  const toggleWorkoutSelection = (workout: WorkoutPlan) => {
    setSelectedWorkout((prevSelected) =>
      prevSelected?.id === workout.id ? null : workout
    );
  };

  const handleStartWorkout = () => {
    if (selectedWorkout) {
      if (activeWorkout) {
        show.alert("Workout In Progress", "Please complete or discard your current workout before starting a new one.");
        return;
      }
      startWorkout(selectedWorkout);
      show.info("Starting workout", `${selectedWorkout.name}`);
      navigation.navigate(WorkoutRoutes.LogWorkout)
    }
  };

  return (
    <ScrollableScreen
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="arm-flex-outline" size={24} color={t.colors.textPrimary} style={{ marginRight: 5 }} />
          <TextBase style={{ fontSize: 22, fontWeight: 'bold', color: t.colors.textPrimary }}>Start Workout</TextBase>
          <MaterialCommunityIcons name="arm-flex-outline" size={24} color={t.colors.textPrimary} style={{ marginLeft: 5, transform: [{ scaleX: -1 }] }} />
        </View>
      }
    >
      <AlertBase
        visible={showAlert}
        title="Workout In Progress"
        message="Please complete or discard your current workout before starting a new one."
        buttons={[
          {
            text: 'Cancel Workout',
            onPress: () => {
              setShowAlert(false);
              cancelWorkout();
            },
            style: { backgroundColor: t.colors.cancelButton },
          },
          {
            text: 'Go to Active Workout',
            onPress: () => {
              setShowAlert(false)
              navigation.navigate(WorkoutRoutes.LogWorkout);
            },
          }
        ]}
      />

      {/* 🔍 Search Box Component */}
      <SearchBox
        value={searchQuery}
        onChangeText={setSearchQuery}
        label="Search Workout"
        placeholder="Workout name"
        tourStepPrefix={START_WOURKOUT_STEP_NAMES.SEARCH_BOX}
      />

      {/* 🏋️ Workout Grid Selection */}
      <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.SEARCHED_WORKOUT_ITEMS}>
        {loadingWorkoutPlans ? (
          <LoadingData
            containerStyle={styles.loadingConatiner}
            textStyle={{ fontSize: FONT_SIZES.large, color: t.colors.textPrimary }}
            dotStyle={{ fontSize: FONT_SIZES.xLarge, color: t.colors.textPrimary }}
          />
        ) :
          <FlatList
            data={filteredWorkouts}
            key={selectedWorkout ? "horizontal" : "grid"}
            keyExtractor={(item) => item.id}
            horizontal={!!selectedWorkout}
            scrollEnabled={!!selectedWorkout}
            showsHorizontalScrollIndicator={!!selectedWorkout}
            numColumns={selectedWorkout ? undefined : 2}
            columnWrapperStyle={!selectedWorkout ? styles.gridRow : undefined}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.workoutCard,
                  selectedWorkout?.id === item.id && styles.selectedWorkout,
                  selectedWorkout && { marginVertical: SPACING.small }
                ]}
                onPress={() => toggleWorkoutSelection(item)}
              >
                <TextBase style={styles.workoutTitle}>{item.name}</TextBase>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <TextBase style={styles.noResultsText}>No workouts found</TextBase>
            }
          />
        }
      </MaybeTourStep>

      {/* ▶️ Floating Start Workout Button */}
      {selectedWorkout && (
        <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.START_SELECTED_WORKOUT_BUTTON} positionType='above'>
          <TouchableOpacity style={styles.startWorkoutButton} onPress={handleStartWorkout}>
            <TextBase style={styles.startWorkoutText}>Start {selectedWorkout.name}</TextBase>
          </TouchableOpacity>
        </MaybeTourStep>
      )}

      {/* 📜 Exercise List (Shown only when a workout is selected) */}
      {selectedWorkout && (
        <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE_LIST} positionType='above'>
          <ScrollView style={styles.exerciseList}>
            <TextBase style={styles.exerciseHeader}>Exercises in {selectedWorkout.name}</TextBase>
            {selectedWorkout.exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Ionicons name="barbell-outline" size={20} color={t.colors.primary} />
                <TextBase style={styles.exerciseText}>{exercise.name}</TextBase>
              </View>
            ))}
          </ScrollView>
        </MaybeTourStep>
      )}
    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  loadingConatiner: { flex: 1, justifyContent: "center", alignItems: "center" },
  noResultsText: {
    justifyContent: 'center',
    textAlign: "center",
    fontSize: FONT_SIZES.large,
    color: t.colors.textPrimary,
    marginVertical: SPACING.small,
    fontWeight: "bold",
    paddingLeft: SPACING.small,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  workoutCard: {
    flex: 1,
    backgroundColor: t.colors.cardBackground,
    padding: 20,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    ...t.shadows.shadowSmall,
  },
  selectedWorkout: {
    borderColor: t.colors.border,
    borderWidth: SPACING.xSmall,
    ...t.shadows.shadowMedium,
  },
  workoutTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: t.colors.textSecondary,
    textAlign: "center",
  },
  exerciseList: {
    marginTop: 20,
  },
  exerciseHeader: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: t.colors.textPrimary,
    marginBottom: 10,
  },
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.medium,
    backgroundColor: t.colors.secondary,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.small,
  },
  exerciseText: {
    fontSize: FONT_SIZES.medium,
    fontWeight: "bold",
    marginLeft: SPACING.small,
    color: t.colors.textPrimary,
  },
  startWorkoutButton: {
    marginTop: SPACING.large,
    paddingVertical: SPACING.large,
    borderRadius: BORDER_RADIUS,
    backgroundColor: t.colors.button,
    alignItems: "center",
  },
  startWorkoutText: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: t.colors.textSecondary,
  },
});