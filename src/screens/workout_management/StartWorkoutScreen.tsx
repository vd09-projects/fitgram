import React, { useCallback, useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useWorkoutPlansOnFocus } from "../../hooks/useWorkoutPlansOnFocus";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentWorkouts } from "../../hooks/useRecentWorkouts";
import { SPACING } from "../../constants/styles";
import ScrollableScreen from "../../components/ScrollableScreen";
import { BackTitle } from "../../components/BackButton";
import SearchBox from "../../components/SearchBox";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { TextBase } from "../../components/TextBase";
import { DiscardWorkoutDialog } from "../../components/active_workout/DiscardWorkoutDialog";
import LoadingData from "../../components/LoadingData";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { START_WOURKOUT_STEP_NAMES } from "../../tour_steps/startWorkout";
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";
import { ResumeBanner } from "../../components/start_workout/ResumeBanner";
import { PlanRow } from "../../components/start_workout/PlanRow";
import { PlanCard } from "../../components/start_workout/PlanCard";
import { buildPlanRows, groupPlanRows, PlanRow as PlanRowModel } from "../../utils/startWorkout";
import { isArchived } from "../../types/workoutType";
import { ShowArchivedToggle } from "../../components/ShowArchivedToggle";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<
  typeof WorkoutRoutes.StartWorkout
>;

const HIT = 44;

