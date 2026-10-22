import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { ExerciseHistory } from "../../types/exerciseHistory";
import { LoggedExercise } from "../../types/zustandWorkoutType";
import { Effort, EFFORTS } from "../../types/workoutSession";
import { EFFORT_LABEL } from "../../utils/effort";
import { resolveNumericFields } from "../../utils/exerciseFields";
import { personalBest, personalBestText } from "../../utils/personalBest";
import { ADD_REST_MS, formatCountdown, restCountdown, RestTimer } from "../../utils/restTimer";
import { formatSessionDate } from "../../utils/setDeltas";
import { ghostNotice, lastTimeText, resolveGhostTarget } from "../../utils/setLogger";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { EffortBadge } from "./EffortBadge";

const ACTION_HEIGHT = 48;

/**
 * Re-reads the clock twice a second. The interval only triggers a re-render and
 * holds no count (as `ElapsedTime` in WorkoutHeader): every value is derived
 * from the stored `startedAt`, so unmounting, backgrounding or a suspended JS
 * thread loses nothing. Half a second, not one, so the shown second never lags
 * the real one by most of a second.
 */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type Props = {
  rest: RestTimer;
  exercise: LoggedExercise;
  history: ExerciseHistory;
  onSkip: () => void;
  onAddTime: () => void;
  onOpenHistory: () => void;
  /** Mark the set just logged, or clear its mark with null (TICKET-034). */
  onSetEffort: (setId: number, effort: Effort | null) => void;
};

/**
 * What stands in for the set card while resting (TICKET-021): the personal-best
 * banner for the set just logged, the countdown with Skip and add-time, and the
 * next set's target.
 *
 * Decisions:
 * - It replaces the card rather than sitting beside a live one: the design's
 *   rest discipline. That withholds Log set, so Skip is the filled, prominent
 *   control, one tap, no confirm; add-time is the outlined one.
 * - Rendered by ExerciseLogger in the card's slot, so the card's own state
 *   (`inputValues`, the undo row, the set number) lives on in the parent and
 *   the Today list below is never remounted.
 * - A finished rest stays on screen reading "Rest done" until the user moves
 *   on. Dismissing it by itself would swap the layout under a user who is not
 *   looking, and on return from the background it would look like the timer
 *   never ran.
 * - The banner is about the last set in today's list. Removing that set while
 *   resting re-derives it for the new last set, which is still a true
 *   statement about that set.
 * - Next-set target and its absence reasons come from `resolveGhostTarget` and
 *   `ghostNotice`, the card's own calls, so the two always agree.
 */
