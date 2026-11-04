import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { useWorkoutPlansOnFocus } from "../../hooks/useWorkoutPlansOnFocus";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { SPACING } from "../../constants/styles";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { showDebugScreens } from "../../config/envConfig";
import { FREESTYLE_NAME, freestylePlan, isFreestyle } from "../../constants/freestyle";
import ScrollableScreen from "../../components/ScrollableScreen";
import LoadingData from "../../components/LoadingData";
import { PlanCard } from "../../components/start_workout/PlanCard";
import { HubHeader } from "../../components/workout_hub/HubHeader";
import { HubResumeBar } from "../../components/workout_hub/HubResumeBar";
import { HubTile } from "../../components/workout_hub/HubTile";
import { HubMessageCard } from "../../components/workout_hub/HubMessageCard";
import { PickTodaySection } from "../../components/workout_hub/PickTodaySection";
import { HubDebugRow } from "../../components/workout_hub/HubDebugRow";
import { HubFreestyleRow } from "../../components/workout_hub/HubFreestyleRow";
import { FreestyleBlockedCard } from "../../components/workout_hub/FreestyleBlockedCard";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { buildPlanRows, chooseHubTiles, PlanRow } from "../../utils/startWorkout";
import show from "../../utils/toastUtils";

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
 * Freestyle (TICKET-067): the dashed row under the tiles, and Start Freestyle
 * on the first-run card. A tap starts it at once, with no card; while it runs
 * the row is live and a tap resumes; while a plan runs a tap opens a short
 * blocked card (`FreestyleBlockedCard`). Never greyed out, for the same reason
 * as the tiles. The row also sits under "Your plans did not load": a Freestyle
 * needs no plan, so failed plans are no reason to block it (not on a board;
 * TICKET-067 notes).
 */
export default function WorkoutHubScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;
  const activeWorkout = useWorkoutStore((state) => state.activeWorkout);
  const pendingUploads = useWorkoutStore((state) => state.pendingUploads);

  const { workoutPlans, loadingWorkoutPlans, failedToLoad, retry } = useWorkoutPlansOnFocus();
  const myPendingCount = pendingUploads.filter((entry) => entry.uid === uid).length;
  const sessions = useRecentSessions(uid, myPendingCount);
  const sessionsKnown = sessions !== null;

  const rows = useMemo(
    () => buildPlanRows(workoutPlans, sessions, pendingUploads, uid, ""),
    [workoutPlans, sessions, pendingUploads, uid]
  );
  const tiles = useMemo(() => chooseHubTiles(rows), [rows]);

  // The open card is derived on every render, as on All plans. Looked up in
  // every plan's row, not the tiles: the six reorder when sessions land or
  // reload, and a card must not close because its plan left them (PR #45
  // review). Only a deleted plan has no card; an archived one keeps it open,
  // as All plans does.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const selectedPlan = selectedRow ? (workoutPlans.find((plan) => plan.id === selectedRow.id) ?? null) : null;

  // Days since are counted from this. The screen stays mounted, often left
  // open overnight as the tab's root, so it is re-read on each focus and each
  // return to the foreground: focus events fire on navigation only, and a
  // stale clock showed yesterday's plan as "today" while its card, which reads
  // the clock on open, said "1 day" (PR #45 review).
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const setsLogged = activeWorkout?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0;
  const freestyleRunning = isFreestyle(activeWorkout?.id);
  const goToLogger = () => navigation.navigate(WorkoutRoutes.LogWorkout);

  // Freestyle never opens a card: idle starts at once, running resumes, and
  // only another workout running opens the blocked card. `starting` is a ref,
  // not state, so a same-frame double tap cannot start twice; the store's
  // refusal would catch it too, but with a "still in progress" alert.
  const [freestyleBlockedOpen, setFreestyleBlockedOpen] = useState(false);
  const starting = useRef(false);
  // The card shows only while something blocks; once nothing runs, its flag
  // is cleared too, so it cannot reopen by itself when the next workout starts.
  useEffect(() => {
    if (!activeWorkout) setFreestyleBlockedOpen(false);
  }, [activeWorkout]);
  const onFreestyle = async () => {
    if (activeWorkout) {
      if (freestyleRunning) goToLogger();
      else setFreestyleBlockedOpen(true);
      return;
    }
    if (starting.current) return;
    starting.current = true;
    try {
      const result = await useWorkoutStore.getState().startWorkout(freestylePlan());
      if (result.status === "refused") {
        show.alert("Could not start workout", result.reason);
        return;
      }
    } catch (error) {
      console.error("Could not start Freestyle:", error);
      show.alert("Could not start workout", "Please try again.");
      return;
    } finally {
      starting.current = false;
    }
    show.info("Starting workout", FREESTYLE_NAME);
    goToLogger();
  };
  const freestyleRow = (
    <HubFreestyleRow
      running={
        freestyleRunning && activeWorkout
          ? { startTime: activeWorkout.startTime, exerciseCount: activeWorkout.exercises.length }
          : null
      }
      onPress={onFreestyle}
    />
  );

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
    // Try again reads now; leaving the tab and coming back also reads again
    // (`useWorkoutPlansOnFocus`).
    <>
      <HubMessageCard
        icon="cloud-offline-outline"
        title="Your plans did not load"
        body="Check your connection and try again."
        action={{ label: "Try again", onPress: retry }}
      />
      {freestyleRow}
    </>
  ) : workoutPlans.length === 0 ? (
    // The board's copy and order (Hub 9): Start Freestyle is the primary,
    // Create a plan the secondary under it. No Freestyle row here: the card's
    // button is it.
    <HubMessageCard
      title="Ready when you are"
      body="Start now and pick exercises as you go, or build a plan you can repeat. Your plans show up here as tiles."
      // While the Freestyle it started runs, the same button resumes it, so it
      // says so (PR #46 review): "Start" under the Resume bar promised a new one.
      action={{
        label: freestyleRunning ? `Resume ${FREESTYLE_NAME}` : `Start ${FREESTYLE_NAME}`,
        icon: freestyleRunning ? "play" : "add",
        onPress: onFreestyle,
      }}
      secondaryAction={{ label: "Create a plan", onPress: () => navigation.navigate(WorkoutRoutes.AddExercise) }}
      testID="hub-first-run"
    />
  ) : (
    <>
      <PickTodaySection
        planCount={workoutPlans.length}
        tiles={tiles}
        renderTile={renderTile}
        onAllPlans={() => navigation.navigate(WorkoutRoutes.StartWorkout)}
      />
      {freestyleRow}
    </>
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
            onResume={goToLogger}
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
      <FreestyleBlockedCard
        blockedBy={freestyleBlockedOpen && activeWorkout && !freestyleRunning ? activeWorkout : null}
        onBack={() => {
          setFreestyleBlockedOpen(false);
          goToLogger();
        }}
        onClose={() => setFreestyleBlockedOpen(false)}
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
