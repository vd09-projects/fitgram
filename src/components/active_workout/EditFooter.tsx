import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SPACING } from "../../constants/styles";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The logger's footer while it holds an edit draft of a past workout (TICKET-102, board ESL2Logger): Cancel edit and
 * Save changes, in place of Finish workout. Save is the accent fill once something changed (board ESL4Edited), "Saving…"
 * while the save runs, and off otherwise. A refused save shows above the buttons (board ESL6Offline) and keeps the draft.
 */
export function EditFooter({
  changed,
  saving,
  error,
  onSave,
  onCancel,
}: {
  changed: boolean;
  saving: boolean;
  error: { title: string; detail: string } | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const canSave = changed && !saving;
  return (
    <View style={styles.footer} testID="edit-footer">
      {error && (
        <View style={styles.error} accessibilityRole="alert">
          <TextBase style={styles.errorTitle}>{error.title}</TextBase>
          <TextBase style={styles.errorDetail}>{error.detail}</TextBase>
        </View>
      )}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={saving} accessibilityRole="button">
          <TextBase style={styles.cancelText}>Cancel edit</TextBase>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.save, canSave ? styles.saveOn : styles.saveOff]}
          onPress={onSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: saving }}
        >
          <TextBase style={canSave ? styles.saveTextOn : styles.saveTextOff}>{saving ? "Saving…" : "Save changes"}</TextBase>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Sizes and colours as Finish workout's footer (`ActiveWorkoutScreen`); type: buttons 16 → medium, error title 14 → xMedium, its line 12 → small.
const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    footer: {
      paddingTop: SPACING.medium,
      paddingHorizontal: SPACING.xMedium,
      paddingBottom: SPACING.xxLarge,
      backgroundColor: t.colors.role.surface,
      borderTopWidth: 1,
      borderTopColor: t.colors.role.hairline,
    },
    buttons: {
      flexDirection: "row",
      gap: SPACING.small,
    },
    cancel: {
      width: 132,
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    save: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    saveOn: {
      backgroundColor: t.colors.role.accent,
    },
    saveOff: {
      backgroundColor: t.colors.role.raised,
    },
    saveTextOn: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
    saveTextOff: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textSecondary,
    },
    error: {
      marginBottom: SPACING.small,
      padding: SPACING.small,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      backgroundColor: t.colors.role.ground,
      gap: 2,
    },
    errorTitle: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    errorDetail: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
  });
