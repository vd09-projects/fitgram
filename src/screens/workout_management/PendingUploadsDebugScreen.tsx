// src/screens/workout_management/PendingUploadsDebugScreen.tsx
//
// TEMPORARY. Exists only so TICKET-028's upload queue can be checked on a device
// before TICKET-029 builds the real pending view. Delete this file, its route in
// constants/routes.tsx, its Stack.Screen in navigation/WorkoutNavigator.tsx and
// its tile in screens/WorkoutScreen.tsx — nothing else references it.
//
// What it is for:
//  - Finish offline: the count goes up, on disk as well as in memory
//  - kill and reopen the app: the on-disk count is unchanged
//  - reconnect, then "Retry uploads now" or foreground the app: the count drops
//    to 0 and failures, if any, show their message

import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScrollableScreen from "../../components/ScrollableScreen";
import { TextBase } from "../../components/TextBase";
import { useAuthUser } from "../../hooks/useAuthUser";
import { drainPendingUploads, useWorkoutStore } from "../../stores/useWorkoutStore";
import { BORDER_RADIUS, SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const when = (ms: number) =>
  new Date(ms).toLocaleDateString() + " " + new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Entries in AsyncStorage, read directly: memory can't prove the queue survives a restart. */
async function readDiskCount(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem("pendingUploads");
    if (!raw) return "0 (key absent)";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? String(parsed.length) : "unreadable";
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default function PendingUploadsDebugScreen() {
  const { styles } = useThemeStyles(createStyles);
  const { user } = useAuthUser();
  const pending = useWorkoutStore((s) => s.pendingUploads);
  const [diskCount, setDiskCount] = useState("…");
  const [draining, setDraining] = useState(false);

  const refreshDisk = useCallback(() => {
    readDiskCount().then(setDiskCount);
  }, []);

  // Re-read on focus and whenever the in-memory queue changes.
  useFocusEffect(refreshDisk);
  React.useEffect(refreshDisk, [pending, refreshDisk]);

  const retry = async () => {
    setDraining(true);
    try {
      await drainPendingUploads();
    } finally {
      setDraining(false);
      refreshDisk();
    }
  };

  const mine = pending.filter((e) => e.uid === user?.uid).length;

  return (
    <ScrollableScreen title={<TextBase style={styles.heading}>Pending Uploads (temporary)</TextBase>}>
      <View style={styles.counterCard}>
        <TextBase style={styles.counterLabel}>Workouts waiting to upload</TextBase>
        <TextBase style={styles.counter}>{pending.length}</TextBase>
        <TextBase style={styles.counterHint}>
          On disk: {diskCount} · yours: {mine} · other accounts: {pending.length - mine}
        </TextBase>
      </View>

      <TouchableOpacity style={styles.button} onPress={retry} disabled={draining}>
        <TextBase style={styles.buttonText}>
          {draining ? "Uploading… (stays here while offline)" : "Retry uploads now"}
        </TextBase>
      </TouchableOpacity>

      {pending.length === 0 ? (
        <TextBase style={styles.empty}>Queue is empty.</TextBase>
      ) : (
        pending.map((entry, index) => (
          <View key={entry.sessionId} style={styles.entry}>
            <TextBase style={styles.entryTitle}>
              {index + 1}. {entry.workout.name}
            </TextBase>
            <TextBase style={styles.entryLine}>Finished {when(entry.endedAt)}</TextBase>
            <TextBase style={styles.entryLine}>
              {entry.uid === user?.uid ? "Your account" : `Other account (${entry.uid.slice(0, 6)}…) — waits for its sign-in`}
            </TextBase>
            <TextBase style={styles.entryLine}>Session {entry.sessionId}</TextBase>
            {entry.failedAttempts > 0 && (
              <TextBase style={styles.warn}>
                Failed {entry.failedAttempts}×: {entry.lastError ?? "no message"}
              </TextBase>
            )}
          </View>
        ))
      )}
    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    heading: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.textPrimary,
      textAlign: "center",
    },
    counterCard: {
      backgroundColor: t.colors.cardBackground,
      borderRadius: BORDER_RADIUS,
      padding: SPACING.large,
      marginBottom: SPACING.large,
      alignItems: "center",
    },
    counterLabel: { fontSize: t.fonts.medium, color: t.colors.textPrimary },
    counter: { fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.cardHeader },
    counterHint: {
      fontSize: t.fonts.xMedium,
      color: t.colors.textPrimary,
      textAlign: "center",
      marginTop: SPACING.xSmall,
    },
    button: {
      backgroundColor: t.colors.button,
      borderRadius: BORDER_RADIUS,
      paddingHorizontal: SPACING.medium,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.medium,
    },
    buttonText: { color: t.colors.buttonText, fontSize: t.fonts.xMedium },
    entry: {
      paddingVertical: SPACING.xSmall,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.collapsed,
    },
    entryTitle: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.textPrimary },
    entryLine: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary },
    warn: { fontSize: t.fonts.xMedium, color: t.colors.cancelButton, marginTop: SPACING.xSmall },
    empty: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary },
  });
