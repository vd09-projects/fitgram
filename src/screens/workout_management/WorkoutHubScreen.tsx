import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { useWorkoutPlansOnFocus } from "../../hooks/useWorkoutPlansOnFocus";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { SPACING } from "../../constants/styles";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { showDebugScreens } from "../../config/envConfig";
import ScrollableScreen from "../../components/ScrollableScreen";
import LoadingData from "../../components/LoadingData";
import { PlanCard } from "../../components/start_workout/PlanCard";
import { HubHeader } from "../../components/workout_hub/HubHeader";
import { HubResumeBar } from "../../components/workout_hub/HubResumeBar";
import { HubTile } from "../../components/workout_hub/HubTile";
import { HubMessageCard } from "../../components/workout_hub/HubMessageCard";
import { PickTodaySection } from "../../components/workout_hub/PickTodaySection";
import { HubDebugRow } from "../../components/workout_hub/HubDebugRow";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { buildPlanRows, chooseHubTiles, PlanRow } from "../../utils/startWorkout";

type NavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.WorkoutHome>;

/**
 * The Workout tab (TICKET-066): pick today's workout. Up to six plans as tiles
 * (`chooseHubTiles`), each opening TICKET-065's card unchanged; All plans for
 * the rest; Plans and History in the header. The pieces are in
 * `components/workout_hub/`; this screen owns the reads, the open card, and
 * which of loading / failed / first run / tiles to show.
 *
 * Reads the same two things as All plans (StartWorkoutScreen), with the same
 * hooks: the plans, re-read on focus because this screen stays mounted under
 * the tab (`useWorkoutPlansOnFocus`), and the one recent-sessions query
 * (`useRecentSessions`), joined with pending uploads by `buildPlanRows`. No
 * read of its own.
 *
 * While a workout runs: a Resume bar on top, the running plan's tile shows the
 * live timer, and every tile still opens the card, which shows Resume for the
 * running plan and its blocked state for the others. Rejected: greying the
 * other tiles, which would hide why they cannot start. The two timers tick on
 * their own clocks, so the hub does not re-render every second.
 *
 * Freestyle (the dashed row under the tiles, and Start Freestyle on the first
 * run card) is TICKET-067's.
 */
export default function WorkoutHubScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;
  const activeWorkout = useWorkoutStore((state) => state.activeWorkout);
  const pendingUploads = useWorkoutStore((state) => state.pendingUploads);

  const { workoutPlans, loadingWorkoutPlans, failedToLoad } = useWorkoutPlansOnFocus();
  const myPendingCount = pendingUploads.filter((entry) => entry.uid === uid).length;
  const sessions = useRecentSessions(uid, myPendingCount);
  const sessionsKnown = sessions !== null;

  const rows = useMemo(
    () => buildPlanRows(workoutPlans, sessions, pendingUploads, uid, ""),
    [workoutPlans, sessions, pendingUploads, uid]
  );
  const tiles = useMemo(() => chooseHubTiles(rows), [rows]);

  // The open card is derived on every render, as on All plans: a plan deleted
  // or archived while its card is open simply has no card.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = tiles.find((row) => row.id === selectedId) ?? null;
  const selectedPlan = selectedRow ? (workoutPlans.find((plan) => plan.id === selectedRow.id) ?? null) : null;

  // Days since are counted from this, re-read on each focus: the screen stays
  // mounted, possibly across midnight.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const setsLogged = activeWorkout?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0;

  const renderTile = (row: PlanRow) => (
    <HubTile
      key={row.id}
      row={row}
      sessionsKnown={sessionsKnown}
      now={now}
      running={activeWorkout?.id === row.id ? { startTime: activeWorkout.startTime, setsLogged } : null}
      onPress={() => setSelectedId(row.id)}
    />
  );

  const body = loadingWorkoutPlans ? (
    <LoadingData
      containerStyle={styles.loading}
      textStyle={{ fontSize: t.fonts.large, color: t.colors.role.textPrimary }}
      dotStyle={{ fontSize: t.fonts.xLarge, color: t.colors.role.textPrimary }}
    />
  ) : workoutPlans.length === 0 && failedToLoad ? (
    // Not the first-run card: offering a first plan to someone whose plans
    // could not load is the false "No plans yet" TICKET-052 D5 ruled out.
    // Leaving the tab and coming back reads again (`useWorkoutPlansOnFocus`).
    <HubMessageCard
      title="Your plans did not load"
      body="Check your connection, then come back to this tab."
    />
  ) : workoutPlans.length === 0 ? (
    // TICKET-067 adds Start Freestyle above Create a plan, and its half of
    // this sentence. Create a plan is the primary until then: a card whose
    // only action is grey reads as disabled.
    <HubMessageCard
      title="Ready when you are"
      body="Build a plan you can repeat. Your plans show up here as tiles."
      action={{ label: "Create a plan", onPress: () => navigation.navigate(WorkoutRoutes.AddExercise) }}
      testID="hub-first-run"
    />
  ) : (
    <PickTodaySection
      planCount={workoutPlans.length}
      tiles={tiles}
      renderTile={renderTile}
      onAllPlans={() => navigation.navigate(WorkoutRoutes.StartWorkout)}
    />
  );

  return (
    <View style={styles.screen}>
      <ScrollableScreen style={styles.scroll} innerContainerStyle={styles.inner}>
        <HubHeader
          onPlans={() => navigation.navigate(WorkoutRoutes.AddExercise)}
          onHistory={() => navigation.navigate(WorkoutRoutes.WorkoutLogs)}
        />
        {activeWorkout && (
          <HubResumeBar
            workoutName={activeWorkout.name}
            startTime={activeWorkout.startTime}
            setsLogged={setsLogged}
            onResume={() => navigation.navigate(WorkoutRoutes.LogWorkout)}
          />
        )}
        {body}
        {showDebugScreens && (
          <HubDebugRow
            onHistoryDebug={() => navigation.navigate(WorkoutRoutes.HistoryDebug)}
            onPendingUploads={() => navigation.navigate(WorkoutRoutes.PendingUploadsDebug)}
          />
        )}
      </ScrollableScreen>

      <PlanCard
        plan={selectedPlan}
        row={selectedRow}
        sessionsKnown={sessionsKnown}
        onClose={() => setSelectedId(null)}
      />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.role.ground,
    },
    scroll: {
      backgroundColor: t.colors.role.ground,
    },
    inner: {
      backgroundColor: t.colors.role.ground,
      gap: SPACING.medium,
    },
    loading: {
      paddingVertical: SPACING.xxxLarge,
      alignItems: "center",
    },
  });
