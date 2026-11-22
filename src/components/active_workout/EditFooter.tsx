import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SPACING } from "../../constants/styles";
import { TextBase } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The logger's footer while it holds an edit draft of a past workout (TICKET-102, board ESL2Logger): Cancel edit and
 * Save changes, in place of Finish workout. Save is the accent fill only once something changed (board ESL4Edited).
 *
 * TEMPORARY (TICKET-102 stage 1): Save is shown switched off whatever `changed` says, with a line saying so once there
 * is a change. Stage 2 passes `onSave`, which turns it on, and removes the line.
 */
export function EditFooter({ changed, onCancel }: { changed: boolean; onCancel: () => void }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.footer} testID="edit-footer">
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          <TextBase style={styles.cancelText}>Cancel edit</TextBase>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.save, styles.saveOff]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}>
          <TextBase style={styles.saveTextOff}>Save changes</TextBase>
        </TouchableOpacity>
      </View>
      {changed && <TextBase style={styles.note}>Saving an edit comes in the next build.</TextBase>}
    </View>
  );
}

// Sizes and colours as Finish workout's footer (`ActiveWorkoutScreen`); type 16 → medium, the note 12 → small.
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
    saveOff: {
      backgroundColor: t.colors.role.raised,
    },
    saveTextOff: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textSecondary,
    },
    note: {
      marginTop: SPACING.small,
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
      textAlign: "center",
    },
  });
