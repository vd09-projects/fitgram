import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, Directions } from "react-native-gesture-handler";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import ExerciseLogger from "../../components/ExerciseLogger";
import ScrollableScreen from "../../components/ScrollableScreen";
import { DiscardWorkoutDialog } from "../../components/active_workout/DiscardWorkoutDialog";
import WorkoutHeader from "../../components/active_workout/WorkoutHeader";
import ExerciseNavHeader from "../../components/active_workout/ExerciseNavHeader";
import WorkoutProgressBar from "../../components/active_workout/WorkoutProgressBar";
import { SPACING } from "../../constants/styles";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useExerciseHistory } from "../../hooks/useExerciseHistory";
import { useExerciseNames } from "../../hooks/useExerciseNames";
import show from "../../utils/toastUtils";
import { buildProgressSegments, resolveCurrentIndex } from "../../utils/workoutProgress";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { LayoutScreenNavigationProp } from "../../navigation/LayoutNavigator";
import { LayoutRoutes, WorkoutRoutes } from "../../constants/routes";
import { useNavigation } from "@react-navigation/native";
import { TextBase } from "../../components/TextBase";
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../../tour_steps/activeWorkout";
import SwapExercisePicker from "../../components/active_workout/SwapExercisePicker";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.LogWorkout>;
type layoutScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.LogWorkout>;

const HIT = 44;