export default function StartWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;

  const { cancelWorkout, activeWorkout, pendingUploads } = useWorkoutStore();
  // Checked on focus: this screen stays mounted under the Workout tab (TICKET-070 D4).
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlansOnFocus();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // TICKET-061: archived plans start hidden on every visit, so they cannot
  // creep back into the list on their own.
  const [showArchived, setShowArchived] = useState(false);
  useFocusEffect(useCallback(() => setShowArchived(false), []));

  const sessions = useRecentWorkouts(uid);

  const rows = useMemo(
    () =>
      buildPlanRows(workoutPlans, sessions, pendingUploads, uid, searchQuery),
    [workoutPlans, sessions, pendingUploads, uid, searchQuery],
  );
  const groups = useMemo(() => groupPlanRows(rows, showArchived), [rows, showArchived]);
  const archivedCount = useMemo(() => workoutPlans.filter(isArchived).length, [workoutPlans]);
  const allArchived = workoutPlans.length > 0 && archivedCount === workoutPlans.length;
  const query = searchQuery.trim();
  const plansById = useMemo(
    () => new Map(workoutPlans.map((plan) => [plan.id, plan])),
    [workoutPlans],
  );

  // The open card is derived on every render, never cleared by an effect
  // (TICKET-019's review): a plan hidden by the search or Show archived, or
  // deleted, simply has no card. Rejected: clearing `selectedId` in an effect
  // when the plan leaves the list, one more lifecycle rule for the same result.
  const visible = [...groups.plans, ...groups.archived];
  const selectedRow = visible.find((row) => row.id === selectedId) ?? null;
  const selectedPlan = selectedRow ? (plansById.get(selectedRow.id) ?? null) : null;

  // The card runs the exercise summaries check on open (PlanCard).
  const openCard = (planId: string) => setSelectedId(planId);

  const renderRow = (row: PlanRowModel) => (
    <PlanRow key={row.id} row={row} now={now} onPress={() => openCard(row.id)} />
  );

  const setsLogged =
    activeWorkout?.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.length,
      0,
    ) ?? 0;
  const now = Date.now();

  return (
    <View style={styles.screen}>
      <ScrollableScreen
        style={styles.scroll}
        innerContainerStyle={styles.inner}
      >
        <BackTitle>
          <TextBase style={styles.title}>All plans</TextBase>
        </BackTitle>

        {/* Unfinished-work banners. Only the resume banner is built here;
            TICKET-029's pending-uploads count belongs beside it in this stack,
            which is why this is a stack and not a single slot. */}
        {activeWorkout && (
          <View style={styles.bannerStack}>
            <ResumeBanner
              workoutName={activeWorkout.name}
              startTime={activeWorkout.startTime}
              setsLogged={setsLogged}
              onResume={() => navigation.navigate(WorkoutRoutes.LogWorkout)}
              onDiscard={() => setConfirmDiscard(true)}
            />
          </View>
        )}

        <SearchBox
          value={searchQuery}
          onChangeText={setSearchQuery}
          label="Search plans"
          placeholder="Plan name"
          tourStepPrefix={START_WOURKOUT_STEP_NAMES.SEARCH_BOX}
        />

        {/* Outer View is a plain anchor for the tour: MultiTourSteps moves every
            style key but align/flexDirection/height onto its own wrapper, so a
            `gap` set here directly would space the wrapper's single child and
            leave the rows touching. */}
        <MaybeTourStep
          stepId={START_WOURKOUT_STEP_NAMES.SEARCHED_WORKOUT_ITEMS}
        >
          <View>
            <View style={styles.plans}>
              <View style={styles.plansHeader}>
                <TextBase style={styles.sectionLabel}>YOUR PLANS</TextBase>
                {!loadingWorkoutPlans && (
                  <TextBase numeric style={styles.count}>
                    {groups.plans.length}
                  </TextBase>
                )}
                <View style={styles.headerSpacer} />
                {!loadingWorkoutPlans && archivedCount > 0 && (
                  <ShowArchivedToggle
                    shown={showArchived}
                    onPress={() => setShowArchived((shown) => !shown)}
                    size="xSmall"
                  />
                )}
              </View>

              {loadingWorkoutPlans ? (
                <LoadingData
                  containerStyle={styles.loading}
                  textStyle={{
                    fontSize: t.fonts.large,
                    color: t.colors.role.textPrimary,
                  }}
                  dotStyle={{
                    fontSize: t.fonts.xLarge,
                    color: t.colors.role.textPrimary,
                  }}
                />
              ) : workoutPlans.length === 0 ? (
                <View style={styles.empty}>
                  <TextBase style={styles.emptyTitle}>No plans yet</TextBase>
                  <TextBase style={styles.emptyBody}>
                    Build a plan in Manage Workout, then start it from here.
                  </TextBase>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() =>
                      navigation.navigate(WorkoutRoutes.AddExercise)
                    }
                    accessibilityRole="button"
                  >
                    <TextBase style={styles.secondaryButtonText}>
                      Create a plan
                    </TextBase>
                  </TouchableOpacity>
                </View>
              ) : allArchived && !showArchived && query === "" ? (
                // Not "No plans yet", which would be false (TICKET-061).
                <View style={styles.empty}>
                  <TextBase style={styles.emptyTitle}>
                    All your plans are archived
                  </TextBase>
                  <TextBase style={styles.emptyBody}>
                    Use Show archived above to start one.
                  </TextBase>
                </View>
              ) : visible.length === 0 ? (
                <View style={styles.noMatch}>
                  <TextBase style={styles.noMatchText}>
                    No plans match “{query}”
                  </TextBase>
                  {/* Search follows the toggle, but never dead-ends on a plan
                      the user archived: say it is there, point at the toggle. */}
                  {groups.hiddenArchived > 0 && (
                    <TextBase style={styles.emptyBody}>
                      {groups.hiddenArchived === 1
                        ? "1 archived plan matches. Show archived to see it."
                        : `${groups.hiddenArchived} archived plans match. Show archived to see them.`}
                    </TextBase>
                  )}
                </View>
              ) : (
                <>
                  {groups.plans.map(renderRow)}
                  {groups.archived.length > 0 && (
                    <View style={styles.archivedHeader}>
                      <TextBase style={styles.sectionLabel}>ARCHIVED</TextBase>
                      <TextBase numeric style={styles.count}>
                        {groups.archived.length}
                      </TextBase>
                    </View>
                  )}
                  {groups.archived.map(renderRow)}
                </>
              )}
            </View>
          </View>
        </MaybeTourStep>
      </ScrollableScreen>

      <PlanCard
        plan={selectedPlan}
        row={selectedRow}
        sessionsKnown={sessions !== null}
        onClose={() => setSelectedId(null)}
      />

      <DiscardWorkoutDialog
        visible={confirmDiscard}
        keepLabel="Keep it"
        onKeep={() => setConfirmDiscard(false)}
        onDiscard={async () => {
          setConfirmDiscard(false);
          await cancelWorkout();
        }}
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
      gap: SPACING.large,
    },
    title: {
      fontSize: 26,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
      textAlign: "center",
    },
    bannerStack: {
      gap: SPACING.small,
    },
    plans: {
      gap: SPACING.medium,
    },
    // Holds the 44 px Show archived toggle, so it centres rather than
    // baseline-aligns; the label and count keep their own gap.
    plansHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      minHeight: 18,
    },
    headerSpacer: {
      flex: 1,
    },
    archivedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
      marginTop: SPACING.small,
    },
    noMatch: {
      gap: SPACING.xSmall,
    },
    noMatchText: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textPrimary,
    },
    sectionLabel: {
      fontSize: t.fonts.xSmall,
      fontWeight: "bold",
      letterSpacing: 1.5,
      color: t.colors.role.textSecondary,
    },
    count: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    loading: {
      paddingVertical: SPACING.xxxLarge,
      alignItems: "center",
    },
    empty: {
      padding: SPACING.large,
      gap: SPACING.small,
      borderRadius: 16,
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
    },
    emptyTitle: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    emptyBody: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    secondaryButton: {
      marginTop: SPACING.small,
      minHeight: HIT,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
  });
