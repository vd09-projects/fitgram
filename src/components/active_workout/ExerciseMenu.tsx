// src/components/active_workout/ExerciseMenu.tsx
//
// TICKET-058 (boards MenuSplit, MenuSplitAgain, MenuSplitWait): the exercise ⋯
// menu, a sheet titled with the exercise name, its items, and Close. Exercise
// level only. The header's workout ⋯ is the same sheet with workout-level
// items (TICKET-056), rendered by the screen.
//
// An RN `Modal`, like the history sheet and the workout ⋯, not a View over the
// screen like PlanSheet. Its items act on `ExerciseLogger`'s draft (the rows,
// an open edit), so the logger renders it; the logger sits inside the scroll
// view, where an absolute View would cover the scroll content, not the screen.
// Rejected: PlanSheet's pattern, which would need the draft lifted to the
// screen or reached through a ref. PlanSheet avoids `Modal` so the guided tour
// can sit above it; the tour (TICKET-053) points at the ⋯, not inside this.

import React from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING } from "../../constants/styles";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * One row of the menu. A disabled item stays in the list with its reason in
 * place of its detail line, rather than disappearing (board MenuSplitWait), so
 * the menu never changes shape under the user and says why. TICKET-047 adds
 * "Swap exercise" this way, disabled once a set is logged.
 */
export type ExerciseMenuItem = {
  key: string;
  renderIcon: (color: string) => React.ReactNode;
  title: string;
  detail: string;
  /** Why the item cannot be used now; null when it can. */
  disabledReason: string | null;
  onPress: () => void;
};

/**
 * A destructive action, in its own group under the items, in `danger`, with no
 * detail line (TICKET-056 board AddMenu: Discard workout). Its own group so a
 * tap meant for the item above cannot land on it.
 */
export type DestructiveMenuItem = {
  key: string;
  renderIcon: (color: string) => React.ReactNode;
  title: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  items: ExerciseMenuItem[];
  destructive?: DestructiveMenuItem;
  onClose: () => void;
  testID?: string;
};

/**
 * Also the workout ⋯ (TICKET-056): the same sheet, workout-level items, and
 * Discard as its `destructive` item. Kept under this name rather than renamed,
 * as the exercise menu is still its main use.
 */
export default function ExerciseMenu({ visible, title, items, destructive, onClose, testID = "exercise-menu" }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();

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

          <View style={styles.list}>
            {items.map((item, index) => {
              const disabled = item.disabledReason !== null;
              const detail = item.disabledReason ?? item.detail;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.item, index > 0 && styles.itemDivider, disabled && styles.itemDisabled]}
                  // Closes first: the item acts on the screen behind the sheet.
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${detail}`}
                  accessibilityState={{ disabled }}
                >
                  {item.renderIcon(disabled ? t.colors.role.textSecondary : t.colors.role.accent)}
                  <View style={styles.itemText}>
                    <TextBase style={[styles.itemTitle, disabled && styles.itemTitleDisabled]}>{item.title}</TextBase>
                    <TextBase style={styles.itemDetail}>{detail}</TextBase>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {destructive && (
            <View style={styles.list}>
              <TouchableOpacity
                style={[styles.item, styles.itemDestructive]}
                onPress={() => {
                  onClose();
                  destructive.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={destructive.title}
              >
                {destructive.renderIcon(t.colors.role.danger)}
                <TextBase style={[styles.itemTitle, styles.itemTitleDanger]}>{destructive.title}</TextBase>
              </TouchableOpacity>
            </View>
          )}

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
  itemDivider: { borderTopWidth: 1, borderTopColor: t.colors.role.hairline },
  // Board MenuSplitWait: the row sinks to the sheet's own surface.
  itemDisabled: { backgroundColor: t.colors.role.surface },
  itemText: { flex: 1, gap: 3 },
  itemTitle: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  itemTitleDisabled: { color: t.colors.role.textSecondary },
  itemDestructive: { minHeight: 52 },
  itemTitleDanger: { color: t.colors.role.danger },
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
