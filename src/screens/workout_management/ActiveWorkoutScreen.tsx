import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, Directions } from "react-native-gesture-handler";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import ExerciseLogger from "../../components/ExerciseLogger";
import ScrollableScreen from "../../components/ScrollableScreen";
import AlertBase from "../../components/AlertBase";
import WorkoutHeader from "../../components/active_workout/WorkoutHeader";
import ExerciseNavHeader from "../../components/active_workout/ExerciseNavHeader";
import WorkoutProgressBar from "../../components/active_workout/WorkoutProgressBar";
import { SPACING } from "../../constants/styles";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useExerciseHistory } from "../../hooks/useExerciseHistory";
import show from "../../utils/toastUtils";
import { buildProgressSegments, resolveCurrentIndex } from "../../utils/workoutProgress";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { WorkoutRoutes } from "../../constants/routes";
import { useNavigation } from "@react-navigation/native";
import { TextBase } from "../../components/TextBase";
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../../tour_steps/activeWorkout";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.LogWorkout>;

const HIT = 44;

export default function ActiveWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();

  const { user } = useAuthUser();
  const { activeWorkout, endWorkout, cancelWorkout, setCurrentExerciseIndex } = useWorkoutStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // The store's index is the only record of which exercise is in view; there is
  // no local copy to drift from it.
  const exercises = activeWorkout?.exercises ?? [];
  const currentIndex = resolveCurrentIndex(activeWorkout?.currentExerciseIndex ?? null, exercises.length);
  const currentExercise = currentIndex === null ? null : exercises[currentIndex];

  // Cache-only read: this hook issues no network request (see its doc). Last
  // session's set count is the denominator for the current progress segment.
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
  const swipe = Gesture.Exclusive(
    Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(goNext),
    Gesture.Fling().direction(Directions.RIGHT).runOnJS(true).onEnd(goPrevious),
  );

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(WorkoutRoutes.WorkoutHome);
  };

  const handleFinish = async () => {
    if (!activeWorkout) {
      show.alert("No active workout to save.");
      return;
    }
    // A second tap while the save is in flight would write the session twice.
    if (finishing) return;
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
          onPress={() => navigation.navigate(WorkoutRoutes.StartWorkout)}>
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
                    exerciseName={currentExercise.name}
                    index={currentIndex}
                    count={exercises.length}
                    previousName={exercises[currentIndex - 1]?.name ?? null}
                    nextName={exercises[currentIndex + 1]?.name ?? null}
                    onPrevious={goPrevious}
                    onNext={goNext}
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
                <ExerciseLogger key={currentExercise.id} exercise={currentExercise} />
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

      <AlertBase
        visible={confirmDiscard}
        title="Discard this workout?"
        message="Every set logged in this session will be deleted. This cannot be undone."
        onRequestClose={() => setConfirmDiscard(false)}
        containerStyle={styles.alertCard}
        titleStyle={styles.alertTitle}
        messageStyle={styles.alertMessage}
        buttons={[
          {
            text: "Keep logging",
            onPress: () => setConfirmDiscard(false),
            style: styles.alertKeep,
            textStyle: styles.alertKeepText,
          },
          {
            text: "Discard",
            onPress: handleDiscard,
            style: styles.alertDiscard,
            textStyle: styles.alertDiscardText,
          },
        ]}
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
  alertCard: {
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  alertTitle: {
    color: t.colors.role.textPrimary,
  },
  alertMessage: {
    color: t.colors.role.textSecondary,
  },
  alertKeep: {
    minHeight: HIT,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  alertKeepText: {
    color: t.colors.role.textPrimary,
  },
  alertDiscard: {
    minHeight: HIT,
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.danger,
  },
  alertDiscardText: {
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