export default function RestPanel({ rest, exercise, history, onSkip, onAddTime, onOpenHistory, onSetEffort }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const now = useNow(500);

  const countdown = restCountdown(rest.startedAt, rest.durationMs, now);
  const running = countdown?.state === "running";
  const remaining = formatCountdown(running ? countdown.remainingSeconds : 0);
  const targetTime = formatCountdown(rest.durationMs / 1000);

  const nextSet = exercise.sets.length + 1;
  const target = resolveGhostTarget(history, nextSet);
  const targetText = lastTimeText(target);
  const targetNotice = ghostNotice(target, history.status);
  const targetDate =
    target.kind === "available" && history.lastSession ? formatSessionDate(history.lastSession.performedAt) : null;

  const banner = personalBestText(
    personalBest(
      history,
      exercise.sets.map((set) => set.fields),
      exercise.sets.length,
      resolveNumericFields(exercise.fields)
    )
  );

  const lastSet = exercise.sets[exercise.sets.length - 1] ?? null;
  const lastEffort = lastSet?.effort ?? null;

  const addSeconds = ADD_REST_MS / 1000;
  const skipLabel = running ? "Skip rest" : "Next set";

  return (
    <View style={styles.container}>
      {banner !== null && (
        <View
          style={styles.banner}
          accessible
          accessibilityLabel={`Heaviest ${banner.reps}-rep set yet. ${banner.detail.replace(" · ", ", ")}`}
          testID="personal-best-banner"
        >
          <Ionicons name="star-outline" size={18} color={t.colors.role.signal} />
          <View style={styles.bannerText}>
            <TextBase style={styles.bannerTitle}>
              Heaviest <NumericText style={styles.bannerTitle}>{banner.reps}</NumericText>-rep set yet
            </TextBase>
            <NumericText style={styles.bannerDetail}>{banner.detail}</NumericText>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.header}>
          <TextBase style={styles.label}>{running ? "RESTING" : "REST DONE"}</TextBase>
          <View style={styles.targetTime}>
            <TextBase style={styles.secondary}>target </TextBase>
            <NumericText style={styles.secondary}>{targetTime}</NumericText>
          </View>
        </View>

        <NumericText
          style={styles.countdown}
          accessibilityLabel={running ? `${remaining} rest left of ${targetTime}` : "Rest done"}
        >
          {remaining}
        </NumericText>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(running ? countdown.elapsedFraction : 1) * 100}%` }]} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddTime}
            accessibilityRole="button"
            accessibilityLabel={`Add ${addSeconds} seconds`}
          >
            <NumericText style={styles.addText}>{`+${addSeconds}s`}</NumericText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={skipLabel}
          >
            <TextBase style={styles.skipText}>{skipLabel}</TextBase>
          </TouchableOpacity>
        </View>

        {lastSet !== null && (
          <View style={styles.rate} accessibilityRole="radiogroup" accessibilityLabel={`How was set ${exercise.sets.length}? Optional`}>
            <View style={styles.rateHeader}>
              <TextBase style={styles.nextLabel}>
                HOW WAS SET <NumericText style={styles.nextLabel}>{exercise.sets.length}</NumericText>?
              </TextBase>
              <TextBase style={styles.secondary}>optional</TextBase>
            </View>
            <View style={styles.rateOptions}>
              {EFFORTS.map((effort) => {
                const selected = lastEffort === effort;
                return (
                  <TouchableOpacity
                    key={effort}
                    style={[styles.rateOption, selected && styles.rateOptionSelected]}
                    onPress={() => onSetEffort(lastSet.id, selected ? null : effort)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={EFFORT_LABEL[effort]}
                    accessibilityHint={selected ? "Tap again to clear" : undefined}
                  >
                    <EffortBadge effort={effort} />
                    <TextBase style={styles.rateText}>{EFFORT_LABEL[effort]}</TextBase>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.next}
          onPress={onOpenHistory}
          accessibilityRole="button"
          accessibilityLabel={
            `Next, set ${nextSet}` +
            (targetText !== null ? `: ${targetText.replace("×", "by")}${targetDate ? ` from ${targetDate}` : ""}` : "") +
            (targetNotice !== null ? `. ${targetNotice}` : "") +
            ". Show history"
          }
        >
          <View style={styles.nextBody}>
            <View style={styles.nextLabelRow}>
              <TextBase style={styles.nextLabel}>NEXT · SET </TextBase>
              <NumericText style={styles.nextLabel}>{nextSet}</NumericText>
            </View>
            {targetText !== null && (
              <View style={styles.nextTargetRow}>
                <NumericText style={styles.nextTarget}>{targetText}</NumericText>
                {targetDate !== null && (
                  <TextBase style={styles.secondary}>
                    from <NumericText style={styles.secondary}>{targetDate}</NumericText>
                  </TextBase>
                )}
              </View>
            )}
            {targetNotice !== null && <TextBase style={styles.secondary}>{targetNotice}</TextBase>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.colors.role.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    gap: SPACING.medium,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: t.colors.role.signalDeep,
    borderWidth: 1,
    borderColor: t.colors.role.signal,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: t.fonts.small,
    fontWeight: "bold",
    color: t.colors.role.signal,
  },
  bannerDetail: {
    marginTop: 1,
    fontSize: t.fonts.xSmall,
    color: t.colors.role.textPrimary,
  },
  card: {
    backgroundColor: t.colors.role.surface,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    borderRadius: 16,
    padding: SPACING.xMedium,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: {
    fontSize: t.fonts.xSmall,
    fontWeight: "bold",
    letterSpacing: 1.5,
    color: t.colors.role.textSecondary,
  },
  targetTime: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  secondary: {
    // textSecondary, not textGhost: textGhost is cleared for large numerals only.
    fontSize: t.fonts.xSmall,
    color: t.colors.role.textSecondary,
  },
  countdown: {
    marginTop: 2,
    fontSize: 46,
    fontWeight: "600",
    lineHeight: 52,
    color: t.colors.role.textPrimary,
  },
  track: {
    height: 6,
    marginTop: 10,
    borderRadius: 3,
    backgroundColor: t.colors.role.hairlineStrong,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: t.colors.role.accent,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  addButton: {
    flex: 1,
    height: ACTION_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  addText: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textPrimary,
  },
  skipButton: {
    flex: 1,
    height: ACTION_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: t.colors.role.accent,
  },
  skipText: {
    fontSize: t.fonts.medium,
    fontWeight: "bold",
    color: t.colors.role.ground,
  },
  rate: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
    gap: 9,
  },
  rateHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  rateOptions: {
    flexDirection: "row",
    gap: 8,
  },
  rateOption: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  rateOptionSelected: {
    backgroundColor: t.colors.role.accentDeep,
    borderColor: t.colors.role.accent,
  },
  rateText: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textPrimary,
  },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: t.colors.role.hairline,
  },
  nextBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nextLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextLabel: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1.2,
    color: t.colors.role.textSecondary,
  },
  nextTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  nextTarget: {
    fontSize: 17,
    fontWeight: "600",
    color: t.colors.role.textPrimary,
  },
});
