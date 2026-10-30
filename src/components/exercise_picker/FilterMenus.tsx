// src/components/exercise_picker/FilterMenus.tsx
//
// Board A1's three filter menus (TICKET-050): Muscle / Equipment / Type. One
// row of buttons just above the search box (user, 2026-10-27, D2: the box is
// at the bottom since TICKET-043, board A1 had both at the top); each opens a
// list as a sheet. One value per menu, or Any (D4). The matching rules are in
// utils/pickerData.ts (`matchesFilters`).

import React from "react";
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { CATEGORIES, EQUIPMENT, MUSCLE_GROUPS } from "../../constants/catalogVocabulary";
import type { EquipmentId } from "../../constants/catalogVocabulary";
import type { PickerFilters } from "../../utils/pickerData";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { TextBase } from "../TextBase";

export type FilterMenu = keyof PickerFilters;

const TITLES: Record<FilterMenu, string> = { group: "Muscle", equipment: "Equipment", category: "Type" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Each menu's options in order: muscle groups and types as the vocabulary lists them, equipment most used first. */
function menuOptions(menu: FilterMenu, equipmentByUse: readonly EquipmentId[]): Array<{ value: string; label: string }> {
  if (menu === "group") return Object.entries(MUSCLE_GROUPS).map(([value, label]) => ({ value, label }));
  if (menu === "category") return Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }));
  return equipmentByUse.map((value) => ({ value, label: cap(EQUIPMENT[value]) }));
}

function selectedLabel(menu: FilterMenu, filters: PickerFilters): string | null {
  if (menu === "group") return filters.group ? MUSCLE_GROUPS[filters.group] : null;
  if (menu === "category") return filters.category ? CATEGORIES[filters.category] : null;
  return filters.equipment ? cap(EQUIPMENT[filters.equipment]) : null;
}

export function FilterRow({ filters, onOpen }: { filters: PickerFilters; onOpen: (menu: FilterMenu) => void }) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <View style={styles.filterRow}>
      {(Object.keys(TITLES) as FilterMenu[]).map((menu) => {
        const chosen = selectedLabel(menu, filters);
        return (
          <TouchableOpacity
            key={menu}
            style={[styles.menuButton, chosen !== null && styles.menuButtonOn]}
            onPress={() => onOpen(menu)}
            accessibilityRole="button"
            accessibilityLabel={`${TITLES[menu]} filter${chosen ? `: ${chosen}` : ""}`}
            accessibilityState={{ selected: chosen !== null }}
          >
            <TextBase style={[styles.menuText, chosen !== null && styles.menuTextOn]} numberOfLines={1}>
              {chosen ?? TITLES[menu]}
            </TextBase>
            <Ionicons name="chevron-down" size={14} color={chosen !== null ? t.colors.role.ground : t.colors.role.textSecondary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type SheetProps = {
  menu: FilterMenu;
  filters: PickerFilters;
  equipmentByUse: readonly EquipmentId[];
  onChange: (filters: PickerFilters) => void;
  onClose: () => void;
};

export function FilterSheet({ menu, filters, equipmentByUse, onChange, onClose }: SheetProps) {
  const { styles } = useThemeStyles(createStyles);
  const current = filters[menu];
  const choose = (value: string | undefined) => {
    onChange({ ...filters, [menu]: value });
    onClose();
  };
  const options = [{ value: undefined as string | undefined, label: "Any" }, ...menuOptions(menu, equipmentByUse)];
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet} testID="filter-sheet">
        <TextBase style={styles.sheetTitle}>{TITLES[menu]}</TextBase>
        <ScrollView keyboardShouldPersistTaps="handled">
          {options.map((option) => {
            const selected = option.value === current;
            return (
              <TouchableOpacity
                key={option.value ?? "any"}
                style={styles.option}
                onPress={() => choose(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <TextBase style={[styles.optionText, selected && styles.optionTextOn]}>{option.label}</TextBase>
                {selected && <Ionicons name="checkmark" size={18} color={styles.optionTextOn.color} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  // Above the picker's search box: Paper's floating "Search" label carries
  // its own zIndex and, once Android flattens the views between, drew over
  // this sheet (device, 2026-10-31). Order in the tree alone does not win.
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10 },
  filterRow: { flexDirection: "row", gap: SPACING.small, paddingTop: SPACING.small },
  menuButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.small,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.raised,
  },
  menuButtonOn: { borderColor: t.colors.role.accent, backgroundColor: t.colors.role.accent },
  menuText: { flexShrink: 1, fontSize: t.fonts.small, color: t.colors.role.textPrimary },
  menuTextOn: { color: t.colors.role.ground, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: SPACING.large,
  },
  sheetTitle: { fontSize: 19, fontWeight: "bold", color: t.colors.role.textPrimary, marginBottom: SPACING.small },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.medium,
    borderBottomWidth: 1,
    borderColor: t.colors.role.hairline,
  },
  optionText: { fontSize: t.fonts.medium, color: t.colors.role.textPrimary },
  optionTextOn: { color: t.colors.role.accent, fontWeight: "600" },
});
