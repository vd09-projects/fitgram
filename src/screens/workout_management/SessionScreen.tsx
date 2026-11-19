import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import { useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { Ionicons } from "@expo/vector-icons";
import { liftCards, liftCompare, normalizeNote, resolveSession, sessionDateLine, sessionSummary, uploadNotice } from "../../utils/sessionView";
import { setWorkoutNote } from "../../services/db/workoutSessions";
import type { RailWorkout } from "../../utils/historyRail";
import { WorkoutRoutes } from "../../constants/routes";
import { SPACING } from "../../constants/styles";
import type { WorkoutScreenNavigationProp, WorkoutStackParamList } from "../../navigation/WorkoutNavigator";
import BackButton from "../../components/BackButton";
import { TextBase } from "../../components/TextBase";
import LoadingData from "../../components/LoadingData";
import MenuSheet from "../../components/MenuSheet";
import { SessionLiftCard } from "../../components/history/SessionLiftCard";
import { SessionNoteSheet } from "../../components/history/SessionNoteSheet";
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
 * A tap on a card opens its compare (`liftCompare`, from the held summaries: no read). The ⋯ opens the options:
 * Add a note (or Edit note), and Edit session and Delete session switched off with their reason (086 builds them).
 * A note is saved on the server first (`setWorkoutNote`, refused offline) and then shown in every copy the phone
 * holds (`applyNote`); a workout still in the queue has no document to hold one, so the item says so.
 *
 * After Finish the app lands here (`finished` param, `ActiveWorkoutScreen`). The Session mounts while the workout is
 * still queued, so "uploaded" is reached by the upload landing, not at the first render. Inside Finish's wait the store
 * suppresses the "Saved" toast and this says "Workout saved" instead; an upload that lands later shows the toast
 * (`toastedSessionId`), and the banner stays away so it is not said twice. Waiting or rejected, the notice says so.
 */
export default function SessionScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<WorkoutScreenNavigationProp<typeof WorkoutRoutes.Session>>();
  const { params } = useRoute<RouteProp<WorkoutStackParamList, typeof WorkoutRoutes.Session>>();
  const { sessionId } = params;
  const { user } = useAuthUser();
  const uid = user?.uid;

  // Opens the shared workouts store and checks it on focus, as the home does: a Session reached with the store
  // never opened (the Finish landing after a cold start) would otherwise wait on a window nothing loads.
  useRecentWorkouts(uid);
  // The compare, the arrows and a queued workout's verdicts read the exercise summaries, which only the Start
  // screen's plan cards and `startWorkout` open. Reached from History after a cold start nothing else has, and
  // the card said "not loaded yet" beside a Better word (found on the emulator). `open` reads the saved copy,
  // then checks (1 read when nothing changed), and never rejects.
  useEffect(() => {
    void useExerciseHistoryStore.getState().open(uid);
  }, [uid]);
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  const olderWorkouts = useRecentWorkoutsStore((s) => s.olderWorkouts);
  const waitOver = useRecentWorkoutsStore((s) => s.waitOver);
  const fetched = useRecentWorkoutsStore((s) => s.fetchedSessions[sessionId]);
  const pending = useWorkoutStore((s) => s.pendingUploads);
  const summaries = useExerciseHistoryStore((s) => (s.uid === uid ? s.byId : null));
  const [retrying, setRetrying] = useState(false);
  // True when this workout's upload showed the "Saved" toast, which then says what the banner would (PR #76 review).
  const toasted = useWorkoutStore((s) => s.toastedSessionId === sessionId);
  const [openCards, setOpenCards] = useState<ReadonlySet<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  // Counted up per opening, so the sheet remounts with the saved text and a cancelled draft is not kept.
  const [noteOpening, setNoteOpening] = useState<number | null>(null);

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

  const toggleCard = useCallback(
    (index: number) =>
      setOpenCards((open) => {
        const next = new Set(open);
        if (!next.delete(index)) next.add(index);
        return next;
      }),
    []
  );
  // `now` for the compare's year labels: read once when the screen opens.
  const [now] = useState(() => Date.now());

  /** Saves the note; returns why it failed, or null. Offline is refused here, not queued (`setWorkoutNote`). */
  const saveNote = async (text: string): Promise<string | null> => {
    const checked = normalizeNote(text);
    if (checked.kind === "tooLong" || !uid || !workout) return "That note cannot be saved.";
    try {
      await setWorkoutNote(uid, workout.session.sessionId, checked.note);
    } catch (error) {
      console.log("Failed to save note:", error);
      const code = (error as { code?: string })?.code;
      return code === "unavailable"
        ? "Needs a connection to save a note."
        : code === "not-found"
          ? "This workout is not on the server, so it cannot hold a note."
          : "Could not save the note. Try again.";
    }
    useRecentWorkoutsStore.getState().applyNote(uid, workout.session.sessionId, checked.note);
    setNoteOpening(null);
    return null;
  };

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
      {workout !== null && (
        <TouchableOpacity style={styles.optionsButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Session options">
          <Ionicons name="ellipsis-horizontal" size={22} color={t.colors.role.textSecondary} />
        </TouchableOpacity>
      )}
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
  const noteReason = state === "uploaded" ? null : "Available once the workout has uploaded.";
  const options = [
    [
      {
        key: "note",
        renderIcon: (color: string) => <Ionicons name="create-outline" size={22} color={color} />,
        title: session.note ? "Edit note" : "Add a note",
        detail: session.note ? undefined : "Saved with the workout",
        disabledReason: noteReason,
        onPress: () => setNoteOpening(Date.now()),
      },
    ],
    [
      {
        key: "edit",
        renderIcon: (color: string) => <Ionicons name="pencil-outline" size={22} color={color} />,
        title: "Edit session",
        disabledReason: "Not available yet.",
        onPress: () => {},
      },
      {
        key: "delete",
        renderIcon: (color: string) => <Ionicons name="trash-outline" size={22} color={color} />,
        title: "Delete session",
        tone: "danger" as const,
        disabledReason: "Not available yet.",
        onPress: () => {},
      },
    ],
  ];

  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.dateRow}>
        <TextBase style={styles.date}>{sessionDateLine(session.startedAt, session.endedAt)}</TextBase>
        {params.finished === true && state === "uploaded" && !toasted && (
          <TextBase style={styles.savedText} testID="session-saved">
            Workout saved
          </TextBase>
        )}
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
            {session.note ? <TextBase style={styles.note}>{session.note}</TextBase> : null}
            {summary !== null && (
              <View style={styles.summary}>
                <TextBase style={styles.headline}>{summary.headline}</TextBase>
                {summary.detail !== null && <TextBase style={styles.detail}>{summary.detail}</TextBase>}
              </View>
            )}
            {cards.map((card, index) => (
              <SessionLiftCard
                key={`${card.id}-${index}`}
                card={card}
                beat={session.lifts[index]?.verdict === "better"}
                open={openCards.has(index)}
                compare={
                  openCards.has(index)
                    ? liftCompare(session, session.lifts[index], summaries === null ? null : (id) => summaries[id] ?? null, now)
                    : null
                }
                onToggle={() => toggleCard(index)}
                onOpenHistory={() => navigation.navigate(WorkoutRoutes.Exercise, { exerciseId: card.id, exerciseName: card.name })}
              />
            ))}
          </>
        )}
      </ScrollView>
      <MenuSheet visible={menuOpen} title="Session" groups={options} onClose={() => setMenuOpen(false)} />
      {noteOpening !== null && (
        <SessionNoteSheet key={noteOpening} visible initial={session.note ?? ""} onSave={saveNote} onClose={() => setNoteOpening(null)} />
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.role.ground },
    // The 44 dp touch targets hold 22 dp icons, so the padding is the content's inset less the 11 dp each side of the icon:
    // the chevron and the ⋯ line up with the text edges beneath (they sat 7 dp inside them).
    header: { flexDirection: "row", alignItems: "center", height: 44, marginTop: SPACING.small, paddingHorizontal: SPACING.medium - 11, gap: SPACING.small },
    optionsButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
    note: { paddingHorizontal: SPACING.medium, paddingTop: SPACING.medium, fontSize: t.fonts.medium, color: t.colors.role.textPrimary },
    headerTitle: { flexShrink: 1, fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    headerHistory: { fontSize: t.fonts.large, color: t.colors.role.textSecondary },
    dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30, paddingTop: SPACING.xSmall, paddingHorizontal: SPACING.medium },
    date: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    savedText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
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
