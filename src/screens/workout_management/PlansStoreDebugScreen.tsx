// src/screens/workout_management/PlansStoreDebugScreen.tsx
//
// TEMPORARY (TICKET-070, CLAUDE.md 3.3). Makes the plans store observable on a
// device: what it holds, what is on disk, and what each check did. Kept
// through stage 2, whose 1-read check it measures; remove before stage 2
// merges:
//  1. Delete this file.
//  2. Its route in constants/routes.tsx, its type and Stack.Screen in
//     navigation/WorkoutNavigator.tsx, its button in
//     components/workout_hub/HubDebugRow.tsx and WorkoutHubScreen, and its
//     mock in screens/LayoutScreen.test.tsx.
//  3. usePlansStore: `ReadoutEntry`, the `readout` field and its initial value,
//     `note` and its calls (every line marked TEMPORARY).
//
// What it is for (TICKET-070 device test):
//  - hub → All plans → Manage within 2 minutes: "server reads" goes up by 1,
//    the rest log "skipped"
//  - stage 2: each check logs its kind (full or change) and the docs it
//    returned; nothing changed is "ok change (0 docs)". "Last seen" is the
//    server stamp the next change check starts after
//  - Save in Manage: "holds" goes up, reads do not
//  - offline: the check logs "failed", the stored copy stays; "dropped" is
//    an answer set aside as older than a Save or a newer check, not a failure
//  - sign-out: the disk line says "key absent"
// Leaving the hub for this page and coming back is a focus: the hub checks
// (or skips) again, and the log shows it.

import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScrollableScreen from "../../components/ScrollableScreen";
import { TextBase } from "../../components/TextBase";
import { PLANS_STORAGE_KEY, usePlansStore } from "../../stores/usePlansStore";
import { PLANS_CHECK_SKIP_MS, PLANS_FULL_RELOAD_INTERVAL_MS } from "../../utils/planSync";
import type { PlanStamp } from "../../types/workoutType";
import { BORDER_RADIUS, SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const time = (ms: number) => new Date(ms).toLocaleTimeString();
// Seconds and nanoseconds as stored, plus a readable time: the console shows the latter.
const stamp = (s: PlanStamp) => `${new Date(s.seconds * 1000).toLocaleString()} (${s.seconds}s ${s.nanoseconds}ns)`;

/** The stored copy, read directly: memory can't prove what survives a restart or a sign-out. */
async function readDisk(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_STORAGE_KEY);
    if (raw === null) return "key absent";
    const parsed = JSON.parse(raw);
    const count = Array.isArray(parsed?.plans) ? parsed.plans.length : "?";
    const seen = parsed?.lastSeen ? `${parsed.lastSeen.seconds}s ${parsed.lastSeen.nanoseconds}ns` : "none";
    return `${count} plans · format ${parsed?.formatVersion} · user ${String(parsed?.uid).slice(0, 6)} · last seen ${seen} · ${raw.length} chars`;
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default function PlansStoreDebugScreen() {
  const { styles } = useThemeStyles(createStyles);
  const s = usePlansStore();
  const [disk, setDisk] = useState("…");

  const refreshDisk = useCallback(() => {
    readDisk().then(setDisk);
  }, []);
  useFocusEffect(refreshDisk);
  // Stored writes are chained and land a moment after the state changes.
  React.useEffect(() => {
    const timer = setTimeout(refreshDisk, 300);
    return () => clearTimeout(timer);
  }, [s.plans, s.uid, refreshDisk]);

  const rows: [string, string][] = [
    ["User", s.uid ? `${s.uid.slice(0, 6)}… · epoch ${s.epoch}` : `none · epoch ${s.epoch}`],
    ["Holds", s.plans === null ? "nothing stored" : `${s.plans.length} plans · from ${s.source}`],
    ["On disk", disk],
    ["Check", s.checking ? (s.waitOver ? "running, wait over" : "running") : "idle"],
    ["Last result", s.lastResult ?? "none"],
    ["Last ok", s.lastOkAt ? `${time(s.lastOkAt)} · checks skipped until ${time(s.lastOkAt + PLANS_CHECK_SKIP_MS)}` : "never"],
    ["Last seen", s.lastSeen ? stamp(s.lastSeen) : "none (a change check starts at the epoch)"],
    [
      "Last full reload",
      s.lastFullAt
        ? `${new Date(s.lastFullAt).toLocaleString()} · next due ${new Date(s.lastFullAt + PLANS_FULL_RELOAD_INTERVAL_MS).toLocaleString()}`
        : "never (the next check is full)",
    ],
    ["Server reads", `${s.readout.reads} this app run`],
  ];

  const button = (label: string, onPress: () => void) => (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <TextBase style={styles.buttonText}>{label}</TextBase>
    </TouchableOpacity>
  );

  return (
    <ScrollableScreen title={<TextBase style={styles.heading}>Plans Store (temporary)</TextBase>}>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <TextBase key={label} style={styles.line}>
            <TextBase style={styles.label}>{label}: </TextBase>
            {value}
          </TextBase>
        ))}
        {s.lastError && <TextBase style={styles.warn}>Error: {s.lastError}</TextBase>}
      </View>

      {/* Force check: Try again's path. Expire skip: so a test need not wait 2 minutes.
          Clear store: sign-out's clear without signing out; the next plans screen reloads. */}
      {button("Force check now", () => usePlansStore.getState().check({ force: true }))}
      {button("Expire the 2-minute skip", () => usePlansStore.setState({ lastOkAt: null }))}
      {button("Full reload now (as Try again)", () => usePlansStore.getState().check({ force: true, full: true }))}
      {button("Clear store (as sign-out)", () => usePlansStore.getState().clear())}

      <TextBase style={styles.section}>Checks, newest first</TextBase>
      {s.readout.log.length === 0 ? (
        <TextBase style={styles.line}>None yet.</TextBase>
      ) : (
        s.readout.log.map((entry, index) => (
          <TextBase key={index} style={styles.line}>
            {time(entry.at)} {entry.outcome}
            {entry.kind ? ` ${entry.kind}` : ""}
            {entry.detail ? ` (${entry.detail})` : ""}
          </TextBase>
        ))
      )}

      <TextBase style={styles.section}>Plans held, in stored order</TextBase>
      {(s.plans ?? []).map((plan) => (
        <TextBase key={plan.id} style={styles.line}>
          {plan.name} · {plan.exercises.length} ex · {plan.id}
          {plan.archived ? " · archived" : ""}
          {plan.updatedAt ? ` · ${plan.updatedAt.seconds}s ${plan.updatedAt.nanoseconds}ns` : " · no stamp"}
        </TextBase>
      ))}
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
    card: {
      backgroundColor: t.colors.cardBackground,
      borderRadius: BORDER_RADIUS,
      padding: SPACING.medium,
      marginBottom: SPACING.large,
      gap: SPACING.xSmall,
    },
    label: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.textPrimary },
    line: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary },
    warn: { fontSize: t.fonts.xMedium, color: t.colors.cancelButton },
    section: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.textPrimary,
      marginTop: SPACING.large,
      marginBottom: SPACING.xSmall,
    },
    button: {
      backgroundColor: t.colors.button,
      borderRadius: BORDER_RADIUS,
      paddingHorizontal: SPACING.medium,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.small,
    },
    buttonText: { color: t.colors.buttonText, fontSize: t.fonts.xMedium },
  });
