import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { exerciseOlderOf, exercisePaging, olderOf, useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { historyNotice } from "../../utils/historyNotice";
import { mergePending, type RailWorkout } from "../../utils/historyRail";
import { averageReason, averageText, exerciseLog } from "../../utils/exerciseLog";
import { compareHeaderParts } from "../../utils/sessionView";
import { olderRowBusy, olderRowDetail } from "../../utils/olderRow";
import { EXERCISE_LOG_PAGE_SIZE } from "../../config/display";
import { WorkoutRoutes } from "../../constants/routes";
import { SPACING } from "../../constants/styles";
import type { WorkoutScreenNavigationProp, WorkoutStackParamList } from "../../navigation/WorkoutNavigator";
import BackButton from "../../components/BackButton";
import { TextBase } from "../../components/TextBase";
import LoadingData from "../../components/LoadingData";
import { HistoryNoticeStrip } from "../../components/history/HistoryNoticeStrip";
import { ExerciseGraph } from "../../components/history/ExerciseGraph";
import { ExerciseLogTable } from "../../components/history/ExerciseLogTable";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The Exercise screen (TICKET-084, boards HistExercise01 to 13): one lift across workouts. Stage 1 is the log: the
 * newest session's average weight as the figure, then every session the phone holds, newest first (`utils/exerciseLog.ts`
 * owns every value; this screen finds the workouts, owns the states and draws).
 *
 * Where the sessions come from: the held window, the queue (`mergePending`), and the pages the History home loaded:
 * 0 reads. Past them the log goes on by page, on tap (stage 3: "Older sessions", `loadOlderOfExercise`): `EXERCISE_LOG_PAGE_SIZE`
 * of this lift's sessions a tap, kept in memory, and it says so rather than claiming a lift was never done while older
 * sessions may exist. The graph above the log is stage 2 (`ExerciseGraph`), the view options stage 4.
 *
 * The notice strip counts only the waiting or rejected workouts that contain this lift (boards HistExercise11, 12):
 * the History home's strip counts every one, and a lift's screen must not report uploads that are not its own.
 */
