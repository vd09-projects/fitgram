import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextBase } from "../TextBase";
import { PartsText } from "./PartsText";
import WorkoutProgressBar from "../active_workout/WorkoutProgressBar";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";
import { SPACING } from "../../constants/styles";
import { WorkoutRoutes } from "../../constants/routes";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { useExerciseHistory } from "../../hooks/useExerciseHistory";
import { useExerciseName } from "../../hooks/useExerciseNames";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { START_WOURKOUT_STEP_NAMES } from "../../tour_steps/startWorkout";
import { ActiveWorkout } from "../../types/zustandWorkoutType";
import { Exercise, WorkoutPlan } from "../../types/workoutType";
import { PlanRow } from "../../utils/startWorkout";
import { planCardHeader } from "../../utils/planCard";
import { lastTimeSummary, neverLogged } from "../../utils/setSummary";
import { buildProgressSegments, formatElapsed, resolveCurrentIndex } from "../../utils/workoutProgress";
import show from "../../utils/toastUtils";

const HIT = 44;
/** Share of the window the card may take before its list scrolls (TICKET-065). */
const MAX_HEIGHT_SHARE = 0.75;
/** Drag distance, or downward speed, past which a drag closes the card. */
const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 1;
/** List scroll past which the header collapses to one line. */
const COMPACT_AFTER = 8;

type Props = {
  /** The plan to show; null hides the card. */
  plan: WorkoutPlan | null;
  /** That plan's row from `buildPlanRows`, for its last-done session. */
  row: PlanRow | null;
  /** False while the recent-sessions read is pending or failed. */
  sessionsKnown: boolean;
  onClose: () => void;
};

/**
 * One plan, before starting it (TICKET-065): how long since it was last done,
 * each exercise with what it did last time, and Start. Opened from Start
 * Workout today; the hub (TICKET-066) and Freestyle (TICKET-067) open it
 * unchanged, which is why it reads the store and navigates on its own rather
 * than taking callbacks from the screen.
 *
 * Three footers, decided from `activeWorkout` alone:
 * - nothing running → Start
 * - this plan running (`activeWorkout.id === plan.id`) → the live timer as the
 *   big number, the progress bar, Resume
 * - another workout running → no Start; the reason and Back to it. Its name
 *   and timer come from `activeWorkout` itself, never from looking a plan up by
 *   id, so a Freestyle (no plan) needs no change here
 *
 * Decisions:
 * - **RN `Modal` + core `Animated`/`PanResponder`**, as `ExerciseHistorySheet`:
 *   no bottom-sheet library, no native rebuild. Unlike that sheet it drags to
 *   close, from the handle and header. Rejected: also dragging the list when it
 *   is at its top, which needs the list and the drag to share one gesture; the
 *   handle, header, X, dim area and Android back cover every close.
 * - **Type sizes.** Board px through the System board's table, except where its
 *   uses list says otherwise: the plan name (board 26) is `large`, the "sheet
 *   title · the open plan" use, so the big number (`xLarge`) stays above it;
 *   Start (board 17) is `medium`, the button use, as every primary button.
 * - **Row numbers** are `textSecondary`: `textGhost` is for large numerals
 *   only (colors.ts), and these are small.
 * - The scrim is `rgba(0,0,0,0.5)`, as `ExerciseHistorySheet` and the tour.
 *   There is no role token for it.
 * - Closing changes nothing: the card only reads until Start or Resume.
 */
