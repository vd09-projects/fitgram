// src/components/MenuSheet.tsx
//
// A ⋯ menu as a bottom sheet: a title, groups of rows, and Close. Used by the
// exercise ⋯ (TICKET-058, boards MenuSplit, MenuSplitAgain, MenuSplitWait) and
// the workout ⋯ (TICKET-056, board AddMenu). It was ExerciseMenu, with Discard
// as a special `destructive` prop; now every row is the same shape and the
// sheet knows nothing of either screen. Groups and tone are data: a row that
// must stand apart (Discard) is its own group, and a dangerous one says so with
// `tone: "danger"`. Rejected: separate ExerciseMenu and WorkoutMenu files,
// two copies of one sheet whose only difference was that one row.
//
// An RN `Modal`, like the history sheet, not a View over the screen like
// PlanSheet. The exercise ⋯'s items act on `ExerciseLogger`'s draft (the rows,
// an open edit), so the logger renders it; the logger sits inside the scroll
// view, where an absolute View would cover the scroll content, not the screen.
// Rejected: PlanSheet's pattern, which would need the draft lifted to the
// screen or reached through a ref. PlanSheet avoids `Modal` so the guided tour
// can sit above it; the tour (TICKET-053) points at the ⋯, not inside this.

import React from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "../constants/styles";
import { TextBase } from "./TextBase";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

/**
 * One row of the menu. A disabled item stays in the list with its reason in
 * place of its detail line, rather than disappearing (board MenuSplitWait), so
 * the menu never changes shape under the user and says why. TICKET-047 adds
 * "Swap exercise" this way, disabled once a set is logged.
 */
export type MenuItem = {
  key: string;
  renderIcon: (color: string) => React.ReactNode;
  title: string;
  /** The line under the title. Absent: a single-line, shorter row (Discard). */
  detail?: string;
  /** Why the item cannot be used now; absent or null when it can. */
  disabledReason?: string | null;
  /** "danger": icon and title in `danger`, for an action that loses data. */
  tone?: "danger";
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  /**
   * Each group is its own rounded list, with a gap between groups. A
   * destructive row goes in a group of its own, so a tap meant for the row
   * above cannot land on it (board AddMenu).
   */
  groups: MenuItem[][];
  onClose: () => void;
  testID?: string;
};

export default function MenuSheet({ visible, title, groups, onClose, testID }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();

  const iconColor = (item: MenuItem, disabled: boolean) =>
    disabled ? t.colors.role.textSecondary : item.tone === "danger" ? t.colors.role.danger : t.colors.role.accent;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* A convenience only: Close is the labelled way out. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          style={[styles.sheet, { paddingBottom: SPACING.xLarge + insets.bottom }]}
          accessibilityViewIsModal
          testID={testID}
        >
          <View style={styles.handle} />
          <TextBase style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {title}
          </TextBase>

          {groups.map((group) => (
            <View key={group.map((item) => item.key).join("|")} style={styles.list}>
              {group.map((item, index) => {
                const disabled = item.disabledReason != null;
                const detail = item.disabledReason ?? item.detail;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.item,
                      detail === undefined && styles.itemSingleLine,
                      index > 0 && styles.itemDivider,
                      disabled && styles.itemDisabled,
                    ]}
                    // Closes first: the item acts on the screen behind the sheet.
                    onPress={() => {
                      onClose();
                      item.onPress();
                    }}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={detail === undefined ? item.title : `${item.title}, ${detail}`}
                    accessibilityState={{ disabled }}
                  >
                    {item.renderIcon(iconColor(item, disabled))}
                    <View style={styles.itemText}>
                      <TextBase
                        style={[
                          styles.itemTitle,
                          item.tone === "danger" && styles.itemTitleDanger,
                          disabled && styles.itemTitleDisabled,
                        ]}
                      >
                        {item.title}
                      </TextBase>
                      {detail !== undefined && <TextBase style={styles.itemDetail}>{detail}</TextBase>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <TextBase style={styles.closeText}>Close</TextBase>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    gap: 12,
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: SPACING.medium,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.role.hairlineStrong,
  },
  title: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  list: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    overflow: "hidden",
  },
  item: {
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.colors.role.raised,
  },
  itemSingleLine: { minHeight: 52 },
  itemDivider: { borderTopWidth: 1, borderTopColor: t.colors.role.hairline },
  // Board MenuSplitWait: the row sinks to the sheet's own surface.
  itemDisabled: { backgroundColor: t.colors.role.surface },
  itemText: { flex: 1, gap: 3 },
  itemTitle: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  itemTitleDanger: { color: t.colors.role.danger },
  itemTitleDisabled: { color: t.colors.role.textSecondary },
  itemDetail: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  close: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  closeText: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
});