export default function ActiveWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();
  const layoutNavigation = useNavigation<layoutScreenNavigationProp>();

  const { user } = useAuthUser();
  const { activeWorkout, endWorkout, cancelWorkout, setCurrentExerciseIndex } = useWorkoutStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  /** The slot the swap picker is open for (TICKET-047), by id; null when closed. */
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // The store's index is the only record of which exercise is in view; there is
  // no local copy to drift from it.
  const exercises = activeWorkout?.exercises ?? [];
  const currentIndex = resolveCurrentIndex(activeWorkout?.currentExerciseIndex ?? null, exercises.length);
  const currentExercise = currentIndex === null ? null : exercises[currentIndex];
  // Built from the catalog, never `exercise.name` (TICKET-042).
  const names = useExerciseNames(exercises);
  const swapping = swappingId === null ? null : exercises.find((e) => e.id === swappingId) ?? null;

  // Cache-only read: this hook issues no network request (see its doc). Last
  // session's set count is the denominator for the current progress segment;
  // without it the bar assumes DEFAULT_TARGET_SETS.
  const history = useExerciseHistory(currentExercise?.id);
  const lastSessionSetCount = history.lastSession?.sets.length ?? null;

  const goTo = (index: number) => {
    setCurrentExerciseIndex(index);
  };
  const goPrevious = () => currentIndex !== null && goTo(currentIndex - 1);
  const goNext = () => currentIndex !== null && goTo(currentIndex + 1);

  // Swipe is a discrete fling, not a tracked pan: it needs no animation library
  // and does not compete with the vertical ScrollView or with text inputs, since
  // neither recognises a horizontal fling. Content swaps rather than slides.
  // Finger right-to-left (LEFT) is "next", matching a book.
  // `onEnd` also fires, with success false, when a fling that activated is then
  // cancelled (e.g. the ScrollView takes the touch), so only page on success.
  const swipe = Gesture.Exclusive(
    Gesture.Fling().direction(Directions.LEFT).runOnJS(true)
      .onEnd((_event, success) => { if (success) goNext(); }),
    Gesture.Fling().direction(Directions.RIGHT).runOnJS(true)
      .onEnd((_event, success) => { if (success) goPrevious(); }),
  );

  // This screen is registered in two stacks: Workout (reached from the workout
  // home or Start Workout) and Layout (the Log Workout footer tab, which resets
  // the Layout stack so nothing sits behind it). A Workout-stack route name is
  // unknown to the Layout stack, so anything that leaves this screen goes via
  // the Layout `Workout` route with a nested target. Called from the Workout
  // stack, that action bubbles up to the Layout stack and resolves the same way.
  const openWorkoutScreen = (screen: typeof WorkoutRoutes.WorkoutHome | typeof WorkoutRoutes.StartWorkout) =>
    layoutNavigation.navigate(LayoutRoutes.Workout, { screen });

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else openWorkoutScreen(WorkoutRoutes.WorkoutHome);
  };

  const handleFinish = async () => {
    if (!activeWorkout) {
      show.alert("No active workout to save.");
      return;
    }
    // `finishing` only drives the busy look. A second save is prevented in the
    // store (`endWorkout` takes the workout out of the active slot before its
    // first await, and uploads join an in-flight one), which also covers two
    // taps inside one frame — a check on `finishing` here could not, since it
    // reads the value from the last render.
    setFinishing(true);
    try {
      await endWorkout(user?.uid);
    } finally {
      setFinishing(false);
    }
  };

  const handleDiscard = async () => {
    setConfirmDiscard(false);
    await cancelWorkout();
  };

  if (!activeWorkout) {
    return (
      <View style={styles.noWorkoutContainer}>
        <TextBase style={styles.noWorkoutText}>No active workout</TextBase>
        <TouchableOpacity
          style={styles.noWorkoutLink}
          onPress={() => openWorkoutScreen(WorkoutRoutes.StartWorkout)}>
          <TextBase style={styles.switchText}>click to select a new one</TextBase>
        </TouchableOpacity>
      </View>
    );
  }

  const segments = buildProgressSegments(exercises, currentIndex, lastSessionSetCount);

  return (
    <View style={styles.screen}>
      <WorkoutHeader
        workoutName={activeWorkout.name}
        startTime={activeWorkout.startTime}
        onBack={handleBack}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <GestureDetector gesture={swipe}>
        <View style={styles.pager} collapsable={false}>
          {currentExercise && currentIndex !== null ? (
            <>
              <View style={styles.exerciseSection}>
                <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE}>
                  <ExerciseNavHeader
                    exerciseName={names[currentIndex].title}
                    exerciseSubtitle={names[currentIndex].subtitle}
                    index={currentIndex}
                    count={exercises.length}
                    previousName={names[currentIndex - 1]?.title ?? null}
                    nextName={names[currentIndex + 1]?.title ?? null}
                    onPrevious={goPrevious}
                    onNext={goNext}
                    onOpenMenu={() => setExerciseMenuOpen(true)}
                  />
                </MaybeTourStep>
                <View style={styles.progress}>
                  <WorkoutProgressBar segments={segments} />
                </View>
              </View>

              <ScrollableScreen
                style={styles.scroll}
                innerContainerStyle={styles.scrollInner}
              >
                {/* Keyed so typed-but-unlogged values stay with their exercise
                    instead of following the user to the next one, where they
                    would be logged against the wrong exercise. */}
                <ExerciseLogger
                  key={currentExercise.id}
                  exercise={currentExercise}
                  menuOpen={exerciseMenuOpen}
                  onCloseMenu={() => setExerciseMenuOpen(false)}
                  onSwap={() => setSwappingId(currentExercise.id)}
                />
              </ScrollableScreen>
            </>
          ) : (
            <View style={styles.emptyPlan}>
              <TextBase style={styles.noWorkoutText}>This workout has no exercises</TextBase>
            </View>
          )}
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <MaybeTourStep stepId={ACTIVE_WORKOUT_STEP_NAMES.SAVE_CURRENT_WORKOUT_LOGER} positionType="above">
          {/* Plain View: MultiTourSteps splits its child's style, which left the
              touchable shrink-wrapped to its label so off-centre taps missed. */}
          <View>
            {/* Outlined on purpose: the screen's one accent fill belongs to Log set. */}
            <TouchableOpacity
              style={[styles.finishButton, finishing && styles.finishButtonBusy]}
              onPress={handleFinish}
              disabled={finishing}
              accessibilityRole="button"
              accessibilityState={{ disabled: finishing, busy: finishing }}
            >
              <TextBase style={styles.finishText}>{finishing ? "Saving…" : "Finish workout"}</TextBase>
            </TouchableOpacity>
          </View>
        </MaybeTourStep>
      </View>

      {/* ··· menu. One item today; Discard lives here, away from Finish, so a
          stray tap in the footer can never lose the session. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setConfirmDiscard(true);
              }}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={18} color={t.colors.role.danger} />
              <TextBase style={styles.menuItemDanger}>Discard workout</TextBase>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Over the whole screen, footer included, as on Manage Workout. Closed
          if its slot is gone (Finish or Discard while it was open). */}
      {swapping && (
        <SwapExercisePicker exercises={exercises} replacing={swapping} onClose={() => setSwappingId(null)} />
      )}

      <DiscardWorkoutDialog
        visible={confirmDiscard}
        keepLabel="Keep logging"
        onKeep={() => setConfirmDiscard(false)}
        onDiscard={handleDiscard}
      />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.colors.role.ground,
  },
  pager: {
    flex: 1,
  },
  exerciseSection: {
    paddingTop: SPACING.medium,
    paddingHorizontal: SPACING.xMedium,
  },
  progress: {
    marginTop: SPACING.xMedium,
  },
  scroll: {
    backgroundColor: t.colors.role.ground,
  },
  scrollInner: {
    backgroundColor: t.colors.role.ground,
    paddingHorizontal: SPACING.xMedium,
  },
  emptyPlan: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: SPACING.medium,
    paddingHorizontal: SPACING.xMedium,
    paddingBottom: SPACING.xxLarge,
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
  },
  finishButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonBusy: {
    opacity: 0.6,
  },
  finishText: {
    fontSize: t.fonts.medium,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  menuOverlay: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 64,
    paddingHorizontal: SPACING.medium,
  },
  menuCard: {
    minWidth: 200,
    borderRadius: 14,
    paddingVertical: SPACING.xSmall,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  menuItem: {
    minHeight: HIT,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
    paddingHorizontal: SPACING.large,
  },
  menuItemDanger: {
    fontSize: t.fonts.xMedium,
    fontWeight: "bold",
    color: t.colors.role.danger,
  },
  noWorkoutContainer: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 90,
    backgroundColor: t.colors.role.ground,
  },
  noWorkoutText: {
    fontSize: t.fonts.large,
    color: t.colors.role.textPrimary,
    textAlign: "center",
    fontWeight: "bold",
  },
  noWorkoutLink: {
    minHeight: HIT,
    justifyContent: "center",
  },
  switchText: {
    fontSize: t.fonts.medium,
    color: t.colors.role.textSecondary,
    textAlign: 'center',
    fontWeight: "bold",
    textDecorationLine: 'underline',
    paddingVertical: SPACING.small,
  },
});
