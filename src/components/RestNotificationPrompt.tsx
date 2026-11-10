// src/components/RestNotificationPrompt.tsx
//
// The sheet that asks for the lock-screen rest timer (TICKET-079; board "Lock 2",
// copy in src/config/restNotification.ts). It opens by itself once, when the
// first rest starts; "Not now" is final, and the settings row can open it again.
// An RN `Modal` like MenuSheet, for the same reason: it must sit over any screen.
// Mounted once in App.tsx.

import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RestNotification from "../../modules/rest-notification";
import { PERM_PROMPT_ALLOW, PERM_PROMPT_BODY, PERM_PROMPT_SKIP, PERM_PROMPT_TITLE } from "../config/restNotification";
import { SPACING } from "../constants/styles";
import { useRestNotificationStore } from "../stores/restNotificationStore";
import { useWorkoutStore } from "../stores/useWorkoutStore";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TextBase } from "./TextBase";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";

export default function RestNotificationPrompt() {
  const { styles, t } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { state, promptSeen, promptOpen, isLoaded, openPrompt, dismissPrompt, acceptPrompt } =
    useRestNotificationStore();
  const resting = useWorkoutStore((s) => s.rest !== null);

  // The first rest, once: only while Android would still let us ask (Off), only if never answered.
  useEffect(() => {
    if (RestNotification.available && isLoaded && resting && state === "off" && !promptSeen) openPrompt();
  }, [resting, state, promptSeen, isLoaded, openPrompt]);

  if (!RestNotification.available) return null;

  return (
    <Modal visible={promptOpen} transparent animationType="slide" onRequestClose={dismissPrompt}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissPrompt} accessible={false} importantForAccessibility="no" />
        <View style={[styles.sheet, { paddingBottom: SPACING.xLarge + insets.bottom }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.badge}>
            <Ionicons name="barbell-outline" size={24} color={t.colors.role.accent} />
          </View>
          <View style={styles.copy}>
            <TextBase style={styles.title} accessibilityRole="header">
              {PERM_PROMPT_TITLE}
            </TextBase>
            <TextBase style={styles.body}>{PERM_PROMPT_BODY}</TextBase>
          </View>
          <TouchableOpacity style={styles.allow} onPress={acceptPrompt} accessibilityRole="button">
            <TextBase style={styles.allowText}>{PERM_PROMPT_ALLOW}</TextBase>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skip} onPress={dismissPrompt} accessibilityRole="button">
            <TextBase style={styles.skipText}>{PERM_PROMPT_SKIP}</TextBase>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  sheet: {
    gap: 12,
    backgroundColor: t.colors.role.surface,
    borderTopWidth: 1,
    borderColor: t.colors.role.hairline,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: SPACING.large,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.role.hairlineStrong },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.colors.role.accentDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: 6 },
  title: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  body: { fontSize: t.fonts.xMedium, lineHeight: 21, color: t.colors.role.textSecondary },
  allow: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.role.accent,
    marginTop: 4,
  },
  allowText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.ground },
  skip: { height: 48, alignItems: "center", justifyContent: "center" },
  skipText: { fontSize: t.fonts.xMedium, fontWeight: "600", color: t.colors.role.textSecondary },
});
