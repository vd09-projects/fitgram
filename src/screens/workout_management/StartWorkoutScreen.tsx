import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import useWorkoutPlans from "../../hooks/useWorkoutPlans";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useRecentSessions } from "../../hooks/useRecentSessions";
import { SPACING } from "../../constants/styles";
import ScrollableScreen from "../../components/ScrollableScreen";
import SearchBox from "../../components/SearchBox";
import { useWorkoutStore } from "../../stores/useWorkoutStore";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import show from "../../utils/toastUtils";
import { WorkoutRoutes } from "../../constants/routes";
import { WorkoutScreenNavigationProp } from "../../navigation/WorkoutNavigator";
import { TextBase } from "../../components/TextBase";
import AlertBase from "../../components/AlertBase";
import LoadingData from "../../components/LoadingData";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { START_WOURKOUT_STEP_NAMES } from "../../tour_steps/startWorkout";
import { MaybeTourStep } from "../../components/guide_tour/MaybeTourStep";
import { ResumeBanner } from "../../components/start_workout/ResumeBanner";
import { PlanRow } from "../../components/start_workout/PlanRow";
import { buildPlanRows } from "../../utils/startWorkout";

type workoutScreenNavigationProp = WorkoutScreenNavigationProp<
  typeof WorkoutRoutes.StartWorkout
>;

const HIT = 44;

