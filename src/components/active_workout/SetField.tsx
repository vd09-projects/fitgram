import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, KeyboardTypeOptions } from "react-native";
import { SPACING } from "../../constants/styles";
import { ExerciseField } from "../../types/workoutType";
import { formatStepValue, stepFieldValue, stepSizeFor } from "../../utils/setLogger";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const HIT = 44;
const FIELD_HEIGHT = 62;

type Props = {
  field: ExerciseField;
  value: string;
  /** Last session's value for this set, shown as the placeholder. */
  ghost: number | null;
  onChange: (text: string) => void;
  /**
   * Reserve the stepper row's height even when this field has no stepper, so a
   * field without one lines up with a neighbour that has one.
   */
  reserveStepperRow: boolean;
};

const keyboardFor = (field: ExerciseField): KeyboardTypeOptions => {
  if (field.role === "reps") return "number-pad";
  if (field.role === "other") return "default";
  return "decimal-pad";
};

/**
 * One large numeric field of the set card, with its steppers.
 *
 * The ghost is a placeholder, never a value: the field stays empty until the
 * user types, steps, or taps repeat. See `missingFields`.
 *
 * Boundary: 1px `fieldEdge` at rest (3:1 against raised and surface), 2px
 * `accent` when focused. Accent alone is under 3:1 against `fieldEdge`, so focus
 * is carried by the width change as well as the colour. The 1px difference is
 * taken out of the padding so the digits do not shift on focus.
 */
export default function SetField({ field, value, ghost, onChange, reserveStepperRow }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [focused, setFocused] = useState(false);

  const step = stepSizeFor(field);
  const down = stepFieldValue(field, value, -1, ghost);
  const up = stepFieldValue(field, value, 1, ghost);
  const label = field.unit ? `${field.name} · ${field.unit}` : field.name;

  return (
    <View style={styles.column}>
      <TextBase style={styles.label}>{label.toUpperCase()}</TextBase>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChange}
        placeholder={ghost === null ? undefined : formatStepValue(ghost)}
        placeholderTextColor={t.colors.role.textGhost}
        keyboardType={keyboardFor(field)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        accessibilityHint={ghost === null ? undefined : `Last time ${formatStepValue(ghost)}`}
      />
      {step !== null ? (
        <View style={styles.stepperRow}>
          <StepButton
            text={`−${formatStepValue(step)}`}
            label={`Decrease ${field.name} by ${formatStepValue(step)}`}
            disabled={down === null}
            onPress={() => down !== null && onChange(down)}
            styles={styles}
          />
          <StepButton
            text={`+${formatStepValue(step)}`}
            label={`Increase ${field.name} by ${formatStepValue(step)}`}
            disabled={up === null}
            onPress={() => up !== null && onChange(up)}
            styles={styles}
          />
        </View>
      ) : (
        reserveStepperRow && <View style={styles.stepperRow} />
      )}
    </View>
  );
}

function StepButton({
  text,
  label,
  disabled,
  onPress,
  styles,
}: {
  text: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.stepButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <NumericText style={styles.stepText}>{text}</NumericText>
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  column: {
    // Two per row; with three or more they wrap, and a last odd field grows to
    // the full width rather than leaving a hole. One field is full width.
    flexGrow: 1,
    flexBasis: "40%",
    minWidth: 0,
    gap: 7,
  },
  label: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1.3,
    color: t.colors.role.textSecondary,
  },
  input: {
    height: FIELD_HEIGHT,
    borderRadius: 13,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.fieldEdge,
    paddingHorizontal: SPACING.small + 1,
    textAlign: "center",
    fontFamily: t.fontFamily.numeric.medium.name,
    fontSize: 30,
    color: t.colors.role.textPrimary,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: t.colors.role.accent,
    paddingHorizontal: SPACING.small,
  },
  stepperRow: {
    flexDirection: "row",
    gap: 6,
    height: HIT,
  },
  stepButton: {
    flex: 1,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  stepText: {
    fontSize: 13,
    color: t.colors.role.textSecondary,
  },
  disabled: {
    opacity: 0.35,
  },
});