export default function ExerciseScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<WorkoutScreenNavigationProp<typeof WorkoutRoutes.Exercise>>();
  const { params } = useRoute<RouteProp<WorkoutStackParamList, typeof WorkoutRoutes.Exercise>>();
  const { exerciseId, exerciseName } = params;
  const { user } = useAuthUser();
  const uid = user?.uid;

  // Opens the shared workouts store and checks it on focus, as the home does: a lift opened after a cold start
  // would otherwise wait on a window nothing loads.
  useRecentWorkouts(uid);
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  const olderWorkouts = useRecentWorkoutsStore((s) => s.olderWorkouts);
  const exerciseOlder = useRecentWorkoutsStore((s) => s.exerciseOlder);
  const waitOver = useRecentWorkoutsStore((s) => s.waitOver);
  const pending = useWorkoutStore((s) => s.pendingUploads);
  const [retrying, setRetrying] = useState(false);
  // For the year on an old date: read once when the screen opens, as the Session's compare.
  const [now] = useState(() => Date.now());

  // Every older page the History home loaded, any plan filter: the log wants all of this lift's sessions, and
  // `exerciseLog` drops the workouts that two lists both hold.
  const own = exerciseOlderOf(exerciseOlder, workoutWindow, exerciseId);
  const loadedOlder = useMemo(
    () => [...Object.values(olderWorkouts).flatMap((older) => older.sessions), ...(own?.sessions ?? [])],
    [olderWorkouts, own]
  );
  // Whether the log may go on past what the phone holds (`exercisePaging`): not when the window holds the whole history.
  const paging = exercisePaging(workoutWindow?.windowStart ?? null, olderOf(olderWorkouts, workoutWindow, null), own);
  const loadOlderSessions = useCallback(() => void useRecentWorkoutsStore.getState().loadOlderOfExercise(exerciseId), [exerciseId]);

  const workouts = useMemo<RailWorkout[] | null>(() => {
    if (workoutWindow === null) return null;
    // No summaries: verdicts are not drawn here, and a queued workout needs only its sets.
    const held = mergePending(workoutWindow.sessions, pending, uid, null);
    return [...held, ...loadedOlder.map((session): RailWorkout => ({ session, state: "uploaded" }))];
  }, [workoutWindow, pending, uid, loadedOlder]);

  const log = useMemo(() => (workouts === null ? null : exerciseLog(workouts, exerciseId)), [workouts, exerciseId]);
  const entries = useMemo(() => log?.segments.flatMap((segment) => segment.entries) ?? [], [log]);
  const dateLabels = useMemo(() => {
    const labels = compareHeaderParts(entries.map((entry) => entry.startedAt), now);
    return Object.fromEntries(entries.map((entry, i) => [entry.key, labels[i]]));
  }, [entries, now]);

  const notice = useMemo(() => {
    const theirs = new Set(entries.filter((entry) => entry.state !== "uploaded").map((entry) => entry.sessionId));
    return historyNotice(pending.filter((entry) => theirs.has(entry.sessionId)), uid, false);
  }, [entries, pending, uid]);

  const openSession = useCallback(
    (session: { sessionId: string; workoutName: string; startedAt: number }) =>
      navigation.navigate(WorkoutRoutes.Session, { sessionId: session.sessionId, workoutName: session.workoutName, startedAt: session.startedAt }),
    [navigation]
  );

  const tryAgain = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await drainPendingUploads();
    } finally {
      setRetrying(false);
    }
  };

  const latest = entries[0]?.average ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton />
        <TextBase style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          <TextBase style={styles.headerHistory}>History · </TextBase>
          {exerciseName}
        </TextBase>
      </View>

      {notice && <HistoryNoticeStrip notice={notice} retrying={retrying} onTryAgain={tryAgain} />}

      {log === null ? (
        <View style={styles.center}>
          {waitOver ? (
            <TextBase style={styles.message}>Needs a connection, still trying</TextBase>
          ) : (
            <LoadingData
              containerStyle={styles.loading}
              textStyle={{ fontSize: t.fonts.large, color: t.colors.role.textPrimary }}
              dotStyle={{ fontSize: t.fonts.xLarge, color: t.colors.role.textPrimary }}
            />
          )}
        </View>
      ) : (
        <ScrollView testID="exercise-scroll" contentContainerStyle={styles.content}>
          {entries.length === 0 ? (
            log.unreadable === 0 && (
              <TextBase style={styles.message}>
                {paging.reachedStart ? "No sessions of this exercise." : "No sessions of this exercise in the workouts on this phone."}
              </TextBase>
            )
          ) : (
            <>
              <View style={styles.figureBlock}>
                {latest?.kind === "value" ? (
                  <TextBase numeric style={styles.figure} testID="exercise-figure">
                    {averageText(latest.value)}
                    <TextBase style={styles.figureUnit}> {latest.unit}</TextBase>
                  </TextBase>
                ) : (
                  <TextBase style={styles.figure} testID="exercise-figure">
                    –
                  </TextBase>
                )}
                <TextBase style={styles.measure}>
                  Average weight<TextBase style={styles.measureNote}> · {latest?.kind === "none" ? averageReason(latest.reason) : "last session"}</TextBase>
                </TextBase>
              </View>
              <ExerciseGraph log={log} now={now} onOpen={openSession} />
              <ExerciseLogTable log={log} dateLabels={dateLabels} onOpen={openSession} />
            </>
          )}
          {!paging.reachedStart && (
            <TouchableOpacity
              style={styles.olderRow}
              // A read inside its wait is joined by the store; disabled here too, so a tap shows no change.
              disabled={olderRowBusy(own?.read)}
              onPress={loadOlderSessions}
              accessibilityRole="button"
              accessibilityLabel={`Older sessions, ${olderRowDetail(own?.read, EXERCISE_LOG_PAGE_SIZE)}`}
              testID="exercise-older"
            >
              <TextBase style={styles.olderName}>Older sessions</TextBase>
              <TextBase style={styles.olderDetail}>{olderRowDetail(own?.read, EXERCISE_LOG_PAGE_SIZE)}</TextBase>
            </TouchableOpacity>
          )}
          {log.unreadable > 0 && (
            <TextBase style={styles.message}>
              {log.unreadable === 1 ? "1 workout" : `${log.unreadable} workouts`} with this exercise could not be read.
            </TextBase>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.role.ground },
    // The 44 dp back target holds a 22 dp icon: the padding is the content's inset less that, as the Session's header.
    header: { flexDirection: "row", alignItems: "center", height: 44, marginTop: SPACING.small, paddingHorizontal: SPACING.medium - 11, gap: SPACING.small },
    headerTitle: { flexShrink: 1, fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    headerHistory: { fontSize: t.fonts.large, fontWeight: "normal", color: t.colors.role.textSecondary },
    content: { paddingBottom: SPACING.xxLarge },
    center: { flex: 1, paddingHorizontal: SPACING.xMedium, paddingTop: SPACING.medium },
    loading: { paddingVertical: SPACING.xxxLarge, alignItems: "center" },
    message: { paddingHorizontal: SPACING.medium, paddingVertical: SPACING.medium, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    figureBlock: { paddingHorizontal: SPACING.medium, paddingTop: SPACING.xSmall, paddingBottom: SPACING.medium },
    figure: { fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.role.textPrimary },
    figureUnit: { fontSize: t.fonts.xMedium, fontWeight: "normal", color: t.colors.role.textSecondary },
    measure: { marginTop: 2, fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
    olderRow: {
      minHeight: 48,
      marginHorizontal: SPACING.medium,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.role.hairline,
    },
    olderName: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    olderDetail: { flex: 1, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    measureNote: { fontSize: t.fonts.small, fontWeight: "normal", color: t.colors.role.textSecondary },
  });
