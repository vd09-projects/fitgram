// src/components/exercise_picker/VersionSheet.tsx
//
// Board A3 (TICKET-043): pick the version of a movement. All the logic is in
// utils/versionSheet.ts; this draws it. A sheet inside the picker, not an RN
// `Modal`: the guided tour's overlay is mounted at the app root and a Modal
// would cover it, so the sheet's tour step could never show.

import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import type { Movement, MovementVersion } from "../../types/catalog";
import { buildVersionName } from "../../utils/catalog";
import type { VersionPick } from "../../utils/exerciseSearch";
import { chooseOption, chosenAllInPlan, initialSheet, selectedVersion, sheetRows } from "../../utils/versionSheet";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { TextBase } from "../TextBase";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";
import { makeStepId } from "../../tour_steps/utils";
import { EXERCISE_PICKER_STEP_NAMES } from "../../tour_steps/commonStepNames";

type Props = {
  movement: Movement;
  subtitle: string;
  preselect: VersionPick;
  inPlan: ReadonlySet<string>;
  onAdd: (version: MovementVersion) => void;
  onClose: () => void;
  tourStepPrefix?: string;
};

export default function VersionSheet({ movement, subtitle, preselect, inPlan, onAdd, onClose, tourStepPrefix }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [state, setState] = useState(() => initialSheet(movement, preselect, inPlan));
  const rows = sheetRows(movement, state, inPlan);
  const version = selectedVersion(movement, state, inPlan);
  const missing = rows.find((r) => r.selected === undefined);
  const addLabel = version
    ? `Add ${buildVersionName(movement, version)}`
    : missing && !chosenAllInPlan(movement, state, inPlan)
      ? `Choose ${missing.title.toLowerCase()}`
      : "Already in this plan";

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <MaybeTourStep stepId={makeStepId(EXERCISE_PICKER_STEP_NAMES.VERSION_SHEET, tourStepPrefix)} positionType="above">
        <View style={styles.sheet} testID="version-sheet">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <TextBase style={styles.title}>{movement.name}</TextBase>
              <TextBase style={styles.subtitle}>{subtitle}</TextBase>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={t.colors.role.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.rows} keyboardShouldPersistTaps="handled">
            {rows.map((row) => (
              <View key={row.axis} style={styles.row}>
                <TextBase style={styles.rowTitle}>{row.title}</TextBase>
                <View style={styles.chips}>
                  {row.options.map((option) => {
                    const selected = row.selected === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        disabled={!option.enabled}
                        onPress={() => setState((s) => chooseOption(movement, s, row.axis, option.value, inPlan))}
                        style={[styles.chip, selected && styles.chipSelected, !option.enabled && styles.chipDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.title} ${option.label}`}
                        accessibilityState={{ selected, disabled: !option.enabled }}
                      >
                        <TextBase style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</TextBase>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            disabled={!version}
            onPress={() => version && onAdd(version)}
            style={[styles.add, !version && styles.addDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !version }}
          >
            <TextBase style={styles.addText} numberOfLines={2}>{addLabel}</TextBase>
          </TouchableOpacity>
        </View>
      </MaybeTourStep>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: SPACING.large,
    paddingHorizontal: SPACING.large,
    paddingBottom: SPACING.large,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: "bold", color: t.colors.role.textPrimary },
  subtitle: { marginTop: 3, fontSize: 12, color: t.colors.role.textSecondary },
  close: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: t.colors.role.raised,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  rows: { marginTop: SPACING.medium },
  row: { marginBottom: SPACING.medium },
  rowTitle: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textSecondary,
    marginBottom: SPACING.small,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.small },
  chip: {
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.medium,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.raised,
  },
  chipSelected: { borderColor: t.colors.role.accent, backgroundColor: t.colors.role.accent },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: t.fonts.small, color: t.colors.role.textPrimary },
  chipTextSelected: { color: t.colors.role.ground, fontWeight: "600" },
  add: {
    marginTop: SPACING.small,
    paddingVertical: SPACING.medium,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: t.colors.role.accent,
  },
  addDisabled: { opacity: 0.4 },
  addText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.ground, textAlign: "center" },
});