export default function StartWorkoutScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const navigation = useNavigation<workoutScreenNavigationProp>();
  const { user } = useAuthUser();
  const uid = user?.uid;

  const { startWorkout, cancelWorkout, activeWorkout, pendingUploads } =
    useWorkoutStore();
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlans(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [starting, setStarting] = useState(false);

  const myPendingCount = pendingUploads.filter(
    (entry) => entry.uid === uid,
  ).length;
  const sessions = useRecentSessions(uid, myPendingCount);

  const rows = useMemo(
    () =>
      buildPlanRows(workoutPlans, sessions, pendingUploads, uid, searchQuery),
    [workoutPlans, sessions, pendingUploads, uid, searchQuery],
  );
  const plansById = useMemo(
    () => new Map(workoutPlans.map((plan) => [plan.id, plan])),
    [workoutPlans],
  );

  // Selection is derived on every render, never cleared by a remount or an
  // effect (TICKET-019's review): a plan hidden by the search, or deleted, is
  // simply not selected, so the bottom bar can never name a plan the user cannot
  // see. Rejected: clearing `selectedId` in an effect when the plan leaves the
  // list — one more lifecycle rule to keep right, for the same visible result.
  const selectedPlan =
    selectedId !== null && rows.some((row) => row.id === selectedId)
      ? (plansById.get(selectedId) ?? null)
      : null;

  const toggleSelection = (planId: string) => {
    if (selectedId === planId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(planId);
    // The one history read for this plan: a batched query, one doc per
    // exercise. The same prefetch `startWorkout` makes, so a plan started after
    // selecting it begins with its ghost targets already warm. Never on mount —
    // warming every plan is a large read for a screen the user may pass through.
    const plan = plansById.get(planId);
    useExerciseHistoryStore
      .getState()
      .prefetchExerciseHistory(
        uid,
        plan?.exercises.map((exercise) => exercise.id),
      )
      .catch(() => {});
  };

  const isResume =
    !!activeWorkout && !!selectedPlan && activeWorkout.id === selectedPlan.id;
  const blockedBy =
    !!activeWorkout && !!selectedPlan && !isResume ? activeWorkout : null;

  const handlePrimary = async () => {
    if (!selectedPlan) return;
    if (isResume) {
      navigation.navigate(WorkoutRoutes.LogWorkout);
      return;
    }
    // Disabled while blocked; this guards a press that lands mid-render.
    if (blockedBy || starting) return;
    setStarting(true);
    try {
      await startWorkout(selectedPlan);
    } catch (error) {
      console.error("Could not start workout:", error);
      show.alert("Could not start workout", "Please try again.");
      return;
    } finally {
      setStarting(false);
    }
    // Cleared explicitly: coming back to this screen should not show a stale
    // "Start" for the plan that is now the active workout.
    setSelectedId(null);
    show.info("Starting workout", selectedPlan.name);
    navigation.navigate(WorkoutRoutes.LogWorkout);
  };

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
        <TextBase style={styles.title}>Start workout</TextBase>

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
                    {rows.length}
                  </TextBase>
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
              ) : rows.length === 0 ? (
                <TextBase style={styles.emptyBody}>
                  No plans match “{searchQuery.trim()}”
                </TextBase>
              ) : (
                rows.map((row) => (
                  <PlanRow
                    key={row.id}
                    row={row}
                    exercises={plansById.get(row.id)?.exercises ?? []}
                    expanded={row.id === selectedPlan?.id}
                    now={now}
                    onPress={() => toggleSelection(row.id)}
                    exerciseListTourStepId={
                      START_WOURKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE_LIST
                    }
                  />
                ))
              )}
            </View>
          </View>
        </MaybeTourStep>
      </ScrollableScreen>

      {selectedPlan && (
        <View style={styles.footer}>
          {blockedBy && (
            <TextBase style={styles.blockedReason}>
              {blockedBy.name} is still in progress. Resume or discard it before
              starting another.
            </TextBase>
          )}
          <MaybeTourStep
            stepId={START_WOURKOUT_STEP_NAMES.START_SELECTED_WORKOUT_BUTTON}
            positionType="above"
          >
            {/* Plain View: MultiTourSteps splits its child's style (see ActiveWorkoutScreen). */}
            <View>
              <TouchableOpacity
                style={[
                  styles.primary,
                  (blockedBy || starting) && styles.primaryDisabled,
                ]}
                onPress={handlePrimary}
                disabled={!!blockedBy || starting}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !!blockedBy || starting,
                  busy: starting,
                }}
              >
                <TextBase
                  style={[
                    styles.primaryText,
                    (blockedBy || starting) && styles.primaryTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {isResume ? "Resume" : "Start"} {selectedPlan.name}
                </TextBase>
              </TouchableOpacity>
            </View>
          </MaybeTourStep>
        </View>
      )}

      <AlertBase
        visible={confirmDiscard}
        title="Discard this workout?"
        message="Every set logged in this session will be deleted. This cannot be undone."
        onRequestClose={() => setConfirmDiscard(false)}
        containerStyle={styles.alertCard}
        titleStyle={styles.alertTitle}
        messageStyle={styles.alertMessage}
        buttons={[
          {
            text: "Keep it",
            onPress: () => setConfirmDiscard(false),
            style: styles.alertKeep,
            textStyle: styles.alertKeepText,
          },
          {
            text: "Discard",
            onPress: async () => {
              setConfirmDiscard(false);
              await cancelWorkout();
            },
            style: styles.alertDiscard,
            textStyle: styles.alertDiscardText,
          },
        ]}
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
    plansHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
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
    footer: {
      gap: SPACING.small,
      paddingTop: SPACING.medium,
      paddingHorizontal: SPACING.large,
      paddingBottom: SPACING.xxLarge,
      backgroundColor: t.colors.role.surface,
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    blockedReason: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
      textAlign: "center",
    },
    primary: {
      height: 56,
      borderRadius: 15,
      paddingHorizontal: SPACING.large,
      backgroundColor: t.colors.role.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    // Not just dimmed accent: a disabled control should not read as the primary
    // action, and the reason above says why it is off.
    primaryDisabled: {
      backgroundColor: t.colors.role.raised,
    },
    primaryText: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
    primaryTextDisabled: {
      color: t.colors.role.textSecondary,
    },
    alertCard: {
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
    },
    alertTitle: {
      color: t.colors.role.textPrimary,
    },
    alertMessage: {
      color: t.colors.role.textSecondary,
    },
    alertKeep: {
      minHeight: HIT,
      backgroundColor: t.colors.role.raised,
    },
    alertKeepText: {
      color: t.colors.role.textPrimary,
    },
    alertDiscard: {
      minHeight: HIT,
      backgroundColor: t.colors.role.danger,
    },
    alertDiscardText: {
      color: t.colors.role.ground,
    },
  });
