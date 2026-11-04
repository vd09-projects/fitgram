import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
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
import { StackActions, useIsFocused, useNavigation } from "@react-navigation/native";
import { TextBase } from "../../components/TextBase";
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";
import { isFreestyle } from "../../constants/freestyle";
import { ACTIVE_WORKOUT_STEP_NAMES } from "../../tour_steps/activeWorkout";
import WorkoutExercisePicker, { type WorkoutPickerPurpose } from "../../components/active_workout/WorkoutExercisePicker";
import MenuSheet, { type MenuItem } from "../../components/MenuSheet";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.LogWorkout>;
type layoutScreenNavigationProp = LayoutScreenNavigationProp<typeof LayoutRoutes.LogWorkout>;

const HIT = 44;

export default function ActiveWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();
  const layoutNavigation = useNavigation<layoutScreenNavigationProp>();

  const { user } = useAuthUser();
  const { activeWorkout, endWorkout, cancelWorkout, setCurrentExerciseIndex } = useWorkoutStore();

  const [workoutMenuOpen, setWorkoutMenuOpen] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  /**
   * The exercise picker, open to swap a slot (TICKET-047, by id) or to add one
   * (TICKET-056); null when closed. One state, so only one can be open.
   */
  const [picker, setPicker] = useState<{ kind: "swap"; id: string } | { kind: "add" } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // The store's index is the only record of which exercise is in view; there is
  // no local copy to drift from it.
  const exercises = activeWorkout?.exercises ?? [];
  const currentIndex = resolveCurrentIndex(activeWorkout?.currentExerciseIndex ?? null, exercises.length);
  const currentExercise = currentIndex === null ? null : exercises[currentIndex];
  // Built from the catalog, never `exercise.name` (TICKET-042).
  const names = useExerciseNames(exercises);
  // A swap picker resolves its slot each render, so it closes if the slot is gone.
  const swapping = picker?.kind === "swap" ? exercises.find((e) => e.id === picker.id) ?? null : null;
  const pickerPurpose: WorkoutPickerPurpose | null = swapping
    ? { kind: "swap", replacing: swapping }
    : picker?.kind === "add"
      ? { kind: "add" }
      : null;

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
  // hub or All plans) and Layout (the Log Workout footer tab, which moves or
  // pushes it in the Layout history, LayoutScreen `openTab`). A Workout-stack
  // route name is unknown to the Layout stack, so anything that leaves this
  // screen goes via the Layout `Workout` route with a nested target. Called from
  // the Workout stack, that action bubbles up to the Layout stack and resolves
  // the same way.
  const openWorkoutScreen = (screen: typeof WorkoutRoutes.WorkoutHome) =>
    layoutNavigation.navigate(LayoutRoutes.Workout, { screen });

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else openWorkoutScreen(WorkoutRoutes.WorkoutHome);
  };

  // With no workout there is nothing to log (TICKET-066): after Finish or
  // Discard, or reached with none, the logger hands over to the hub, which
  // shows the "Saved" message and what to start next. `popTo` goes back to the
  // hub, dropping this screen and anything above the hub, or replaces this
  // screen with the hub when the hub is not in the history. Either way back
  // from the hub cannot land on an empty logger. From the footer tab the
  // target is the Layout `Workout` route; its `screen` param moves the nested
  // stack to the hub even when that stack is open on All plans.
  // Rejected: `openWorkoutScreen`, which leaves this screen beneath the hub,
  // so back loops; keeping the full visit order (TICKET-060's `openTab`
  // logic), which took a hand-built reset for a trail nobody needs once the
  // workout is over.
  //
  // An effect, not a call in the Finish and Discard handlers: the store
  // clears the workout before Finish's upload wait (up to 3 s), so this
  // screen would sit blank until the handler resumed. Only while focused:
  // this screen stays mounted under others (`singleCopy`), and a workout
  // discarded from All plans must not pull the user away from where they
  // are. The redirect runs when they next come back here.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || activeWorkout) return;
    const inWorkoutStack = (navigation.getState().routeNames as string[]).includes(WorkoutRoutes.WorkoutHome);
    navigation.dispatch(
      inWorkoutStack
        ? StackActions.popTo(WorkoutRoutes.WorkoutHome)
        : StackActions.popTo(LayoutRoutes.Workout, { screen: WorkoutRoutes.WorkoutHome })
    );
  }, [isFocused, activeWorkout, navigation]);

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

  // Nothing to draw for the moment before the redirect above lands.
  if (!activeWorkout) return null;

  const segments = buildProgressSegments(exercises, currentIndex, lastSessionSetCount);
  const addItem: MenuItem = {
    key: "add",
    renderIcon: (color) => <Ionicons name="add" size={20} color={color} />,
    title: "Add exercise",
    // A Freestyle has no plan to stay as it is (TICKET-067).
    detail: isFreestyle(activeWorkout.id)
      ? "Goes at the end of today's list."
      : "Goes at the end of today's list. Your plan stays as it is.",
    onPress: () => setPicker({ kind: "add" }),
  };
  const discardItem: MenuItem = {
    key: "discard",
    renderIcon: (color) => <Ionicons name="trash-outline" size={20} color={color} />,
    title: "Discard workout",
    tone: "danger",
    onPress: () => setConfirmDiscard(true),
  };

  return (
    <View style={styles.screen}>
      <WorkoutHeader
        workoutName={activeWorkout.name}
        startTime={activeWorkout.startTime}
        onBack={handleBack}
        onOpenMenu={() => setWorkoutMenuOpen(true)}
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
                    onAdd={() => setPicker({ kind: "add" })}
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
                  onSwap={() => setPicker({ kind: "swap", id: currentExercise.id })}
                />
              </ScrollableScreen>
            </>
          ) : (
            // Nothing to log yet: a Freestyle just started, or an empty plan
            // (TICKET-067 board E1). The button is ⋯ → Add exercise, brought
            // out, since the menu was the only way on and Finish refuses.
            // Type sizes: title 18 → large, line 14 → xMedium, button 16 → medium.
            <View style={styles.emptyPlan} testID="logger-empty">
              <View style={styles.emptyBadge}>
                <Ionicons name="add" size={26} color={t.colors.role.accent} />
              </View>
              <TextBase style={styles.emptyTitle}>Add your first exercise</TextBase>
              <TextBase style={styles.emptyLine}>
                Log its sets, then add the next. Each one shows your last time, from any plan.
              </TextBase>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setPicker({ kind: "add" })}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={18} color={t.colors.role.ground} />
                <TextBase style={styles.emptyButtonText}>Add exercise</TextBase>
              </TouchableOpacity>
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

      {/* Workout ⋯ (TICKET-056 board AddMenu). Discard is its own group, away
          from Add and from Finish, so a stray tap can never lose the session. */}
      <MenuSheet
        visible={workoutMenuOpen}
        title={activeWorkout.name}
        groups={[[addItem], [discardItem]]}
        onClose={() => setWorkoutMenuOpen(false)}
        testID="workout-menu"
      />

      {/* Over the whole screen, footer included, as on Manage Workout. A swap
          picker closes if its slot is gone (Finish or Discard while open). */}
      {pickerPurpose && (
        <WorkoutExercisePicker
          exercises={exercises}
          purpose={pickerPurpose}
          onClose={() => setPicker(null)}
        />
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
    gap: SPACING.xMedium,
    paddingHorizontal: SPACING.xxxLarge,
  },
  emptyBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.role.accentDeep,
  },
  emptyTitle: {
    fontSize: t.fonts.large,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
    textAlign: "center",
  },
  emptyLine: {
    maxWidth: 280,
    fontSize: t.fonts.xMedium,
    color: t.colors.role.textSecondary,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: SPACING.xSmall,
    height: 52,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
    borderRadius: 14,
    backgroundColor: t.colors.role.accent,
  },
  emptyButtonText: {
    fontSize: t.fonts.medium,
    fontWeight: "bold",
    color: t.colors.role.ground,
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
});
