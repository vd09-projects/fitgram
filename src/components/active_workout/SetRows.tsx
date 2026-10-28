import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, KeyboardTypeOptions, StyleProp, TextStyle } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { ExerciseField } from "../../types/workoutType";
import { formatStepValue, stepFieldValue, stepSizeFor } from "../../utils/setLogger";
import { SplitRowValues, SplitSlot, splitSlot } from "../../utils/splits";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const HIT = 44;
const SLOT_WIDTH = 44;
/** One row: the set card's focal point (TICKET-018). */
const ROW_HEIGHT = 62;
/** Two rows or more: compact, so three or four segments fit above Log (boards S2–S3). */
const COMPACT_ROW_HEIGHT = 50;

/** The split-arrows icon (one line branching in two), shared by every split control. */
export function SplitIcon({ size, color }: { size: number; color: string }) {
  return <MaterialCommunityIcons name="call-split" size={size} color={color} />;
}

const keyboardFor = (field: ExerciseField): KeyboardTypeOptions => {
  if (field.role === "reps") return "number-pad";
  if (field.role === "other") return "default";
  return "decimal-pad";
};

const fieldLabel = (field: ExerciseField) => (field.unit ? `${field.name} · ${field.unit}` : field.name);

type Props = {
  fields: ExerciseField[];
  setNumber: number;
  /** Every row, the first segment first. One row is a normal set. Never empty. */
  rows: SplitRowValues[];
  /** Last session's values for this set: placeholders on the first row only. */
  ghosts: Record<string, number | null>;
  onChange: (index: number, name: string, text: string) => void;
  /** Absent: no third column at all (editing a logged set; its rows are TICKET-033-3). */
  onAddSplit?: () => void;
  /** Remove row `index` (0-based, the first segment included). */
  onRemove: (index: number) => void;
};

/**
 * The set card's fields: one row per segment of the set, each field a column
 * under one line of labels, and a third column for split / ×. A normal set is
 * one row; a split set is several (TICKET-033, canvas boards S1–S3). One
 * component for both, and for editing a logged set, so the inputs, labels and
 * the third column are built in one place (user, 2026-10-29). Replaced
 * `SetField` (one large field per column) plus a separate `SplitRows` grid.
 *
 * What the row count changes, and only this:
 * - One row: large inputs, and steppers under them. A field with no stepper
 *   (time, distance) keeps the stepper line's height when a neighbour has one,
 *   so the inputs line up.
 * - Two or more: compact inputs and no steppers, as the boards draw them.
 *   Weight is typed; a new row starts empty.
 *
 * The ghost is a placeholder, never a value: the field stays empty until the
 * user types, steps, or taps repeat. See `missingFields`.
 *
 * Boundary: 1px `fieldEdge` at rest (3:1 against raised and surface), 2px
 * `accent` when focused. Accent alone is under 3:1 against `fieldEdge`, so focus
 * is carried by the width change as well as the colour. The 1px difference is
 * taken out of the padding so the digits do not shift on focus.
 */
