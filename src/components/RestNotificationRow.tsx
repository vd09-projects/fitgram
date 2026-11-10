// src/components/RestNotificationRow.tsx
//
// The settings row for the lock-screen rest timer (TICKET-079; board "Lock 4"):
// On, Off or Blocked, from `restNotificationState`. Off opens the same sheet as
// the first rest; Blocked opens Android's settings page, the only way back once
// Android will not show its dialog again. Hidden where there is no native module.
//
// Drawn from board "Lock 4" with the `role` tokens (surface, hairline, textPrimary,
// textSecondary), not the legacy colour keys the other Profile sections use: those
// read the title dimmer than its detail line. TextBase only makes `fontWeight:
// "bold"` heavy, so the title is bold where the board says 600. The Off and
// Blocked glyph is Ionicons' barbell: the board's pulse-bar path needs
// react-native-svg, which the app does not have.

import React, { useEffect } from "react";
import { Linking, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RestNotification from "../../modules/rest-notification";
import {
  SETTINGS_ACTION_OPEN,
  SETTINGS_ACTION_TURN_ON,
  SETTINGS_ROW_BLOCKED,
  SETTINGS_ROW_OFF,
  SETTINGS_ROW_ON,
  SETTINGS_ROW_TITLE,
} from "../config/restNotification";
import { SPACING } from "../constants/styles";
import { useRestNotificationStore } from "../stores/restNotificationStore";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TextBase } from "./TextBase";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";

export default function RestNotificationRow() {
  const { styles, t } = useThemeStyles(createStyles);
  const state = useRestNotificationStore((s) => s.state);
  const refresh = useRestNotificationStore((s) => s.refresh);
  const openPrompt = useRestNotificationStore((s) => s.openPrompt);

  // Fresh when the row first shows. Coming back from Android's settings page is
  // handled once for the whole app (`watchRestNotificationForeground`).
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!RestNotification.available || state === "unknown") return null;

  const detail = state === "on" ? SETTINGS_ROW_ON : state === "off" ? SETTINGS_ROW_OFF : SETTINGS_ROW_BLOCKED;

  return (
    <View style={styles.row} testID="rest-notification-row">
      <View style={[styles.icon, state === "on" && styles.iconOn]}>
        <Ionicons
          name={state === "on" ? "checkmark" : "barbell-outline"}
          size={state === "on" ? 18 : 20}
          color={state === "on" ? t.colors.role.accent : t.colors.role.textSecondary}
        />
      </View>
      <View style={styles.text}>
        <TextBase style={styles.title}>{SETTINGS_ROW_TITLE}</TextBase>
        <TextBase style={styles.detail}>{detail}</TextBase>
      </View>
      {state === "on" && <TextBase style={styles.status}>On</TextBase>}
      {state === "off" && (
        <TouchableOpacity style={styles.action} onPress={openPrompt} accessibilityRole="button">
          <TextBase style={styles.actionText}>{SETTINGS_ACTION_TURN_ON}</TextBase>
        </TouchableOpacity>
      )}
      {state === "blocked" && (
        <TouchableOpacity style={styles.actionOutlined} onPress={() => Linking.openSettings()} accessibilityRole="button">
          <TextBase style={styles.actionOutlinedText}>{SETTINGS_ACTION_OPEN}</TextBase>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: SPACING.small,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.role.hairline,
    backgroundColor: t.colors.role.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.role.raised,
  },
  iconOn: { backgroundColor: t.colors.role.accentDeep },
  text: { flex: 1, gap: 2 },
  title: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
  detail: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  status: { fontSize: t.fonts.small, fontWeight: "bold", color: t.colors.role.accent },
  action: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.role.accent,
  },
  actionText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.ground },
  actionOutlined: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
  },
  actionOutlinedText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textPrimary },
});
