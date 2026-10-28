// src/components/PlanNameField.tsx
//
// TICKET-052: a plan name field with Create, as on boards ManageNewName (the
// sheet's New plan row) and ManageFirst (the first-plan screen). The rules are
// in `newPlan` (utils/planDraft.ts); this only draws them. Create is disabled
// until something other than spaces is typed; any other refusal (too long, a
// duplicate) comes back from `onCreate` and shows under the field.

import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { SPACING } from "../constants/styles";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TextBase } from "./TextBase";
import { TouchableOpacityBase } from "./TouchableOpacityBase";

type Props = {
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Creates the plan, or returns why not. */
  onCreate: (name: string) => string | null;
};

export default function PlanNameField({ label, placeholder, autoFocus, onCreate }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const empty = name.trim() === "";

  const create = () => {
    if (empty) return;
    setError(onCreate(name));
  };

  return (
    <View style={styles.wrap}>
      <TextBase style={styles.label}>{label}</TextBase>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, error !== null && styles.inputError]}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={t.colors.role.textGhost}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={create}
          accessibilityLabel={label}
        />
        <TouchableOpacityBase
          style={[styles.create, empty && styles.createDisabled]}
          onPress={create}
          disabled={empty}
          accessibilityRole="button"
          accessibilityState={{ disabled: empty }}
        >
          <TextBase style={[styles.createText, empty && styles.createTextDisabled]}>Create</TextBase>
        </TouchableOpacityBase>
      </View>
      {error !== null && <TextBase style={styles.error}>{error}</TextBase>}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: t.fonts.xSmall,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: t.colors.role.textSecondary,
  },
  row: { flexDirection: "row", gap: SPACING.small },
  input: {
    flex: 1,
    minWidth: 0,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: t.colors.role.fieldEdge,
    backgroundColor: t.colors.role.raised,
    color: t.colors.role.textPrimary,
    fontSize: t.fonts.medium,
    fontWeight: "600",
  },
  inputError: { borderColor: t.colors.cancelButton },
  create: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.role.accent,
  },
  createDisabled: { backgroundColor: t.colors.role.raised },
  createText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.ground },
  createTextDisabled: { color: t.colors.role.textSecondary },
  error: { fontSize: t.fonts.xMedium, color: t.colors.cancelButton },
});
