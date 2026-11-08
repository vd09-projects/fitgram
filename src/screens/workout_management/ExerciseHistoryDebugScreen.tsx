// src/screens/workout_management/ExerciseHistoryDebugScreen.tsx
//
// TEMPORARY. Exists only so `useExerciseHistory` can be exercised by hand before
// TICKET-018..022 build the real UI on top of it. Delete this file, its route in
// constants/routes.tsx, its Stack.Screen in navigation/WorkoutNavigator.tsx and
// its button in components/workout_hub/HubDebugRow.tsx — nothing else references it.
//
// What it is for:
//  - prove the lookup is cross-workout: pick an exercise that appears in two
//    plans and check `lastSession` names whichever plan was most recent
//  - prove readers cost nothing: watch the check counter while switching
//    exercises and reading values. It must not move.

import React, { useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import ScrollableScreen from "../../components/ScrollableScreen";
import SearchableInputDropdown, {
  DropdownSelection,
} from "../../components/SearchableInputDropdown";
import { TextBase } from "../../components/TextBase";
import { PrimaryInputField } from "../../components/PrimaryInputField";
import useWorkoutPlans from "../../hooks/useWorkoutPlans";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useExerciseHistory } from "../../hooks/useExerciseHistory";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import { Exercise, WorkoutPlan } from "../../types/workoutType";
import { BORDER_RADIUS, SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useExerciseNames } from "../../hooks/useExerciseNames";

const when = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString() + " " + new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const num = (value: number | null) => (value === null ? "null" : String(value));

