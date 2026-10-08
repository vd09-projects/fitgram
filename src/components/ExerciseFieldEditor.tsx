import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BORDER_RADIUS, BUTTON_SIZES, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { MaybeTourStep } from './guide_tour/MaybeTourStep';
import { ValueOf } from 'react-native-gesture-handler/lib/typescript/typeUtils';
import { EDITABLE_LIST_STEP_NAMES } from '../tour_steps/commonStepNames';
import { makeStepId } from '../tour_steps/utils';
import { MANAGE_WOURKOUT_STEP_NAMES } from '../tour_steps/manageWorkout';
import { PositionType } from './guide_tour/TourGuideProvider';
import { ExerciseField, FieldRole, FieldUnit } from '../types/workoutType';

/**
 * Replaces the old string-list field editor. A field now carries a declared
 * role, so the history layer never has to guess what "Weight (kg)" means, and a
 * kg session is never compared against an lb one.
 *
 * Tour step ids are unchanged, so existing manage-workout tours still resolve.
 */

const ROLES: { role: FieldRole; label: string }[] = [
  { role: 'weight', label: 'Weight' },
  { role: 'reps', label: 'Reps' },
  { role: 'time', label: 'Time' },
  { role: 'distance', label: 'Dist' },
  { role: 'other', label: 'Other' },
];

/** Units offered per role. Roles not listed carry no unit. */
const UNITS: Partial<Record<FieldRole, FieldUnit[]>> = {
  weight: ['kg', 'lb'],
  time: ['s', 'min'],
  distance: ['m', 'km'],
};

interface ExerciseFieldEditorProps {
  title: string;
  items: ExerciseField[];
  onItemsChange: (updatedItems: ExerciseField[]) => void;
  /**
   * Text typed into the add box but not yet committed with +. Reported so a
   * caller's Save can accept it rather than rejecting the exercise as fieldless.
   */
  onPendingTextChange?: (text: string) => void;
  showInputField?: boolean;
  tourStepPrefix?: ValueOf<typeof MANAGE_WOURKOUT_STEP_NAMES>;
  positionType?: PositionType;
}

