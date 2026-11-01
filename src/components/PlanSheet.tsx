// src/components/PlanSheet.tsx
//
// TICKET-052 (boards ManageNewInList, ManageNewName): Manage Workout's plan
// picker. A sheet, not `SearchableInputDropdown`: the board puts a name field
// in the list's first row, and a TextInput inside react-native-element-dropdown's
// modal list, beside its own search box, fights the keyboard (D6 c). No search:
// an MVP account has a few plans. Like VersionSheet, a View over the screen,
// not an RN `Modal`, so the guided tour's overlay can still sit above it.
//
// TICKET-061: archived plans are hidden behind "Show archived" beside the
// title, the same control as Start. `plans` arrives in Start's order (last done
// first); the sheet keeps it.

import React, { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../constants/styles";
import { WorkoutPlan, isArchived } from "../types/workoutType";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TextBase } from "./TextBase";
import { TouchableOpacityBase } from "./TouchableOpacityBase";
import PlanNameField from "./PlanNameField";
import { ShowArchivedToggle } from "./ShowArchivedToggle";

type Props = {
  plans: WorkoutPlan[];
  selectedId: string | null;
  onSelect: (plan: WorkoutPlan) => void;
  /** Creates the plan from a typed name, or returns why not (`newPlan`). */
  onCreate: (name: string) => string | null;
  onClose: () => void;
};

export default function PlanSheet({ plans, selectedId, onSelect, onCreate, onClose }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  // Tapping "New plan" turns that row into the name field (board ManageNewName).
  const [naming, setNaming] = useState(false);
  // Hidden on every open, as on Start, except when the open plan is archived:
  // hiding it would leave the sheet with no row marked as the current plan.
  // The sheet mounts per open, so this initialiser runs each time.
  const [showArchived, setShowArchived] = useState(() =>
    plans.some((plan) => plan.id === selectedId && isArchived(plan))
  );
  const current = plans.filter((plan) => !isArchived(plan));
  const archived = plans.filter(isArchived);

  // Android back closes the sheet, not the screen (as ExercisePicker does).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const renderList = (list: WorkoutPlan[], muted: boolean) => (
    <View style={[styles.list, muted && styles.listArchived]}>
      {list.map((plan, index) => {
        const selected = plan.id === selectedId;
        const count = plan.exercises.length;
        return (
          <TouchableOpacityBase
            key={plan.id}
            style={[styles.row, index > 0 && styles.rowDivider, selected && styles.rowSelected]}
            onPress={() => onSelect(plan)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <View style={styles.rowText}>
              <TextBase style={[styles.rowName, muted && !selected && styles.rowNameArchived]}>{plan.name}</TextBase>
              <TextBase style={styles.rowCount}>{`${count} ${count === 1 ? "exercise" : "exercises"}`}</TextBase>
            </View>
            {selected && <Ionicons name="checkmark" size={18} color={t.colors.role.accent} />}
          </TouchableOpacityBase>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={StyleSheet.absoluteFill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="plan-sheet"
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <TextBase style={styles.title}>Plan</TextBase>
          {archived.length > 0 && (
            <ShowArchivedToggle shown={showArchived} onPress={() => setShowArchived((shown) => !shown)} size="small" />
          )}
        </View>

        {naming ? (
          <PlanNameField label="New plan" autoFocus onCreate={onCreate} />
        ) : (
          <TouchableOpacityBase
            style={styles.newRow}
            onPress={() => setNaming(true)}
            accessibilityRole="button"
            accessibilityLabel="New plan"
          >
            <Ionicons name="add" size={18} color={t.colors.role.accent} />
            <TextBase style={styles.newRowText}>New plan</TextBase>
          </TouchableOpacityBase>
        )}

        {(current.length > 0 || (showArchived && archived.length > 0)) && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.groups} keyboardShouldPersistTaps="handled">
            {current.length > 0 && renderList(current, false)}
            {showArchived && archived.length > 0 && (
              <>
                <View style={styles.groupHeader}>
                  <TextBase style={styles.groupLabel}>ARCHIVED</TextBase>
                  <TextBase numeric style={styles.groupCount}>
                    {archived.length}
                  </TextBase>
                </View>
                {renderList(archived, true)}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "80%",
    gap: 12,
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: SPACING.xxLarge,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.role.hairlineStrong,
  },
  titleRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  title: { flex: 1, fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  newRow: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: t.colors.role.hairlineStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  newRowText: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  scroll: { flexGrow: 0, flexShrink: 1 },
  groups: { gap: SPACING.small },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.small, paddingTop: SPACING.xSmall, paddingHorizontal: 2 },
  groupLabel: { fontSize: t.fonts.xSmall, fontWeight: "bold", letterSpacing: 1.5, color: t.colors.role.textSecondary },
  groupCount: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  list: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    backgroundColor: t.colors.role.ground,
  },
  row: {
    minHeight: 58,
    paddingVertical: SPACING.small,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.role.hairline },
  rowSelected: { backgroundColor: t.colors.role.raised },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  // TICKET-061: as on Start, archived rows recede: no fill, muted name.
  listArchived: { backgroundColor: "transparent" },
  rowNameArchived: { color: t.colors.role.textSecondary },
  rowCount: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
});
