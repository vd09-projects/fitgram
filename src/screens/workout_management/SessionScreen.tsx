import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import { useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { liftCards, resolveSession, sessionDateLine, sessionSummary, uploadNotice } from "../../utils/sessionView";
import type { RailWorkout } from "../../utils/historyRail";
import { WorkoutRoutes } from "../../constants/routes";
import { SPACING } from "../../constants/styles";
import type { WorkoutStackParamList } from "../../navigation/WorkoutNavigator";
import BackButton from "../../components/BackButton";
import { TextBase } from "../../components/TextBase";
import LoadingData from "../../components/LoadingData";
import { SessionLiftCard } from "../../components/history/SessionLiftCard";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The Session screen (TICKET-083, boards HistSession01 to 17): one workout, every lift a card. The data is
 * `utils/sessionView.ts`'s; this screen finds the workout, owns the states and draws.
 *
 * Where the workout comes from, in order (`resolveSession`): the upload queue, the held window, the older pages
 * loaded on the History home. Only when none has it does the screen read it by id (`loadSession`, 1 read, with a
 * "needs a connection" state): a workout opened from the home is never read again. A queued workout shows
 * provisional verdicts, and follows the move to held when its upload lands, as the store replaces the queue
 * entry with the window's copy under the same id.
 *
 * Type sizes, board px through the System board's table: headline 22 → xLarge, title 18 → large, date and counts 14 → xMedium.
 *
 * Stage 2: no options sheet, no compare, no note (stage 3), and Finish does not land here yet (stage 4).
 */
export default function SessionScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { params } = useRoute<RouteProp<WorkoutStackParamList, typeof WorkoutRoutes.Session>>();
  const { sessionId } = params;
  const { user } = useAuthUser();
  const uid = user?.uid;

  // Opens the shared workouts store and checks it on focus, as the home does: a Session reached with the store
  // never opened (the Finish landing after a cold start) would otherwise wait on a window nothing loads.
  useRecentWorkouts(uid);
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  const olderWorkouts = useRecentWorkoutsStore((s) => s.olderWorkouts);
  const waitOver = useRecentWorkoutsStore((s) => s.waitOver);
  const fetched = useRecentWorkoutsStore((s) => s.fetchedSessions[sessionId]);
  const pending = useWorkoutStore((s) => s.pendingUploads);
  const summaries = useExerciseHistoryStore((s) => (s.uid === uid ? s.byId : null));
  const [retrying, setRetrying] = useState(false);

  const lookup = useMemo(
    () =>
      resolveSession(sessionId, {
        held: workoutWindow?.sessions ?? [],
        older: Object.values(olderWorkouts).flatMap((older) => older.sessions),
        pending,
        uid,
        // Summaries not held: a queued workout's lifts stay pending, not a guessed First time.
        summaryOf: summaries === null ? null : (id) => summaries[id] ?? null,
      }),
    [sessionId, workoutWindow, olderWorkouts, pending, uid, summaries]
  );

  // Read by id only when nothing on the phone has it, and not before the window had its chance to load: a
  // workout held but not yet read from disk would otherwise cost a read. `loadSession` skips what it holds.
  const needsFetch = lookup.kind === "notOnPhone" && uid !== undefined && (workoutWindow !== null || waitOver);
  useEffect(() => {
    if (needsFetch) void useRecentWorkoutsStore.getState().loadSession(sessionId);
  }, [needsFetch, sessionId]);

  const workout: RailWorkout | null =
    lookup.kind === "found"
      ? lookup.workout
      : fetched?.status === "ready" && fetched.session
        ? { session: fetched.session, state: "uploaded" }
        : null;

  const cards = useMemo(
    () => (workout ? liftCards(workout.session, summaries === null ? null : (id) => summaries[id] ?? null) : []),
    [workout, summaries]
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
  const retryFetch = () => void useRecentWorkoutsStore.getState().loadSession(sessionId);

  const header = (
    <View style={styles.header}>
      <BackButton />
      <TextBase style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        <TextBase style={styles.headerHistory}>History · </TextBase>
        {workout?.session.workoutName ?? params.workoutName}
      </TextBase>
    </View>
  );

  if (workout === null) {
    const missing = fetched?.status === "ready";
    const refused = fetched?.status === "offline" || fetched?.status === "failed";
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.center}>
          {missing ? (
            <TextBase style={styles.message}>This workout is no longer there.</TextBase>
          ) : refused ? (
            <>
              <TextBase style={styles.message}>
                {fetched.status === "offline" ? "Needs a connection" : "Could not load this workout"}
              </TextBase>
              <TouchableOpacity onPress={retryFetch} accessibilityRole="button" accessibilityLabel="Try again">
                <TextBase style={styles.action}>Try again</TextBase>
              </TouchableOpacity>
            </>
          ) : fetched?.status === "loading" && fetched.waitOver ? (
            <TextBase style={styles.message}>Needs a connection, still trying</TextBase>
          ) : (
            <LoadingData
              containerStyle={styles.loading}
              textStyle={{ fontSize: t.fonts.large, color: t.colors.role.textPrimary }}
              dotStyle={{ fontSize: t.fonts.xLarge, color: t.colors.role.textPrimary }}
            />
          )}
        </View>
      </View>
    );
  }

  const { session, state } = workout;
  const notice = uploadNotice(state);
  const summary = sessionSummary(session);

  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.dateRow}>
        <TextBase style={styles.date}>{sessionDateLine(session.startedAt, session.endedAt)}</TextBase>
        {notice !== null && (
          <View style={styles.noticeRow} testID="session-notice">
            <TextBase style={state === "failed" ? styles.noticeFailed : styles.noticeText}>{notice}</TextBase>
            {state === "failed" && (
              <TouchableOpacity onPress={tryAgain} disabled={retrying} accessibilityRole="button" accessibilityLabel="Try again">
                <TextBase style={styles.action}>Retry</TextBase>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <ScrollView testID="session-list" contentContainerStyle={styles.listEnd}>
        {session.liftsUnreadable ? (
          <TextBase style={styles.message}>Details not available</TextBase>
        ) : (
          <>
            {summary !== null && (
              <View style={styles.summary}>
                <TextBase style={styles.headline}>{summary.headline}</TextBase>
                {summary.detail !== null && <TextBase style={styles.detail}>{summary.detail}</TextBase>}
              </View>
            )}
            {cards.map((card, index) => (
              <SessionLiftCard key={`${card.id}-${index}`} card={card} beat={session.lifts[index]?.verdict === "better"} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.role.ground },
    header: { flexDirection: "row", alignItems: "center", height: 44, paddingHorizontal: SPACING.small, gap: SPACING.small },
    headerTitle: { flexShrink: 1, fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    headerHistory: { fontSize: t.fonts.large, color: t.colors.role.textSecondary },
    dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30, paddingHorizontal: SPACING.medium },
    date: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    noticeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.small },
    noticeText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textSecondary },
    noticeFailed: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.danger },
    action: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
    summary: { paddingHorizontal: SPACING.medium, paddingTop: SPACING.medium, paddingBottom: SPACING.large },
    headline: { fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.role.textPrimary },
    detail: { marginTop: 6, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    listEnd: { paddingBottom: SPACING.xLarge },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.medium, padding: SPACING.large },
    message: { padding: SPACING.medium, fontSize: t.fonts.medium, textAlign: "center", color: t.colors.role.textSecondary },
    loading: { alignItems: "center", justifyContent: "center" },
  });