export function PlanCard({ plan, row, sessionsKnown, onClose }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const navigation = useNavigation<WorkoutScreenNavigationProp<typeof WorkoutRoutes.StartWorkout>>();
  const activeWorkout = useWorkoutStore((state) => state.activeWorkout);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);

  const [scrolled, setScrolled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const visible = plan !== null;

  // Elapsed is re-derived from `startTime` on each tick (`formatElapsed`), so
  // the timer is right however long the card was closed.
  useEffect(() => {
    if (!visible || !activeWorkout) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, activeWorkout]);

  // Each opening starts from the top, with the full header.
  useEffect(() => {
    if (visible) setScrolled(false);
  }, [visible, plan?.id]);

  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claimed on touch start, not on move: on Android, moves inside a
        // Modal never asked the header (seen on device, 2026-11-03), so the
        // drag did nothing. Claiming at start is safe: the X is deeper and
        // takes its own taps first, and a tap here releases with dy ≈ 0.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        // Kept for the whole drag, so nothing above takes it mid-gesture.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
            closeRef.current();
            drag.setValue(0);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag]
  );

  if (!plan) return <Modal visible={false} transparent onRequestClose={onClose} />;

  const isRunning = !!activeWorkout && activeWorkout.id === plan.id;
  const blockedBy = !!activeWorkout && !isRunning ? activeWorkout : null;
  const header = planCardHeader(
    { exerciseCount: plan.exercises.length, lastDoneAt: row?.lastDoneAt ?? null, lastEndedAt: row?.lastEndedAt ?? null },
    sessionsKnown,
    now
  );
  const elapsed = activeWorkout ? formatElapsed(activeWorkout.startTime, now) : null;

  const goToLogger = () => {
    onClose();
    navigation.navigate(WorkoutRoutes.LogWorkout);
  };

  const handleStart = async () => {
    // `starting` reads the last render, so it cannot stop a same-frame double
    // press; the store's refusal is the guard (see StartWorkoutScreen before
    // TICKET-065: two starts of one plan converge on one empty workout).
    if (starting || blockedBy) return;
    setStarting(true);
    try {
      const result = await startWorkout(plan);
      if (result.status === "refused") {
        show.alert("Could not start workout", result.reason);
        return;
      }
    } catch (error) {
      console.error("Could not start workout:", error);
      show.alert("Could not start workout", "Please try again.");
      return;
    } finally {
      setStarting(false);
    }
    show.info("Starting workout", plan.name);
    goToLogger();
  };

  const onListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > COMPACT_AFTER;
    if (next !== scrolled) setScrolled(next);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: SPACING.small + insets.bottom }]}>
        {/* A convenience only: the X is the labelled way out. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID="plan-card-backdrop"
        />
        <Animated.View
          style={[styles.card, { maxHeight: height * MAX_HEIGHT_SHARE, transform: [{ translateY: drag }] }]}
          accessibilityViewIsModal
          testID="plan-card"
        >
          <View {...panResponder.panHandlers} testID="plan-card-drag">
            <View style={styles.handle} />
            {scrolled ? (
              <View style={styles.compact}>
                <View style={styles.compactText}>
                  <TextBase style={styles.compactName} numberOfLines={1} accessibilityRole="header">
                    {plan.name}
                  </TextBase>
                  <PartsText parts={header.compact} style={styles.meta} numberOfLines={1} />
                </View>
                <CloseButton onPress={onClose} color={t.colors.role.textSecondary} />
              </View>
            ) : (
              <View>
                <View style={styles.bigRow}>
                  {isRunning ? (
                    <View style={styles.bigText} testID="plan-card-since">
                      <View style={styles.liveDot} />
                      <TextBase numeric style={styles.big}>{elapsed ?? "—"}</TextBase>
                      <TextBase style={styles.caption}>in progress</TextBase>
                    </View>
                  ) : (
                    <View style={styles.bigText} testID="plan-card-since">
                      <PartsText parts={header.big} style={styles.big} />
                      <TextBase style={styles.caption}>{header.caption}</TextBase>
                    </View>
                  )}
                  <CloseButton onPress={onClose} color={t.colors.role.textSecondary} />
                </View>
                <TextBase style={styles.name} accessibilityRole="header" numberOfLines={2}>
                  {plan.name}
                </TextBase>
                <PartsText parts={header.meta} style={styles.meta} testID="plan-card-meta" />
                {isRunning && activeWorkout && <RunningProgress workout={activeWorkout} />}
              </View>
            )}
          </View>

          <View style={styles.columns}>
            <TextBase style={styles.columnLabel}>EXERCISE</TextBase>
            <TextBase style={styles.columnLabel}>LAST TIME</TextBase>
          </View>
          <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE_LIST} positionType="above">
            <ScrollView
              style={styles.list}
              onScroll={onListScroll}
              scrollEventThrottle={32}
              testID="plan-card-list"
            >
              {plan.exercises.length === 0 ? (
                <TextBase style={styles.empty}>No exercises in this plan yet</TextBase>
              ) : (
                plan.exercises.map((exercise, index) => (
                  <ExerciseRow key={exercise.id} exercise={exercise} position={index + 1} />
                ))
              )}
            </ScrollView>
          </MaybeTourStep>

          <View style={styles.footer}>
            {blockedBy ? (
              <>
                <TextBase style={styles.blockedReason}>
                  {blockedBy.name} is in progress. Finish or discard it to start this one.
                </TextBase>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={goToLogger}
                  accessibilityRole="button"
                  accessibilityLabel={`Back to ${blockedBy.name}`}
                >
                  <View style={styles.liveDot} />
                  <TextBase style={styles.secondaryText} numberOfLines={1}>
                    Back to {blockedBy.name}
                    {elapsed !== null && (
                      <>
                        {" · "}
                        <TextBase numeric style={styles.secondaryText}>{elapsed}</TextBase>
                      </>
                    )}
                  </TextBase>
                </TouchableOpacity>
              </>
            ) : (
              <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.START_SELECTED_WORKOUT_BUTTON} positionType="above">
                {/* Plain View: MultiTourSteps splits its child's style (see ActiveWorkoutScreen). */}
                <View>
                  <TouchableOpacity
                    style={[styles.primary, starting && styles.primaryBusy]}
                    onPress={isRunning ? goToLogger : handleStart}
                    disabled={starting}
                    accessibilityRole="button"
                    accessibilityLabel={isRunning ? `Resume ${plan.name}` : `Start ${plan.name}`}
                    accessibilityState={{ disabled: starting, busy: starting }}
                  >
                    <Ionicons name="play" size={15} color={t.colors.role.ground} />
                    <TextBase style={styles.primaryText}>{isRunning ? "Resume" : "Start"}</TextBase>
                  </TouchableOpacity>
                </View>
              </MaybeTourStep>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function CloseButton({ onPress, color }: { onPress: () => void; color: string }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <TouchableOpacity style={styles.close} onPress={onPress} accessibilityRole="button" accessibilityLabel="Close">
      <Ionicons name="close" size={20} color={color} />
    </TouchableOpacity>
  );
}

