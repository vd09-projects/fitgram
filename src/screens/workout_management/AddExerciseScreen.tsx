import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, usePreventRemove } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  InteractionManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BORDER_RADIUS, SPACING } from '../../constants/styles';
import ScrollableScreen from '../../components/ScrollableScreen';
import useWorkoutPlans from '../../hooks/useWorkoutPlans';
import show from '../../utils/toastUtils';
import { newPlanId, overrideWorkoutDetails } from '../../services/db/userDB';
import { useAuthUser } from '../../hooks/useAuthUser';
import { WorkoutScreenNavigationProp } from '../../navigation/WorkoutNavigator';
import PlanExerciseList from '../../components/PlanExerciseList';
import { DiscardWorkoutDialog } from '../../components/active_workout/DiscardWorkoutDialog';
import { Exercise, WorkoutPlan } from '../../types/workoutType';
import { TextBase } from '../../components/TextBase';
import { ReturnTypeUseThemeTokens } from '../../components/app_manager/ThemeContext';
import { useThemeStyles } from '../../utils/useThemeStyles';
import { MANAGE_WOURKOUT_STEP_NAMES } from '../../tour_steps/manageWorkout';
import { MaybeTourStep } from '../../components/guide_tour/MaybeTourStep';
import { useCatalogStore } from '../../stores/useCatalogStore';
import {
  DraftExercise,
  PlanDraft,
  addExercise,
  draftFromPlan,
  isDraftDirty,
  newPlan,
  planFromDraft,
  raceSave,
  refusedSaveMessage,
  removeExercise,
  setExerciseFields,
  setPendingField,
  validateDraft,
} from '../../utils/planDraft';
import { customExercisesFromPlans } from '../../utils/exerciseSearch';
import { exerciseDisplayName } from '../../utils/catalog';
import ExercisePicker from '../../components/exercise_picker/ExercisePicker';
import { preparePicker } from '../../utils/pickerData';
import { useRecentSessions } from '../../hooks/useRecentSessions';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { buildRecentHistory } from '../../utils/recents';
import { TouchableOpacityBase } from '../../components/TouchableOpacityBase';
import { makeStepId } from '../../tour_steps/utils';
import { SEARCHABLE_INPUT_STEP_NAMES } from '../../tour_steps/commonStepNames';
import PlanSheet from '../../components/PlanSheet';
import PlanNameField from '../../components/PlanNameField';
import LoadingData from '../../components/LoadingData';

// A discard waiting on the user: leaving the screen, or switching plan.
// `stillSaving`: the draft is exactly the plan whose write is queued offline,
// so nothing is thrown away; the dialog says so instead of "Discard".
type PendingDiscard =
  | { kind: 'leave'; proceed: () => void; stillSaving: boolean }
  | { kind: 'switch'; plan: WorkoutPlan; stillSaving: boolean };

// A write that outlived Save's grace (offline rule, D4): still queued in
// Firestore's memory cache, landing when the connection returns.
type QueuedWrite = { plan: WorkoutPlan; write: Promise<void> };

