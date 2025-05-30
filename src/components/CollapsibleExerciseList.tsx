import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZES, SPACING } from '../constants/styles';
import EditableList from './EditableList';
import { Exercise } from '../types/workoutType';
import { TextBase } from './TextBase';
import CollapsibleSection from './CollapsibleSection'; // ✅ make sure this is the reusable component you already created
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface CollapsibleExerciseListProps {
  exercises: Exercise[];
  onUpdate: (index: number, updatedExercise?: Exercise) => void;
}

const CollapsibleExerciseItem = memo(
  ({
    exercise,
    index,
    onUpdate,
  }: {
    exercise: Exercise;
    index: number;
    onUpdate: (index: number, updatedExercise?: Exercise) => void;
  }) => {
  const { styles, t } = useThemeStyles(createStyles);

    return (
    <CollapsibleSection
      defaultCollapsed={true}
      collapsibleStyle={styles.exerciseContainer}
      collapsibleIconColor={t.colors.textPrimary}
      title={<TextBase style={styles.exerciseText}>{exercise.name}</TextBase>}
      rightElement={
        <TouchableOpacity onPress={() => onUpdate(index, undefined)} style={{ paddingRight: SPACING.xSmall }}>
          <Ionicons name="trash-outline" size={20} color={t.colors.cancelButton} />
        </TouchableOpacity>
      }
    >
      <EditableList
        title={`Edit "${exercise.name}" Fields`}
        items={exercise.fields}
        onItemsChange={(updatedFields) => {
          const updatedExercise = { ...exercise, fields: updatedFields };
          onUpdate(index, updatedExercise);
        }}
      />
    </CollapsibleSection>
  )}
);

const CollapsibleExerciseList: React.FC<CollapsibleExerciseListProps> = memo(({ exercises, onUpdate }) => {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <View style={styles.section}>
      <TextBase style={styles.subHeading}>Existing Exercises</TextBase>
      {exercises.map((exercise, index) => (
        <CollapsibleExerciseItem key={exercise.id} exercise={exercise} index={index} onUpdate={onUpdate} />
      ))}
    </View>
  );
});

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  section: {
    borderRadius: BORDER_RADIUS,
    marginTop: SPACING.large,
  },
  subHeading: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    marginBottom: SPACING.medium,
  },
  exerciseContainer: {
    backgroundColor: t.colors.collapsed,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
    padding: SPACING.small,
  },
  exerciseText: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: t.colors.collapsedTitleText,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.small,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.small,
  },
});

export default CollapsibleExerciseList;