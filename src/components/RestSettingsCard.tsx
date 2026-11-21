// src/components/RestSettingsCard.tsx
//
// The one settings card for the lock-screen rest timer (TICKET-079) and its end-of-rest sound (TICKET-098; boards
// "Lock 4" and "Sound 1"): the permission row, then the sound row below it. Hidden where there is no native
// module, or before Android has been read, as `RestNotificationRow` was alone.

import React from "react";
import { StyleSheet, View } from "react-native";
import RestNotification from "../../modules/rest-notification";
import { SPACING } from "../constants/styles";
import { useRestNotificationStore } from "../stores/restNotificationStore";
import { useThemeStyles } from "../utils/useThemeStyles";
import RestNotificationRow from "./RestNotificationRow";
import RestSoundRow from "./RestSoundRow";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";

export default function RestSettingsCard() {
  const { styles } = useThemeStyles(createStyles);
  const state = useRestNotificationStore((s) => s.state);

  if (!RestNotification.available || state === "unknown") return null;

  return (
    <View style={styles.card}>
      <RestNotificationRow />
      <RestSoundRow state={state} />
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      marginTop: SPACING.small,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      backgroundColor: t.colors.role.surface,
      overflow: "hidden",
    },
  });