const ExerciseFieldEditor: React.FC<ExerciseFieldEditorProps> = ({
  title,
  items,
  onItemsChange,
  onPendingTextChange,
  showInputField = true,
  tourStepPrefix,
  positionType,
}) => {
  const { styles, t } = useThemeStyles(createStyles);
  const [newItem, setNewItem] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddItem = () => {
    const trimmed = newItem.trim();
    if (trimmed === '') {
      setErrorMessage('*Fields cannot be empty');
      return;
    }
    if (items.some((field) => field.name === trimmed)) {
      setErrorMessage('*This item already exists!');
      return;
    }
    // A newly typed field means nothing numerically until the user says so.
    onItemsChange([...items, { name: trimmed, role: 'other' }]);
    setNewItem('');
    onPendingTextChange?.('');
    setErrorMessage(null);
  };

  const handlePendingChange = (text: string) => {
    setNewItem(text);
    onPendingTextChange?.(text);
    setErrorMessage(null);
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<ExerciseField>) => {
    const updated = [...items];
    const next: ExerciseField = { ...updated[index], ...patch };
    // A role change invalidates whatever unit was set for the old role.
    if (patch.role && !UNITS[patch.role]) delete next.unit;
    updated[index] = next;
    onItemsChange(updated);
  };

  const roleTaken = (role: FieldRole, index: number) =>
    (role === 'weight' || role === 'reps') &&
    items.some((field, i) => i !== index && field.role === role);

  return (
    <View style={styles.container}>
      <TextBase style={styles.title}>{title}</TextBase>

      {items.length === 0 && (
        <TextBase style={styles.emptyHint}>
          No fields yet. Type a name below and tap + to add one. Each field then
          gets its own Weight / Reps / Time / Dist / Other selector.
        </TextBase>
      )}

      <MaybeTourStep
        stepId={makeStepId(EDITABLE_LIST_STEP_NAMES.EXISTING_ITEM, tourStepPrefix)}
        positionType={positionType}
      >
        <>
          {items.map((field, index) => {
            const isDuplicate = errorMessage && field.name === newItem.trim();
            const units = UNITS[field.role];

            return (
              <View key={index} style={styles.fieldBlock}>
                <PrimaryInputField
                  label=''
                  value={field.name}
                  container={[styles.primaryItemContainer, isDuplicate && styles.duplicateItem]}
                  placeholderTextColor={t.colors.inputSecondaryPlaceholder}
                  inputBox={{ color: t.colors.inputSecondaryText }}
                  onChangeText={(text) => updateField(index, { name: text })}
                  right={<TextInput.Icon
                    icon="close"
                    color={t.colors.inputPrimaryText}
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    size={20}
                  />}
                />

                <View style={styles.chipRow}>
                  {ROLES.map(({ role, label }) => {
                    const selected = field.role === role;
                    const disabled = !selected && roleTaken(role, index);
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                          disabled && styles.chipDisabled,
                        ]}
                        disabled={disabled}
                        onPress={() => updateField(index, { role })}
                        accessibilityLabel={`Set ${field.name} role to ${label}`}
                      >
                        <TextBase
                          style={[styles.chipText, selected && styles.chipTextSelected]}
                        >
                          {label}
                        </TextBase>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {units && (
                  <View style={styles.chipRow}>
                    {units.map((unit) => {
                      const selected = field.unit === unit;
                      return (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => updateField(index, { unit })}
                          accessibilityLabel={`Set ${field.name} unit to ${unit}`}
                        >
                          <TextBase
                            style={[styles.chipText, selected && styles.chipTextSelected]}
                          >
                            {unit}
                          </TextBase>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </>
      </MaybeTourStep>

      {showInputField && (
        <MaybeTourStep
          stepId={makeStepId(EDITABLE_LIST_STEP_NAMES.ADD_NEW_ITEM, tourStepPrefix)}
          positionType={positionType}
        >
          <PrimaryInputField
            label=''
            placeholder="Enter new field, then tap +"
            value={newItem}
            onChangeText={handlePendingChange}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            container={[styles.primaryInputContainer, errorMessage ? styles.errorInput : {}]}
            placeholderTextColor={t.colors.inputSecondaryPlaceholder}
            inputBox={{ color: t.colors.inputSecondaryText }}
            right={<TextInput.Icon
              icon="playlist-plus"
              color={errorMessage ? t.colors.cancelButton : t.colors.button}
              onPress={handleAddItem}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              size={BUTTON_SIZES.xLarge}
            />}
          />
        </MaybeTourStep>
      )}

      {errorMessage && <TextBase style={styles.errorText}>{errorMessage}</TextBase>}
    </View>
  );
};

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: SPACING.medium,
  },
  title: {
    marginBottom: SPACING.small,
    fontSize: t.fonts.medium,
    color: t.colors.textPrimary,
    fontWeight: 'bold',
  },
  fieldBlock: {
    marginBottom: SPACING.small,
  },
  primaryItemContainer: {
    flex: 1,
    backgroundColor: t.colors.inputSecondaryBackground,
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    height: 46,
    marginBottom: SPACING.xSmall,
    fontSize: t.fonts.medium,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.xSmall,
  },
  chip: {
    paddingHorizontal: SPACING.medium,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: t.colors.inputSecondaryBackground,
    marginRight: SPACING.xSmall,
    marginBottom: SPACING.xSmall,
  },
  chipSelected: {
    backgroundColor: t.colors.button,
    borderColor: t.colors.button,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: t.fonts.xMedium,
    color: t.colors.textPrimary,
  },
  chipTextSelected: {
    color: t.colors.buttonText,
    fontWeight: 'bold',
  },
  primaryInputContainer: {
    flex: 1,
    paddingLeft: 0,
    marginTop: SPACING.small,
    height: 50,
    paddingBottom: SPACING.xSmall,
    marginBottom: SPACING.xSmall,
    fontSize: t.fonts.large,
    backgroundColor: t.colors.inputSecondaryBackground,
    ...t.shadows.shadowSmall,
  },
  errorInput: {
    borderColor: t.colors.cancelButton,
    borderWidth: 1,
  },
  emptyHint: {
    fontSize: t.fonts.xMedium,
    color: t.colors.inputSecondaryPlaceholder,
    marginBottom: SPACING.small,
  },
  errorText: {
    color: t.colors.cancelButton,
    fontSize: t.fonts.xMedium,
    fontWeight: 'bold',
    marginTop: SPACING.xSmall,
  },
  duplicateItem: {
    backgroundColor: t.colors.errorBackground,
  },
});

export default ExerciseFieldEditor;
