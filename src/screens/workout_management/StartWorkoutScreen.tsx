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
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOW, SHADOW_3, SPACING } from "../../constants/styles";
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

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.StartWorkout>;

export default function StartWorkoutScreen() {
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
          <MaterialCommunityIcons name="arm-flex-outline" size={24} color={COLORS.textPrimary} style={{ marginRight: 5 }} />
          <TextBase style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary }}>Start Workout</TextBase>
          <MaterialCommunityIcons name="arm-flex-outline" size={24} color={COLORS.textPrimary} style={{ marginLeft: 5, transform: [{ scaleX: -1 }] }} />
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
            style: { backgroundColor: COLORS.cancelButton },
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
      />

      {/* 🏋️ Workout Grid Selection */}
      {loadingWorkoutPlans ? (
        <LoadingData
          containerStyle={styles.loadingConatiner}
          textStyle={{ fontSize: FONT_SIZES.large, color: COLORS.textPrimary }}
          dotStyle={{ fontSize: FONT_SIZES.xLarge, color: COLORS.textPrimary }}
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

      {/* ▶️ Floating Start Workout Button */}
      {selectedWorkout && (
        <TouchableOpacity style={styles.startWorkoutButton} onPress={handleStartWorkout}>
          <TextBase style={styles.startWorkoutText}>Start {selectedWorkout.name}</TextBase>
        </TouchableOpacity>
      )}

      {/* 📜 Exercise List (Shown only when a workout is selected) */}
      {selectedWorkout && (
        <ScrollView style={styles.exerciseList}>
          <TextBase style={styles.exerciseHeader}>Exercises in {selectedWorkout.name}</TextBase>
          {selectedWorkout.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <Ionicons name="barbell-outline" size={20} color={COLORS.primary} />
              <TextBase style={styles.exerciseText}>{exercise.name}</TextBase>
            </View>
          ))}
        </ScrollView>
      )}
    </ScrollableScreen>
  );
}

const styles = StyleSheet.create({
  loadingConatiner: { flex: 1, justifyContent: "center", alignItems: "center" },
  noResultsText: {
    justifyContent: 'center',
    textAlign: "center",
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.cardBackground,
    padding: 20,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    ...SHADOW,
  },
  selectedWorkout: {
    borderColor: COLORS.button,
    borderWidth: 2,
    ...SHADOW_3,
  },
  workoutTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  exerciseList: {
    marginTop: 20,
  },
  exerciseHeader: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.medium,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.small,
  },
  exerciseText: {
    fontSize: FONT_SIZES.medium,
    fontWeight: "bold",
    marginLeft: SPACING.small,
    color: COLORS.textPrimary,
  },
  startWorkoutButton: {
    marginTop: SPACING.large,
    paddingVertical: SPACING.large,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.button,
    alignItems: "center",
  },
  startWorkoutText: {
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
    color: COLORS.textSecondary,
  },
});