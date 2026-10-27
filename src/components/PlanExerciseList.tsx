import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, SPACING } from '../constants/styles';
import ExerciseFieldEditor from './ExerciseFieldEditor';
import { TextBase } from './TextBase';
import { TouchableOpacityBase } from './TouchableOpacityBase';
import { ReturnTypeUseThemeTokens } from './app_manager/ThemeContext';
import { useThemeStyles } from '../utils/useThemeStyles';
import { useExerciseName } from '../hooks/useExerciseNames';
import { MANAGE_WOURKOUT_STEP_NAMES } from '../tour_steps/manageWorkout';
import { DraftExercise, DraftField, fieldSummary, renamedFrom } from '../utils/planDraft';

/**
 * Manage Workout's exercise list (TICKET-051, board C1 `PlatesUnit`): one
 * collapsed row per plan exercise with its fields and units ("Weight kg ·
 * Reps"); tapping a row's header expands its field editor and a Remove
 * exercise action at the bottom. One row
 * is open at a time, and the parent owns which, so an exercise just added can
 * arrive expanded. Replaces `CollapsibleExerciseList`. The version is not
 * editable here: remove the row and add the other combination.
 */

interface PlanExerciseListProps {
  exercises: DraftExercise[];
  expandedId: string | null;
  onToggle: (exerciseId: string) => void;
  onFieldsChange: (exerciseId: string, fields: DraftField[]) => void;
  onPendingChange: (exerciseId: string, text: string) => void;
  onRemove: (exerciseId: string) => void;
  /** Per exercise id, the problem that stops Save. Shown under its row. */
  rowErrors: Record<string, string>;
}

const renameNote = (field: DraftField): string | null => {
  const from = renamedFrom(field);
  // TICKET-030: history reads past sets by the current field name.
  return from === null ? null : `Past sessions logged as "${from}" won't show under the new name.`;
};

const PlanExerciseRow = memo(
  ({
    exercise,
    expanded,
    error,
    onToggle,
    onFieldsChange,
    onPendingChange,
    onRemove,
  }: {
    exercise: DraftExercise;
    expanded: boolean;
    error: string | undefined;
  } & Pick<PlanExerciseListProps, 'onToggle' | 'onFieldsChange' | 'onPendingChange' | 'onRemove'>) => {
    const { styles, t } = useThemeStyles(createStyles);
    const name = useExerciseName(exercise);

    return (
      <View style={[styles.row, error !== undefined && styles.rowError]}>
        {/* The whole header toggles, chevron included, and the chevron keeps
            its place open or closed. Remove lives at the bottom of the open
            row, never where the chevron was: tapping "the arrow" to close must
            not delete the exercise (device review, round 1). */}
        <TouchableOpacityBase
          style={styles.header}
          onPress={() => onToggle(exercise.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${name.title}, ${expanded ? 'collapse' : 'edit fields'}`}
        >
          <View style={styles.headerText}>
            <TextBase style={styles.title}>{name.title}</TextBase>
            {name.subtitle !== null && <TextBase style={styles.subtitle}>{name.subtitle}</TextBase>}
            {!expanded && <TextBase style={styles.summary}>{fieldSummary(exercise.fields)}</TextBase>}
          </View>
          <Ionicons
            testID={`row-chevron-${exercise.id}`}
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={t.colors.role.textSecondary}
            style={styles.icon}
          />
        </TouchableOpacityBase>

        {expanded && (
          <ExerciseFieldEditor
            title="Fields"
            items={exercise.fields}
            // The editor spreads the fields it edits, so each keeps its
            // `savedName`; a field it adds has none (planDraft.ts).
            onItemsChange={(fields) => onFieldsChange(exercise.id, fields as DraftField[])}
            onPendingTextChange={(text) => onPendingChange(exercise.id, text)}
            fieldNote={(field) => renameNote(field as DraftField)}
            tourStepPrefix={MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_EDITABLE_LIST}
            positionType="above"
          />
        )}

        {expanded && (
          <TouchableOpacityBase
            onPress={() => onRemove(exercise.id)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name.title}`}
          >
            <Ionicons name="trash-outline" size={18} color={t.colors.cancelButton} />
            <TextBase style={styles.removeText}>Remove exercise</TextBase>
          </TouchableOpacityBase>
        )}

        {error !== undefined && <TextBase style={styles.error}>{error}</TextBase>}
      </View>
    );
  }
);

const PlanExerciseList: React.FC<PlanExerciseListProps> = ({
  exercises,
  expandedId,
  rowErrors,
  ...handlers
}) => (
  <View>
    {exercises.map((exercise) => (
      <PlanExerciseRow
        key={exercise.id}
        exercise={exercise}
        expanded={exercise.id === expandedId}
        error={rowErrors[exercise.id]}
        {...handlers}
      />
    ))}
  </View>
);

export default PlanExerciseList;

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  row: {
    backgroundColor: t.colors.role.raised,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    marginBottom: SPACING.small,
    paddingHorizontal: SPACING.medium,
  },
  rowError: { borderColor: t.colors.cancelButton },
  // Spans the row's padding, so a tap anywhere on the closed card toggles it.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -SPACING.medium,
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.medium,
  },
  headerText: { flex: 1 },
  title: { fontSize: t.fonts.medium, fontWeight: 'bold', color: t.colors.role.textPrimary },
  subtitle: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  summary: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary, marginTop: 2 },
  icon: { padding: SPACING.xSmall },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xSmall,
    paddingVertical: SPACING.small,
    marginBottom: SPACING.xSmall,
  },
  removeText: { fontSize: t.fonts.medium, color: t.colors.cancelButton, fontWeight: 'bold' },
  error: {
    color: t.colors.cancelButton,
    fontSize: t.fonts.xMedium,
    fontWeight: 'bold',
    marginBottom: SPACING.xSmall,
  },
});