/**
 * The running workout's progress bar, as the logger draws it: the current
 * exercise's target is its last session's set count (ActiveWorkoutScreen).
 */
function RunningProgress({ workout }: { workout: ActiveWorkout }) {
  const { styles } = useThemeStyles(createStyles);
  const index = resolveCurrentIndex(workout.currentExerciseIndex, workout.exercises.length);
  const current = index === null ? undefined : workout.exercises[index];
  const history = useExerciseHistory(current?.id, { fields: current?.fields });
  if (index === null) return null;
  const segments = buildProgressSegments(workout.exercises, index, history.lastSession?.sets.length ?? null);
  return (
    <View style={styles.progress}>
      <WorkoutProgressBar segments={segments} />
    </View>
  );
}

/**
 * One exercise: its position, name, and last time (`lastTimeSummary`). The
 * history is cache-only here; the screen's prefetch on open fills it.
 */
function ExerciseRow({ exercise, position }: { exercise: Exercise; position: number }) {
  const { styles } = useThemeStyles(createStyles);
  const history = useExerciseHistory(exercise.id, { fields: exercise.fields });
  const name = useExerciseName(exercise);

  return (
    <View style={styles.row}>
      <TextBase numeric style={styles.position}>{position}</TextBase>
      <View style={styles.nameBlock}>
        {/* Wraps to two lines, never cut (TICKET-041 board B1). */}
        <TextBase style={styles.exerciseName} numberOfLines={2}>
          {name.title}
        </TextBase>
        {name.subtitle !== null && <TextBase style={styles.summary}>{name.subtitle}</TextBase>}
      </View>
      <PartsText
        parts={lastTimeSummary(history)}
        style={[styles.summary, neverLogged(history) && styles.summaryNew]}
        testID={`last-time-${exercise.id}`}
      />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: SPACING.small,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    card: {
      paddingTop: SPACING.small,
      paddingHorizontal: SPACING.xLarge,
      paddingBottom: SPACING.large,
      borderRadius: 26,
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      marginBottom: SPACING.small,
      backgroundColor: t.colors.role.hairlineStrong,
    },
    bigRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bigText: {
      flex: 1,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    big: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    caption: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    liveDot: {
      alignSelf: "center",
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    close: {
      width: HIT,
      height: HIT,
      marginTop: -SPACING.small,
      marginRight: -SPACING.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      marginTop: SPACING.small,
      fontSize: t.fonts.large,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    meta: {
      marginTop: 4,
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    progress: {
      marginTop: SPACING.medium,
    },
    compact: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      paddingBottom: SPACING.small,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.role.hairlineStrong,
    },
    compactText: {
      flex: 1,
      minWidth: 0,
    },
    compactName: {
      fontSize: t.fonts.large,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    columns: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: SPACING.medium,
      marginBottom: 6,
    },
    columnLabel: {
      fontSize: t.fonts.xSmall,
      fontWeight: "bold",
      letterSpacing: 1.4,
      color: t.colors.role.textSecondary,
    },
    // Shrinks inside the capped card, so the list scrolls and the footer stays.
    list: {
      flexGrow: 0,
      flexShrink: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: SPACING.small,
      paddingVertical: SPACING.small,
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    position: {
      minWidth: 20,
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    nameBlock: {
      flex: 1,
      minWidth: 0,
    },
    exerciseName: {
      fontSize: t.fonts.medium,
      color: t.colors.role.textPrimary,
    },
    summary: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    summaryNew: {
      color: t.colors.role.accent,
    },
    empty: {
      paddingVertical: SPACING.small,
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    footer: {
      marginTop: SPACING.medium,
      gap: SPACING.small,
    },
    blockedReason: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
      textAlign: "center",
    },
    primary: {
      height: 56,
      flexDirection: "row",
      gap: SPACING.small,
      borderRadius: 16,
      backgroundColor: t.colors.role.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBusy: {
      opacity: 0.6,
    },
    primaryText: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
    secondary: {
      minHeight: 52,
      flexDirection: "row",
      gap: SPACING.small,
      paddingHorizontal: SPACING.large,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.fieldEdge,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      flexShrink: 1,
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
  });