export default function AddExerciseScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { user } = useAuthUser();
  const navigation = useNavigation<WorkoutScreenNavigationProp<'AddExercise'>>();

  const [sheetOpen, setSheetOpen] = useState(false);
  // TICKET-051 D1: the plan as last saved, and the copy being edited. The
  // loaded plan object is never mutated; Save writes `planFromDraft(draft)`.
  const [saved, setSaved] = useState<WorkoutPlan | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Row errors appear after a refused Save, not while the user is typing.
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard | null>(null);
  // A ref, not state: nothing renders from it, and a late landing must see the
  // current value, not the one from the render that queued it.
  const queuedRef = useRef<QueuedWrite | null>(null);
  // EXPERIMENT (user, 2026-10-28): the floating footer's measured height.
  const [footerHeight, setFooterHeight] = useState(0);

  const [reload, setReload] = useState<boolean>(false);

  // The exercise picker (TICKET-043) replaced TICKET-042's interim dropdown of
  // all 805 versions and its "New" switch: no new custom exercises (TICKET-045);
  // existing ones are found by name.
  const catalog = useCatalogStore((s) => s.catalog);
  const catalogLoaded = useCatalogStore((s) => s.cacheLoaded);
  const searchWords = useCatalogStore((s) => s.searchWords);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { workoutPlans, loadingWorkoutPlans, failedToLoad } = useWorkoutPlans(reload);
  const customExercises = useMemo(() => customExercisesFromPlans(workoutPlans), [workoutPlans]);
  // From the draft (D3): a version added and not yet saved is greyed, one
  // removed in the draft can be picked again.
  const inPlan = useMemo(() => new Set((draft?.exercises ?? []).map((e) => e.id)), [draft]);

  // D5: the banner shows only for the plan that has a workout running.
  const activeWorkoutId = useWorkoutStore((s) => s.activeWorkout?.id ?? null);
  const runningHere = draft !== null && activeWorkoutId === draft.id;

  const dirty = useMemo(() => (saved && draft ? isDraftDirty(saved, draft) : false), [saved, draft]);
  const errors = useMemo(() => (draft ? validateDraft(draft) : null), [draft]);

  // The picker's Recent and last-used versions (TICKET-050). The same hook as
  // Start: one recent-sessions query each time Manage Workout comes into view
  // or an upload lands, none per picker open or keystroke. Rejected (after
  // approval, 2026-10-27): sharing Start's result through a store, which went
  // stale when a workout uploaded while Start was not mounted, so Recent
  // missed it. Null until the query returns, or after it fails: no Recent.
  const uid = user?.uid;
  const pendingUploads = useWorkoutStore((s) => s.pendingUploads);
  const myPendingCount = pendingUploads.filter((entry) => entry.uid === uid).length;
  const sessions = useRecentSessions(uid, myPendingCount);
  const recentHistory = useMemo(
    () => (catalog ? buildRecentHistory(sessions, pendingUploads, uid, catalog.index, customExercises) : null),
    [catalog, sessions, pendingUploads, uid, customExercises]
  );

  // Build the picker's search catalog and A–Z list once the screen has
  // settled, so tapping Exercise does not pay for it (device, 2026-10-27).
  useEffect(() => {
    if (!catalog) return;
    const task = InteractionManager.runAfterInteractions(() =>
      preparePicker(catalog.movements, searchWords?.words ?? null, customExercises)
    );
    return () => task.cancel();
  }, [catalog, searchWords, customExercises]);

  // One meta read each time Manage Workout opens (TICKET-042); the catalog
  // itself is fetched only if its hash changed.
  useFocusEffect(useCallback(() => { useCatalogStore.getState().sync(); }, []));

  // D1: leaving with unsaved changes asks first. Covers the back button,
  // hardware back and gestures (Manage is a stack screen). Dispatching the
  // held action is the documented way through once the user confirms.
  usePreventRemove(dirty, ({ data }) => {
    setPendingDiscard({ kind: 'leave', proceed: () => navigation.dispatch(data.action), stillSaving: draftIsQueued() });
  });

  /**
   * Is the draft exactly the plan whose write is still queued? Then leaving
   * loses nothing while the app stays open, and "Discard changes?" would be
   * false (device review, round 1). Edited after that save: it is a discard.
   */
  const draftIsQueued = () => {
    const queued = queuedRef.current;
    return !!queued && !!draft && queued.plan.id === draft.id && !isDraftDirty(queued.plan, draft);
  };

  const handleReload = () => setReload((prev) => !prev);

  const openPlan = (plan: WorkoutPlan) => {
    setSaved(plan);
    setDraft(draftFromPlan(plan));
    setExpandedId(null);
    setShowErrors(false);
  };

  // From the sheet, a saved plan or a new one: either way 051's "Discard
  // changes?" comes first if the open draft has edits.
  const handleSelectWorkout = (plan: WorkoutPlan) => {
    setSheetOpen(false);
    if (dirty) setPendingDiscard({ kind: 'switch', plan, stillSaving: draftIsQueued() });
    else openPlan(plan);
  };

  /**
   * TICKET-052: a new plan opens empty under a generated id (D1), checked
   * against the loaded plans (D2). Not stored until Save changes, which needs
   * its first exercise (D6 b); left empty, it is not dirty, so leaving or
   * switching drops it without asking (D3). The picker does not open (D4).
   */
  const handleCreatePlan = (name: string): string | null => {
    if (!uid) return 'Not signed in.';
    const result = newPlan(name, workoutPlans, () => newPlanId(uid));
    if (result.ok === false) return result.error;
    handleSelectWorkout(result.plan);
    return null;
  };

  // D5: what the top of the screen shows. A plan open wins; otherwise the
  // first-plan form only when the plans loaded, and there are none. A failed
  // load also leaves the list empty, so it is checked first.
  const mode = draft ? 'plan' : loadingWorkoutPlans ? 'loading' : failedToLoad ? 'failed' : workoutPlans.length === 0 ? 'first' : 'choose';

  const confirmDiscard = () => {
    const pending = pendingDiscard;
    setPendingDiscard(null);
    if (pending?.kind === 'leave') pending.proceed();
    if (pending?.kind === 'switch') openPlan(pending.plan);
  };

  /**
   * The plan reached the server. Rebases only if the same plan is still open:
   * a write that lands late (offline rule) must not overwrite another plan's
   * baseline. The draft is refreshed (new saved names, D2) only if it was not
   * edited since; if it was, it stays dirty against the new baseline.
   */
  const onSaved = (plan: WorkoutPlan) => {
    // D5's running-workout note is the banner, before editing; a longer toast
    // was cut off on the device (round 1).
    show.success('Plan saved', `"${plan.name}" saved.`);
    setSaved((prev) => (prev?.id === plan.id ? plan : prev));
    setDraft((prev) => (prev?.id === plan.id && !isDraftDirty(plan, prev) ? draftFromPlan(plan) : prev));
    handleReload();
  };

  const handleSave = async () => {
    if (!draft || !errors || saving) return;
    if (!errors.ok) {
      setShowErrors(true);
      const firstRow = Object.keys(errors.rows)[0];
      if (firstRow) setExpandedId(firstRow);
      // Names the exercise: the toast sits at the bottom, so "marked below"
      // pointed away from the row (device review, round 1).
      const nameOf = (exercise: DraftExercise) => exerciseDisplayName(exercise, catalog?.index ?? null).title;
      return show.alert('Plan not saved', refusedSaveMessage(draft, errors, nameOf));
    }

    const plan = planFromDraft(draft);
    // A retry of the write already queued races that write again rather than
    // queueing a second one: its own handler reports the landing, so there is
    // one "Plan saved", not two (device review, round 1).
    const queued = draftIsQueued() ? queuedRef.current : null;
    const write = queued ? queued.write : overrideWorkoutDetails(uid ?? '', plan);
    setSaving(true);
    try {
      // Offline rule (D4): `setDoc` does not settle while offline, so the wait
      // is bounded. The write stays queued and may still land; the draft stays
      // dirty until it does, so Save can be retried.
      const result = await raceSave(write);
      if (result === 'pending')
        show.warn('Not saved yet', 'Check your connection. Your changes are still here; tap Save changes to retry.');
      if (queued) return;
      if (result === 'saved') {
        onSaved(plan);
        return;
      }
      queuedRef.current = { plan, write };
      write
        .then(
          () => onSaved(plan),
          (error) => {
            console.error('Could not save plan:', error);
            show.alert('Could not save plan', 'Please try again.');
          }
        )
        .finally(() => {
          if (queuedRef.current?.write === write) queuedRef.current = null;
        });
    } catch (error) {
      // A queued write's rejection is reported by its own handler, above.
      if (!queued) {
        console.error('Could not save plan:', error);
        show.alert('Could not save plan', 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePick = (exercise: Exercise) => {
    setPickerOpen(false);
    if (!draft) return;
    setDraft(addExercise(draft, exercise, exercise.nameSnapshot ?? exercise.name));
    // The exercise arrives expanded with its catalog fields (board C1).
    setExpandedId(exercise.id);
  };

  const handleToggle = (exerciseId: string) => {
    // The add box lives in the editor and unmounts on collapse, so text typed
    // there and not committed goes with it rather than saving unseen.
    if (draft && expandedId !== null) setDraft(setPendingField(draft, expandedId, ''));
    setExpandedId(expandedId === exerciseId ? null : exerciseId);
  };

  return (
    <View style={styles.root}>
      <ScrollableScreen
        title={<TextBase style={styles.heading}>Manage Workout</TextBase>}
        // EXPERIMENT: the footer floats over the list, so the list ends with
        // room for it; otherwise the last row could never scroll clear.
        innerContainerStyle={draft ? { paddingBottom: footerHeight } : undefined}>

        {/* D5: a running workout keeps the snapshot it took at Start; say so
            before editing, not in a toast after (device review, round 1). */}
        {runningHere && (
          <View style={styles.banner} accessibilityRole="alert">
            <Ionicons name="information-circle-outline" size={20} color={t.colors.role.textSecondary} />
            <TextBase style={styles.bannerText}>
              Workout in progress on this plan. Changes apply from your next start.
            </TextBase>
          </View>
        )}

        {mode === 'loading' && <LoadingData containerStyle={styles.loading} />}

        {mode === 'failed' && (
          <View style={styles.loadError}>
            <TextBase style={styles.loadErrorText}>Couldn't load plans.</TextBase>
            <TouchableOpacityBase onPress={handleReload} accessibilityRole="button" style={styles.retry}>
              <TextBase style={styles.retryText}>Retry</TextBase>
            </TouchableOpacityBase>
          </View>
        )}

        {/* 🔹 No plans yet (board ManageFirst): no picker to open, so name one here. */}
        {mode === 'first' && (
          <View style={styles.first}>
            <TextBase style={styles.firstTitle}>Your first plan</TextBase>
            <TextBase style={styles.firstBody}>Name it, then add its exercises.</TextBase>
            <PlanNameField label="Plan name" placeholder="e.g. Push · Chest & Triceps" onCreate={handleCreatePlan} />
          </View>
        )}

        {/* 🔹 Plan: opens the plan sheet. Keeps the old plan dropdown's tour step id. */}
        {(mode === 'choose' || mode === 'plan') && (
          <MaybeTourStep
            stepId={makeStepId(SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON, MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_SEARCHABLE)}
          >
            <View>
              <TextBase style={styles.planLabel}>Plan</TextBase>
              <TouchableOpacityBase
                style={styles.planField}
                onPress={() => setSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={draft ? `Plan: ${draft.name}` : 'Choose a plan'}
              >
                <TextBase style={[styles.planName, !draft && styles.planPlaceholder]} numberOfLines={1}>
                  {draft ? draft.name : 'Choose a plan'}
                </TextBase>
                <Ionicons name="chevron-down" size={18} color={t.colors.role.textSecondary} />
              </TouchableOpacityBase>
            </View>
          </MaybeTourStep>
        )}

        {draft && (
          <>
            <TextBase style={styles.fieldTitle}>
              Exercises{draft.exercises.length > 0 ? ` · ${draft.exercises.length}` : ''}
            </TextBase>
            <PlanExerciseList
              exercises={draft.exercises}
              expandedId={expandedId}
              rowErrors={showErrors && errors ? errors.rows : {}}
              onToggle={handleToggle}
              onFieldsChange={(id, fields) => setDraft(setExerciseFields(draft, id, fields))}
              onPendingChange={(id, text) => setDraft(setPendingField(draft, id, text))}
              onRemove={(id) => {
                setDraft(removeExercise(draft, id));
                setExpandedId(null);
              }}
            />

            {/* 🔹 Add exercise: opens the picker. Keeps the old Exercise button's tour step id. */}
            <MaybeTourStep
              stepId={makeStepId(SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON, MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE)}
              positionType="above"
            >
              {/* Plain View, as Save below: the split left the touchable
                  shrink-wrapped to its label inside the dashed box. */}
              <View>
                <TouchableOpacityBase
                  style={styles.addButton}
                  onPress={() => setPickerOpen(true)}
                  disabled={!catalogLoaded || !catalog}
                  accessibilityRole="button"
                  accessibilityLabel="Add exercise"
                >
                  <Ionicons name="add" size={20} color={t.colors.role.textSecondary} />
                  <TextBase style={styles.addButtonText}>
                    {catalogLoaded && !catalog ? "Exercise catalog not loaded yet" : "Add exercise"}
                  </TextBase>
                </TouchableOpacityBase>
              </View>
            </MaybeTourStep>

            {showErrors && errors?.plan && <TextBase style={styles.planError}>{errors.plan}</TextBase>}
          </>
        )}
      </ScrollableScreen>

      {/* 🔹 Save changes: the whole plan, enabled only when there is something to write (D4). */}
      {draft && (
        <View style={styles.footer} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          <MaybeTourStep stepId={MANAGE_WOURKOUT_STEP_NAMES.SAVE_BUTTON} positionType='above'>
            {/* Plain View: MultiTourSteps splits its child's style, which put the
                fill on the wrapper and left the label at the top of the button
                (device, 2026-10-28). As on Start and Active Workout. */}
            <View>
              <TouchableOpacityBase
                style={[styles.primary, (!dirty || saving) && styles.primaryDisabled]}
                onPress={handleSave}
                disabled={!dirty || saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: !dirty || saving }}
              >
                <TextBase style={[styles.primaryText, (!dirty || saving) && styles.primaryTextDisabled]}>
                  {saving ? 'Saving…' : 'Save changes'}
                </TextBase>
              </TouchableOpacityBase>
            </View>
          </MaybeTourStep>
        </View>
      )}

      {sheetOpen && (
        <PlanSheet
          plans={workoutPlans}
          selectedId={draft?.id ?? null}
          onSelect={handleSelectWorkout}
          onCreate={handleCreatePlan}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {pickerOpen && (
        <ExercisePicker
          movements={catalog?.movements ?? null}
          searchWords={searchWords?.words ?? null}
          customExercises={customExercises}
          inPlan={inPlan}
          recentHistory={recentHistory}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
          tourStepPrefix={MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_PICKER}
        />
      )}

      <DiscardWorkoutDialog
        visible={pendingDiscard !== null}
        {...(pendingDiscard?.stillSaving
          ? {
              title: 'Still saving',
              message: "It will finish when you're back online, as long as the app stays open.",
              discardLabel: 'Leave',
            }
          : { title: 'Discard changes?', message: 'Your edits to this plan have not been saved.' })}
        keepLabel="Keep editing"
        onKeep={() => setPendingDiscard(null)}
        onDiscard={confirmDiscard}
      />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  // EXPERIMENT (user, 2026-10-28): the footer below is transparent, so the
  // root carries the list's background (ScrollableScreen's `primary`); without
  // it the navigator's light background showed as a pale band (round 1).
  root: { flex: 1, backgroundColor: t.colors.primary },
  loading: { marginTop: SPACING.large },
  loadError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.medium,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.raised,
  },
  loadErrorText: { fontSize: t.fonts.medium, color: t.colors.role.textPrimary },
  retry: { paddingVertical: SPACING.small, paddingHorizontal: SPACING.medium },
  retryText: { fontSize: t.fonts.medium, fontWeight: 'bold', color: t.colors.role.accent },
  // Sizes are `t.fonts` tokens, never a board's px (System board, Type):
  // literals skip normalizeFont, so the plan rendered smaller than its own
  // exercise rows on the device (TICKET-052, 2026-10-28).
  first: { marginTop: SPACING.large, gap: 10 },
  firstTitle: { fontSize: t.fonts.xLarge, fontWeight: 'bold', color: t.colors.role.textPrimary },
  firstBody: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary, marginBottom: SPACING.small },
  // "Plan" is the same kind of section label as "Exercises · N" below, so it
  // gets the same style; the board's small caps (xSmall) read as unimportant
  // next to it (user, 2026-10-28).
  planLabel: {
    fontSize: t.fonts.xMedium,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    marginTop: SPACING.medium,
    marginBottom: SPACING.small,
  },
  planField: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: t.colors.role.fieldEdge,
    backgroundColor: t.colors.role.raised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
  },
  // The plan is the heading the exercise rows sit under (option A, user
  // 2026-10-28): one step above their `medium` titles, and "Exercises · N"
  // below is a section label, not a peer.
  planName: { flex: 1, fontSize: t.fonts.large, fontWeight: 'bold', color: t.colors.role.textPrimary },
  planPlaceholder: { color: t.colors.role.textSecondary, fontWeight: 'normal' },
  fieldTitle: {
    fontSize: t.fonts.xMedium,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    marginTop: SPACING.medium,
    marginBottom: SPACING.small,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.small,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: t.colors.role.fieldEdge,
    marginTop: SPACING.small,
    marginBottom: SPACING.large,
  },
  addButtonText: { fontSize: t.fonts.medium, color: t.colors.role.textSecondary },
  planError: {
    color: t.colors.cancelButton,
    fontSize: t.fonts.xMedium,
    fontWeight: 'bold',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
    padding: SPACING.medium,
    marginTop: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.raised,
  },
  bannerText: { flex: 1, fontSize: t.fonts.xMedium, color: t.colors.role.textPrimary },
  // Start Workout's footer and primary button (StartWorkoutScreen.tsx), so the
  // two screens' main buttons match (device review, round 1).
  footer: {
    gap: SPACING.small,
    paddingTop: SPACING.medium,
    paddingHorizontal: SPACING.large,
    paddingBottom: SPACING.xxLarge,
    // EXPERIMENT (user, 2026-10-28): floats over the list with no fill or top
    // line, so rows show through around the button; only the button is
    // opaque. Was in the layout below the list, with Start's `role.surface` +
    // hairline top border; restore those (and drop the position, `footerHeight`
    // and the list's paddingBottom) if it is rejected.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  heading: {
    fontSize: t.fonts.xLarge,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    textAlign: 'center',
  },
  primary: {
    height: 56,
    borderRadius: 15,
    paddingHorizontal: SPACING.large,
    backgroundColor: t.colors.role.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not dimmed accent: a disabled control should not read as the primary action.
  // EXPERIMENT (user, 2026-10-28): with the footer transparent, a `raised` fill
  // matched the exercise cards scrolling behind it and the button disappeared.
  // An opaque `ground` fill and a `fieldEdge` outline (the control edge held to
  // 3:1 in colors.ts) keep it a button. Start keeps `raised`: its footer is opaque.
  primaryDisabled: {
    backgroundColor: t.colors.role.ground,
    borderWidth: 1,
    borderColor: t.colors.role.fieldEdge,
  },
  primaryText: { fontSize: t.fonts.medium, fontWeight: 'bold', color: t.colors.role.ground },
  primaryTextDisabled: { color: t.colors.role.textSecondary },
});