export default function SetRows({ fields, setNumber, rows, ghosts, onChange, onAddSplit, onRemove }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const single = rows.length === 1;
  const height = single ? ROW_HEIGHT : COMPACT_ROW_HEIGHT;
  const hasSlot = onAddSplit !== undefined;
  const hasSteppers = single && fields.some((field) => stepSizeFor(field) !== null);
  // The first row is the set itself; rows after it are numbered as splits.
  const rowLabel = (index: number, field: ExerciseField) =>
    index === 0 ? fieldLabel(field) : `Split ${index} ${fieldLabel(field)}`;
  const emptySlot = hasSlot && <View style={styles.slot} />;

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {fields.map((field) => (
          <TextBase key={field.name} style={styles.label} numberOfLines={1}>
            {fieldLabel(field).toUpperCase()}
          </TextBase>
        ))}
        {emptySlot}
      </View>

      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {fields.map((field) => (
            <RowInput
              key={field.name}
              field={field}
              value={row[field.name] ?? ""}
              ghost={index === 0 ? ghosts[field.name] ?? null : null}
              label={rowLabel(index, field)}
              inputStyle={[styles.input, { height }, !single && styles.inputCompact]}
              focusedStyle={styles.inputFocused}
              ghostColor={t.colors.role.textGhost}
              onChange={(text) => onChange(index, field.name, text)}
            />
          ))}
          {onAddSplit && (
            <RowSlot
              kind={splitSlot(fields, rows, index)}
              index={index}
              setNumber={setNumber}
              single={single}
              height={height}
              styles={styles}
              t={t}
              onAddSplit={onAddSplit}
              onRemove={onRemove}
            />
          )}
        </View>
      ))}

      {/* Under the one row only: a split set's rows are compact (board S2). */}
      {hasSteppers && (
        <View style={styles.row}>
          {fields.map((field) => (
            <Steppers
              key={field.name}
              field={field}
              value={rows[0][field.name] ?? ""}
              ghost={ghosts[field.name] ?? null}
              styles={styles}
              onChange={(text) => onChange(0, field.name, text)}
            />
          ))}
          {emptySlot}
        </View>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/** The third column of one row: split, or × to remove / cancel the row. */
function RowSlot({
  kind,
  index,
  setNumber,
  single,
  height,
  styles,
  t,
  onAddSplit,
  onRemove,
}: {
  kind: SplitSlot;
  index: number;
  setNumber: number;
  single: boolean;
  height: number;
  styles: Styles;
  t: ReturnTypeUseThemeTokens;
  onAddSplit: () => void;
  onRemove: (index: number) => void;
}) {
  if (kind === "split") {
    return (
      <TouchableOpacity
        style={[styles.slot, styles.splitButton, { height }]}
        onPress={onAddSplit}
        accessibilityRole="button"
        accessibilityLabel={single ? `Add a split to set ${setNumber}` : "Add another split"}
      >
        <SplitIcon size={18} color={t.colors.role.textPrimary} />
        <TextBase style={styles.splitText}>split</TextBase>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.slot, styles.remove, { height }]}
      onPress={() => onRemove(index)}
      accessibilityRole="button"
      accessibilityLabel={
        index === 0
          ? `Remove the first row of set ${setNumber}`
          : `${kind === "cancel" ? "Cancel" : "Remove"} split ${index}`
      }
    >
      <Ionicons name="close" size={16} color={t.colors.role.textSecondary} />
    </TouchableOpacity>
  );
}

// Styles come from the parent, built once per render of the card rather than
// once per input: `useThemeStyles` does not memoise.
function RowInput({
  field,
  value,
  ghost,
  label,
  inputStyle,
  focusedStyle,
  ghostColor,
  onChange,
}: {
  field: ExerciseField;
  value: string;
  ghost: number | null;
  label: string;
  inputStyle: StyleProp<TextStyle>;
  focusedStyle: TextStyle;
  ghostColor: string;
  onChange: (text: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[inputStyle, focused && focusedStyle]}
      value={value}
      onChangeText={onChange}
      placeholder={ghost === null ? undefined : formatStepValue(ghost)}
      placeholderTextColor={ghostColor}
      keyboardType={keyboardFor(field)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityLabel={label}
      accessibilityHint={ghost === null ? undefined : `Last time ${formatStepValue(ghost)}`}
    />
  );
}

/** −/+ under one field, or an empty cell of the same size when it has no step. */
function Steppers({
  field,
  value,
  ghost,
  styles,
  onChange,
}: {
  field: ExerciseField;
  value: string;
  ghost: number | null;
  styles: Styles;
  onChange: (text: string) => void;
}) {
  const step = stepSizeFor(field);
  if (step === null) return <View style={styles.stepperCell} />;
  const amount = formatStepValue(step);
  const buttons = [
    { text: `−${amount}`, label: `Decrease ${field.name} by ${amount}`, next: stepFieldValue(field, value, -1, ghost) },
    { text: `+${amount}`, label: `Increase ${field.name} by ${amount}`, next: stepFieldValue(field, value, 1, ghost) },
  ];
  return (
    <View style={[styles.stepperCell, styles.stepperPair]}>
      {buttons.map(({ text, label, next }) => (
        <TouchableOpacity
          key={text}
          style={[styles.stepButton, next === null && styles.disabled]}
          onPress={() => next !== null && onChange(next)}
          disabled={next === null}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: next === null }}
        >
          <NumericText style={styles.stepText}>{text}</NumericText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  grid: {
    gap: 7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
  },
  label: {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: t.fonts.xSmall,
    letterSpacing: 1.3,
    color: t.colors.role.textSecondary,
  },
  slot: {
    width: SLOT_WIDTH,
  },
  remove: {
    alignItems: "center",
    justifyContent: "center",
  },
  splitButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  splitText: {
    fontSize: t.fonts.xSmall,
    fontWeight: "bold",
    color: t.colors.role.textPrimary,
  },
  input: {
    flex: 1,
    minWidth: 0,
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
  inputCompact: {
    borderRadius: 12,
    fontSize: t.fonts.xLarge,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: t.colors.role.accent,
    paddingHorizontal: SPACING.small,
  },
  stepperCell: {
    flex: 1,
    minWidth: 0,
    height: HIT,
  },
  stepperPair: {
    flexDirection: "row",
    gap: 6,
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
