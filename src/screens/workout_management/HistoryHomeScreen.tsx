import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { usePlansStore } from "../../stores/usePlansStore";
import { useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { planFilterRows } from "../../utils/workoutWindow";
import { historyNotice } from "../../utils/historyNotice";
import { WorkoutRoutes } from "../../constants/routes";
import { SPACING } from "../../constants/styles";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { TextBase } from "../../components/TextBase";
import LoadingData from "../../components/LoadingData";
import MenuSheet from "../../components/MenuSheet";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

type NavigationProp = WorkoutScreenNavigationProp<typeof WorkoutRoutes.HistoryHome>;

const ALL_WORKOUTS = "All workouts";

/**
 * The History home (TICKET-085a, boards HistHome01 to 13). Stage 1: the shell. The tabs, the plan
 * filter, the notice strip, and a TEMPORARY plain list of the held workouts so the `Session` route is
 * reachable by tapping; stage 2 replaces the list with the rail.
 *
 * Always opens on Workouts with All selected. Tab and filter are screen state, and the screen stays
 * mounted under a deeper one (`singleCopy` in WorkoutNavigator), so Back finds them as they were left.
 * The Exercises tab is shown switched off with its reason until 085b builds it.
 *
 * Reads the same shared workouts store as the hub (`useRecentWorkouts`, checked on focus): no read of
 * its own. Its list is the window plus each plan's floor entry; stage 2 reads the window itself.
 */
export default function HistoryHomeScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;

  const sessions = useRecentWorkouts(uid);
  const workoutWindow = useRecentWorkoutsStore((s) => (s.uid === uid ? s.workoutWindow : null));
  const waitOver = useRecentWorkoutsStore((s) => s.waitOver);
  const checkFailed = useRecentWorkoutsStore((s) => s.lastResult === "failed");
  const plans = usePlansStore((s) => s.plans);
  const pending = useWorkoutStore((s) => s.pendingUploads);

  const [planId, setPlanId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const filter = useMemo(() => (workoutWindow ? planFilterRows(workoutWindow, plans ?? []) : null), [workoutWindow, plans]);
  const shown = useMemo(
    () => (sessions ?? []).filter((session) => planId === null || session.workoutId === planId),
    [sessions, planId]
  );
  const notice = historyNotice(pending, uid, checkFailed);
  const filterLabel = planId === null ? ALL_WORKOUTS : (filter?.rows.find((row) => row.planId === planId)?.label ?? ALL_WORKOUTS);

  const tryAgain = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await drainPendingUploads();
    } finally {
      setRetrying(false);
    }
  };

  const filterItems = [
    {
      key: "all",
      title: ALL_WORKOUTS,
      renderIcon: (color: string) => <Ionicons name={planId === null ? "radio-button-on" : "radio-button-off"} size={20} color={color} />,
      onPress: () => setPlanId(null),
    },
    ...(filter?.rows ?? []).map((row) => ({
      key: row.planId,
      title: row.label,
      // Counts are of the workouts on the phone, not a total, once older months exist (`coversWholeHistory`).
      detail: `${row.workoutCount} on this phone`,
      renderIcon: (color: string) => <Ionicons name={planId === row.planId ? "radio-button-on" : "radio-button-off"} size={20} color={color} />,
      onPress: () => setPlanId(row.planId),
    })),
  ];

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

      {/* TEMPORARY — stage 2 replaces this list with the rail; remove it there. A FlatList, not a
          View with map: the held workouts run past one screen and must scroll. */}
      {sessions === null ? (
        <View style={styles.body}>
          {waitOver ? (
            <TextBase style={styles.empty}>Needs a connection, still trying</TextBase>
          ) : (
            <LoadingData
              containerStyle={styles.loading}
              textStyle={{ fontSize: t.fonts.large, color: t.colors.role.textPrimary }}
              dotStyle={{ fontSize: t.fonts.xLarge, color: t.colors.role.textPrimary }}
            />
          )}
        </View>
      ) : (
        <FlatList
          style={styles.body}
          contentContainerStyle={styles.listEnd}
          data={shown}
          keyExtractor={(session) => session.sessionId}
          ListEmptyComponent={<TextBase style={styles.empty}>No workouts yet</TextBase>}
          renderItem={({ item: session }) => (
            <TouchableOpacity
              testID={`history-row-${session.sessionId}`}
              style={styles.row}
              onPress={() =>
                navigation.navigate(WorkoutRoutes.Session, {
                  sessionId: session.sessionId,
                  workoutName: session.workoutName,
                  startedAt: session.startedAt,
                })
              }
              accessibilityRole="button"
            >
              <TextBase style={styles.rowName}>{session.workoutName}</TextBase>
              <TextBase style={styles.rowDate}>{new Date(session.startedAt).toLocaleDateString()}</TextBase>
            </TouchableOpacity>
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
    empty: { paddingVertical: SPACING.xxxLarge, textAlign: "center", fontSize: t.fonts.medium, color: t.colors.role.textSecondary },
    row: { paddingVertical: SPACING.medium, flexDirection: "row", justifyContent: "space-between" },
    rowName: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    rowDate: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
