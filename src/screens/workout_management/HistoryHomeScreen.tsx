import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { usePlansStore } from "../../stores/usePlansStore";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import { olderOf, useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { planFilterRows } from "../../utils/workoutWindow";
import { historyNotice } from "../../utils/historyNotice";
import { buildRail, mergePending, type RailRow, type RailWorkout } from "../../utils/historyRail";
import { WorkoutRoutes } from "../../constants/routes";
import { SPACING } from "../../constants/styles";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { TextBase } from "../../components/TextBase";
import LoadingData from "../../components/LoadingData";
import MenuSheet from "../../components/MenuSheet";
import { HistoryRailRow } from "../../components/history/HistoryRailRow";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

type NavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.HistoryHome>;

const ALL_WORKOUTS = "All workouts";

/**
 * The History home (TICKET-085a, boards HistHome01 to 25): the tabs, the plan filter, the notice strip and the
 * Workouts rail. The rows are `buildRail`'s (`utils/historyRail.ts`); this screen reads the stores, owns the
 * taps and the two things Back must find as they were left: the filter and which months are open. Both are
 * screen state, and the screen stays mounted under a deeper one (`singleCopy` in WorkoutNavigator). It always
 * opens on Workouts with All selected. The Exercises tab is switched off with its reason until 085b builds it.
 *
 * Reads the shared workouts store as the hub does (`useRecentWorkouts` checks it on focus): no read of its own
 * but a page of older workouts, on tap (`loadOlder`). The rail shows the window and the queue, never the floor:
 * a plan's old newest workout belongs to no month, and no count includes it.
 */
export default function HistoryHomeScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;

  // Called for its check on focus; the rail reads the window itself.
  useRecentWorkouts(uid);
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  const olderWorkouts = useRecentWorkoutsStore((s) => s.olderWorkouts);
  const waitOver = useRecentWorkoutsStore((s) => s.waitOver);
  const checkFailed = useRecentWorkoutsStore((s) => s.lastResult === "failed");
  const plans = usePlansStore((s) => s.plans);
  const pending = useWorkoutStore((s) => s.pendingUploads);
  const summaries = useExerciseHistoryStore((s) => (s.uid === uid ? s.byId : null));

  const [planId, setPlanId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openMonths, setOpenMonths] = useState<ReadonlySet<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  const filter = useMemo(() => (workoutWindow ? planFilterRows(workoutWindow, plans ?? []) : null), [workoutWindow, plans]);
  const older = olderOf(olderWorkouts, workoutWindow, planId);

  const rows = useMemo<RailRow[] | null>(() => {
    if (workoutWindow === null) return null;
    // Summaries not held: a queued workout's lifts stay pending, not a guessed First time.
    const held = mergePending(workoutWindow.sessions, pending, uid, summaries === null ? null : (id) => summaries[id] ?? null);
    const loaded: RailWorkout[] = (older?.sessions ?? []).map((session) => ({ session, state: "uploaded" }));
    return buildRail({
      held,
      older: loaded,
      now: Date.now(),
      openMonths,
      planId,
      reachedStart: workoutWindow.windowStart === null || older?.reachedStart === true,
    });
  }, [workoutWindow, pending, uid, summaries, older, openMonths, planId]);

  const notice = historyNotice(pending, uid, checkFailed);
  const filterRow = planId === null ? null : (filter?.rows.find((row) => row.planId === planId) ?? null);
  const filterLabel = filterRow?.label ?? ALL_WORKOUTS;
  // A count of what the phone holds is a total only once the start is reached.
  const planCount = filterRow ? filterRow.workoutCount + (older?.sessions.length ?? 0) : 0;
  const planCountText =
    workoutWindow && (workoutWindow.windowStart === null || older?.reachedStart)
      ? `${planCount} workout${planCount === 1 ? "" : "s"}`
      : `${planCount} on this phone`;

  const toggleMonth = useCallback(
    (month: string) =>
      setOpenMonths((open) => {
        const next = new Set(open);
        if (!next.delete(month)) next.add(month);
        return next;
      }),
    []
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

  const radio = (on: boolean) => (color: string) => <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={color} />;
  const filterItems = [
    { key: "all", title: ALL_WORKOUTS, renderIcon: radio(planId === null), onPress: () => setPlanId(null) },
    ...(filter?.rows ?? []).map((row) => ({
      key: row.planId,
      title: row.label,
      // Counts are of the workouts on the phone, not a total, once older months exist (`coversWholeHistory`).
      detail: `${row.workoutCount} on this phone`,
      renderIcon: radio(planId === row.planId),
      onPress: () => setPlanId(row.planId),
    })),
  ];

  const empty = rows !== null && rows.length === 0 && planId === null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TextBase style={styles.title} accessibilityRole="header">
          History
        </TextBase>
        <View style={styles.tabRow}>
          <View style={styles.tabs}>
            <View style={styles.tab} accessible accessibilityRole="tab" accessibilityState={{ selected: true }}>
              <TextBase style={styles.tabOn}>Workouts</TextBase>
              <View style={styles.tabUnderline} />
            </View>
            <View
              style={styles.tab}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ disabled: true }}
              accessibilityHint="The Exercises tab is not built yet"
            >
              <TextBase style={styles.tabOff}>Exercises</TextBase>
            </View>
          </View>
          <TouchableOpacity
            style={styles.filterPill}
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filter workouts, ${filterLabel}`}
          >
            <TextBase style={styles.filterText} numberOfLines={1}>
              {filterLabel}
            </TextBase>
            <Ionicons name="chevron-down" size={16} color={t.colors.role.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {notice && (
        <View style={[styles.notice, notice.kind === "didNotUpload" && styles.noticeDanger]} testID="history-notice">
          <Ionicons
            name={notice.kind === "didNotUpload" ? "alert-circle-outline" : "time-outline"}
            size={16}
            color={notice.kind === "didNotUpload" ? t.colors.role.danger : t.colors.role.textSecondary}
          />
          <TextBase style={styles.noticeText} numberOfLines={2}>
            {notice.text}
          </TextBase>
          {notice.tryAgain && (
            <TouchableOpacity onPress={tryAgain} disabled={retrying} accessibilityRole="button" accessibilityLabel="Try again">
              <TextBase style={styles.noticeAction}>Try again</TextBase>
            </TouchableOpacity>
          )}
        </View>
      )}

      {rows === null ? (
        <View style={styles.body}>
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
      ) : empty ? (
        <View style={styles.body}>
          <TextBase style={styles.emptyTitle}>No workouts yet</TextBase>
          <TouchableOpacity style={styles.startButton} onPress={() => navigation.navigate(WorkoutRoutes.WorkoutHome)} accessibilityRole="button">
            <TextBase style={styles.startText}>Start a workout</TextBase>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="history-list"
          style={styles.body}
          contentContainerStyle={styles.listEnd}
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={
            filterRow ? (
              <TextBase style={styles.filterSummary}>
                {filterRow.label} · {planCountText}
              </TextBase>
            ) : null
          }
          renderItem={({ item, index }) => (
            <HistoryRailRow
              row={item}
              joined={item.kind === "workout" && rows[index + 1]?.kind === "workout"}
              olderRead={older?.read ?? null}
              onOpenWorkout={(sessionId, workoutName, startedAt) =>
                navigation.navigate(WorkoutRoutes.Session, { sessionId, workoutName, startedAt })
              }
              onToggleMonth={toggleMonth}
              onLoadOlder={() => void useRecentWorkoutsStore.getState().loadOlder(planId)}
            />
          )}
        />
      )}

      <MenuSheet visible={filterOpen} title="Show workouts" groups={[filterItems]} onClose={() => setFilterOpen(false)} />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.role.ground },
    header: { paddingHorizontal: SPACING.xMedium, paddingTop: SPACING.large },
    title: { height: 44, lineHeight: 44, fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.role.textPrimary },
    tabRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
    tabs: { flexDirection: "row", gap: SPACING.xxLarge },
    tab: { height: 36, justifyContent: "center" },
    tabOn: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    tabOff: { fontSize: t.fonts.medium, color: t.colors.role.textSecondary },
    tabUnderline: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1, backgroundColor: t.colors.role.accent },
    filterPill: {
      height: 32,
      maxWidth: "55%",
      paddingHorizontal: SPACING.medium,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    filterText: { flexShrink: 1, fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
    notice: {
      height: 44,
      marginHorizontal: SPACING.xMedium,
      paddingHorizontal: SPACING.xMedium,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      backgroundColor: t.colors.role.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
    },
    noticeDanger: { borderColor: t.colors.role.danger },
    noticeText: { flex: 1, fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
    noticeAction: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
    body: { flex: 1, paddingHorizontal: SPACING.xMedium, paddingTop: SPACING.medium },
    listEnd: { paddingBottom: SPACING.xxLarge },
    loading: { paddingVertical: SPACING.xxxLarge, alignItems: "center" },
    message: { paddingVertical: SPACING.xxxLarge, textAlign: "center", fontSize: t.fonts.medium, color: t.colors.role.textSecondary },
    emptyTitle: { paddingTop: SPACING.xxxLarge, textAlign: "center", fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    startButton: {
      alignSelf: "center",
      marginTop: SPACING.large,
      height: 44,
      paddingHorizontal: SPACING.xLarge,
      borderRadius: 22,
      justifyContent: "center",
      backgroundColor: t.colors.role.accent,
    },
    startText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.ground },
    filterSummary: { paddingBottom: SPACING.medium, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