export default function ExerciseHistoryDebugScreen() {
  const { styles, t } = useThemeStyles(createStyles);
  const { user } = useAuthUser();
  const { workoutPlans, loadingWorkoutPlans } = useWorkoutPlans();

  const [plan, setPlan] = useState<DropdownSelection<WorkoutPlan> | undefined>();
  const [exercise, setExercise] = useState<DropdownSelection<Exercise> | undefined>();
  const [setNumber, setSetNumber] = useState("1");

  const planOptions = useMemo(
    () => workoutPlans.map((p) => ({ label: p.name, value: p, isCustom: false })),
    [workoutPlans]
  );
  const planExercises = useMemo(() => plan?.value?.exercises ?? [], [plan]);
  const exerciseNames = useExerciseNames(planExercises);
  const exerciseOptions = useMemo(
    () =>
      planExercises.map((e, i) => ({
        label: exerciseNames[i].title,
        value: e,
        isCustom: false,
      })),
    [planExercises, exerciseNames]
  );

  // The one number that matters: every server check this app run (TICKET-076).
  const checkCount = useExerciseHistoryStore((s) => s.readout.reads);
  const byId = useExerciseHistoryStore((s) => s.byId);
  const open = useExerciseHistoryStore((s) => s.open);
  const invalidate = useExerciseHistoryStore((s) => s.invalidateExercises);

  // Reading. This never fetches.
  const history = useExerciseHistory(exercise?.value?.id, {
    fields: exercise?.value?.fields,
  });

  const parsedSetNumber = Number(setNumber);
  const lookedUp = Number.isFinite(parsedSetNumber)
    ? history.setAt(parsedSetNumber)
    : null;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <TextBase style={styles.rowLabel}>{label}</TextBase>
      <TextBase style={styles.rowValue}>{value}</TextBase>
    </View>
  );

  const Button = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <TextBase style={styles.buttonText}>{label}</TextBase>
    </TouchableOpacity>
  );

  return (
    <ScrollableScreen
      title={<TextBase style={styles.heading}>History Debug (temporary)</TextBase>}
    >
      <View style={styles.counterCard}>
        <TextBase style={styles.counterLabel}>Server checks this run (not docs)</TextBase>
        <TextBase style={styles.counter}>{checkCount}</TextBase>
        <TextBase style={styles.counterHint}>
          Switching exercises and reading values below must not move this.
        </TextBase>
      </View>

      <SearchableInputDropdown<WorkoutPlan>
        placeholder="Select Workout"
        data={planOptions}
        value={plan}
        onChange={(p) => {
          setPlan(p);
          setExercise(undefined);
        }}
        title="Workout Plan"
        allowCustomInput={false}
        isDataLoading={loadingWorkoutPlans}
      />

      <SearchableInputDropdown<Exercise>
        placeholder="Select Exercise"
        data={exerciseOptions}
        value={exercise}
        onChange={setExercise}
        title="Exercise"
        allowCustomInput={false}
        isDataLoading={loadingWorkoutPlans}
      />

      <View style={styles.buttonRow}>
        <Button label="Check (force)" onPress={() => open(user?.uid, { force: true })} />
        <Button label="Full load" onPress={() => open(user?.uid, { force: true, full: true })} />
        <Button label="Expire skip" onPress={invalidate} />
      </View>

      <TextBase style={styles.section}>Held summaries for this plan</TextBase>
      {(plan?.value?.exercises ?? []).length === 0 ? (
        <TextBase style={styles.empty}>Pick a plan.</TextBase>
      ) : (
        planExercises.map((ex, i) => {
          const held = byId?.[ex.id];
          return (
            <Row
              key={ex.id}
              label={exerciseNames[i].title}
              value={held ? `${held.recentSessions.length} sessions` : "none held"}
            />
          );
        })
      )}

      <TextBase style={styles.section}>Hook state</TextBase>
      <Row label="status" value={history.status} />
      <Row label="loading" value={String(history.loading)} />
      <Row label="hasHistory" value={String(history.hasHistory)} />
      <Row
        label="numericComparisonAvailable"
        value={String(history.numericComparisonAvailable)}
      />
      <Row label="unitMismatch" value={String(history.unitMismatch)} />
      <Row label="error" value={history.error ?? "none"} />

      {!history.numericComparisonAvailable && (
        <TextBase style={styles.warn}>
          No weight/reps pair on this exercise — every number below is null by
          design. A consumer must say so rather than render 0.
        </TextBase>
      )}
      {history.unitMismatch && (
        <TextBase style={styles.warn}>
          Some sessions used a different weight unit. Those are marked not
          comparable and contribute no numbers. Units are never converted.
        </TextBase>
      )}

      <TextBase style={styles.section}>Last session</TextBase>
      {history.lastSession ? (
        <>
          <Row label="workout" value={history.lastSession.workoutName} />
          <Row label="when" value={when(history.lastSession.performedAt)} />
          <Row label="comparable" value={String(history.lastSession.comparable)} />
          <Row
            label="volume"
            value={`${num(history.lastSession.volume.value)}  (${history.lastSession.volume.setsCounted}/${history.lastSession.volume.setsTotal} sets parsed)`}
          />
          {history.lastSession.sets.map((s) => (
            <Row
              key={s.setNumber}
              label={`set ${s.setNumber}`}
              value={`w=${num(s.weight)} r=${num(s.reps)}   ${JSON.stringify(s.segments)}`}
            />
          ))}
        </>
      ) : (
        <TextBase style={styles.empty}>
          No history. For a brand-new exercise this is the expected result, not an
          error.
        </TextBase>
      )}

      <TextBase style={styles.section}>setAt(n) — "what was set n last time"</TextBase>
      <PrimaryInputField
        label=""
        placeholder="Set number"
        value={setNumber}
        onChangeText={setSetNumber}
        keyboardType="number-pad"
        container={styles.input}
      />
      <Row
        label={`setAt(${setNumber})`}
        value={
          lookedUp
            ? `w=${num(lookedUp.weight)} r=${num(lookedUp.reps)}`
            : "null — that set was not done last time"
        }
      />

      <TextBase style={styles.section}>
        Sessions ({history.sessions.length}) — cross-workout
      </TextBase>
      {history.sessions.map((s) => (
        <Row
          key={s.sessionId}
          label={when(s.performedAt)}
          value={`${s.workoutName} · ${s.sets.length} sets · vol ${num(s.volume.value)}${s.comparable ? "" : " · NOT COMPARABLE"}`}
        />
      ))}

      <TextBase style={styles.section}>Best per rep count (all-time)</TextBase>
      {history.best.length === 0 ? (
        <TextBase style={styles.empty}>none</TextBase>
      ) : (
        history.best.map((b) => (
          <Row
            key={`${b.reps}-${b.unit ?? ""}`}
            label={`${b.reps} reps`}
            value={`${b.weight}${b.unit ?? ""} · ${b.workoutId} · set ${b.setNumber} · ${when(b.performedAt)}`}
          />
        ))
      )}

      <TextBase style={styles.section}>Volume trend (oldest to newest)</TextBase>
      {history.volumeTrend.length === 0 ? (
        <TextBase style={styles.empty}>none</TextBase>
      ) : (
        history.volumeTrend.map((p) => (
          <Row key={p.sessionId} label={when(p.performedAt)} value={num(p.volume)} />
        ))
      )}

      <View style={{ height: SPACING.xLarge }} />
    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    heading: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.textPrimary,
      textAlign: "center",
    },
    counterCard: {
      backgroundColor: t.colors.cardBackground,
      borderRadius: BORDER_RADIUS,
      padding: SPACING.large,
      marginBottom: SPACING.large,
      alignItems: "center",
    },
    counterLabel: { fontSize: t.fonts.medium, color: t.colors.textPrimary },
    counter: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.cardHeader,
    },
    counterHint: {
      fontSize: t.fonts.xMedium,
      color: t.colors.textPrimary,
      textAlign: "center",
      marginTop: SPACING.xSmall,
    },
    buttonRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: SPACING.medium },
    button: {
      backgroundColor: t.colors.button,
      borderRadius: BORDER_RADIUS,
      paddingHorizontal: SPACING.medium,
      minHeight: 44,
      justifyContent: "center",
      marginRight: SPACING.xSmall,
      marginBottom: SPACING.xSmall,
    },
    buttonText: { color: t.colors.buttonText, fontSize: t.fonts.xMedium },
    section: {
      fontSize: t.fonts.large,
      fontWeight: "bold",
      color: t.colors.textPrimary,
      marginTop: SPACING.large,
      marginBottom: SPACING.xSmall,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: SPACING.xSmall,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.collapsed,
    },
    rowLabel: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary, flex: 1 },
    rowValue: {
      fontSize: t.fonts.xMedium,
      color: t.colors.cardHeader,
      flex: 2,
      textAlign: "right",
    },
    warn: {
      fontSize: t.fonts.xMedium,
      color: t.colors.cancelButton,
      marginTop: SPACING.xSmall,
    },
    empty: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary },
    input: {
      backgroundColor: t.colors.inputSecondaryBackground,
      borderRadius: BORDER_RADIUS,
      height: 48,
      marginBottom: SPACING.xSmall,
    },
  });
