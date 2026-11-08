// src/screens/workout_management/PlansStoreDebugScreen.tsx
//
// Debug tooling, kept for good (TICKET-070; user, 2026-11-06), behind
// `showDebugScreens` like the other debug pages: a device run needs
// `SHOW_DEBUG_SCREENS=true` in `.env` and a Metro restart, and release builds
// never show it (docs/RELEASE.md). Makes the plans store observable on a
// device: what it holds, what is on disk, and what each check did. Built as
// CLAUDE.md 3.3's instrument for TICKET-070; kept because the store is
// invisible otherwise, and TICKET-072/073 build on it.
//
// Its parts, if it is ever removed: this file; its route in
// constants/routes.tsx, its type and Stack.Screen in
// navigation/WorkoutNavigator.tsx, its button in
// components/workout_hub/HubDebugRow.tsx and WorkoutHubScreen, its mock in
// screens/LayoutScreen.test.tsx; in usePlansStore, `ReadoutEntry`, the
// `readout` field and `note` (each marked "debug readout").
//
// What it shows (TICKET-070 device test):
//  - hub → All plans → Manage within the check skip: "server reads" goes up by 1,
//    the rest log "skipped"
//  - stage 2: each check logs its kind (full or change) and the docs it
//    returned; nothing changed is "ok change (0 docs)". "Last seen" is the
//    server stamp the next change check starts after
//  - Save in Manage: "holds" goes up, reads do not
//  - offline: the check logs "failed", the stored copy stays; "dropped" is
//    an answer set aside as older than a Save or a newer check, not a failure
//  - sign-out: the disk line says "key absent"
//  - TICKET-073: each plan's `rev`; a refused save logs "refused" (with
//    "late from the queue" when it landed from the offline queue), then its
//    one-plan reload: "ok refusal reload (by reading it, rev N)" or "failed"
//  - each plan's version id, first 6 characters (PR #50 review, B1): two
//    phones showing the same rev and id are on the same version
// Leaving the hub for this page and coming back is a focus: the hub checks
// (or skips) again, and the log shows it.
//
// The recent workouts store (TICKET-075) has its own section under the plans
// (`WorkoutsSection`): per plan, the workouts held and the newest date;
// `lastSeen`; each check with its queries and docs; and the reads Firestore
// bills this app run, which is the ticket's measure (a query that returns
// nothing bills 1). Remove with the page: the section, and in
// useRecentWorkoutsStore the `billedReads` field and `bill` (marked "debug readout").
//
// TEMPORARY: `SummariesSection` (TICKET-076, CLAUDE.md 3.3): the exercise
// summaries store's held count, `lastSeen`, last full load, last checks and
// reads billed. Remove once TICKET-076 is accepted: the component and its one
// use below, and in useExerciseHistoryStore the `billedReads` field, `billed`,
// and the own-Finish `note`.

import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScrollableScreen from "../../components/ScrollableScreen";
import { TextBase } from "../../components/TextBase";
import { usePlansStore } from "../../stores/usePlansStore";
import { useRecentWorkoutsStore } from "../../stores/useRecentWorkoutsStore";
import { useExerciseHistoryStore } from "../../stores/useExerciseHistoryStore";
import { FREESTYLE_ID } from "../../constants/freestyle";
import type { PlanStamp } from "../../types/workoutType";
import { storedSummariesKeys } from "../../utils/exerciseSummariesSync";
import { BORDER_RADIUS, SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import {
  EXERCISE_SUMMARIES_CHECK_SKIP_MS,
  EXERCISE_SUMMARIES_SHARDS,
  PLANS_CHECK_SKIP_MS,
  WORKOUTS_CHECK_SKIP_MS,
  WORKOUTS_PER_PLAN,
} from "../../config/sync";
import { EXERCISE_SUMMARIES_STORAGE_KEY, PLANS_STORAGE_KEY, WORKOUTS_STORAGE_KEY } from "../../config/storageKeys";

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
    ["Last full reload", s.lastFullAt ? new Date(s.lastFullAt).toLocaleString() : "not recorded"],
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

      {/* Force check: Try again's path. Expire skip: so a test need not wait it out.
          Clear store: sign-out's clear without signing out; the next plans screen reloads. */}
      {button("Force check now", () => usePlansStore.getState().check({ force: true }))}
      {button("Expire the skip", () => usePlansStore.setState({ lastOkAt: null }))}
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
          {plan.version ? ` · rev ${plan.version.rev} · id ${plan.version.id.slice(0, 6)}` : " · no version (rev 0)"}
        </TextBase>
      ))}

      <WorkoutsSection planNames={new Map((s.plans ?? []).map((plan) => [plan.id, plan.name]))} />
      <SummariesSection />
    </ScrollableScreen>
  );
}

/** The stored workouts, read directly, as `readDisk` for the plans. */
async function readWorkoutsDisk(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
    if (raw === null) return "key absent";
    const parsed = JSON.parse(raw);
    const plans = parsed?.byPlan ? Object.keys(parsed.byPlan).length : "?";
    return `${plans} plans · N ${parsed?.n} · format ${parsed?.formatVersion} · user ${String(parsed?.uid).slice(0, 6)} · ${raw.length} chars`;
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** The recent workouts store (TICKET-075). Same buttons and log as the plans, for this store. */
function WorkoutsSection({ planNames }: { planNames: Map<string, string> }) {
  const { styles } = useThemeStyles(createStyles);
  const w = useRecentWorkoutsStore();
  const [disk, setDisk] = useState("…");
  const refreshDisk = useCallback(() => {
    readWorkoutsDisk().then(setDisk);
  }, []);
  useFocusEffect(refreshDisk);
  React.useEffect(() => {
    const timer = setTimeout(refreshDisk, 300);
    return () => clearTimeout(timer);
  }, [w.byPlan, w.uid, refreshDisk]);

  const rows: [string, string][] = [
    ["Holds", w.byPlan === null ? "nothing (readers say last session unknown)" : `${Object.keys(w.byPlan).length} plans · newest ${WORKOUTS_PER_PLAN} each · ${w.loaded.length} loaded`],
    ["On disk", disk],
    ["Check", w.checking ? (w.waitOver ? "running, wait over" : "running") : "idle"],
    ["Last result", w.lastResult ?? "none"],
    ["Last ok", w.lastOkAt ? `${time(w.lastOkAt)} · checks skipped until ${time(w.lastOkAt + WORKOUTS_CHECK_SKIP_MS)}` : "never"],
    ["Last seen", w.lastSeen ? stamp(w.lastSeen) : "none (a change check starts at the epoch)"],
    ["Last full reload", w.lastFullAt ? new Date(w.lastFullAt).toLocaleString() : "not recorded"],
    ["Checks", `${w.readout.reads} this app run`],
    ["Reads billed", `${w.billedReads} this app run (session docs, 1 per empty query)`],
  ];

  const button = (label: string, onPress: () => void) => (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <TextBase style={styles.buttonText}>{label}</TextBase>
    </TouchableOpacity>
  );

  return (
    <>
      <TextBase style={styles.section}>Recent workouts store (TICKET-075)</TextBase>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <TextBase key={label} style={styles.line}>
            <TextBase style={styles.label}>{label}: </TextBase>
            {value}
          </TextBase>
        ))}
        {w.lastError && <TextBase style={styles.warn}>Error: {w.lastError}</TextBase>}
      </View>

      {button("Workouts: force check now", () => useRecentWorkoutsStore.getState().check({ force: true }))}
      {button("Workouts: expire the skip", () => useRecentWorkoutsStore.setState({ lastOkAt: null }))}
      {button("Workouts: full reload now", () => useRecentWorkoutsStore.getState().check({ force: true, full: true }))}
      {button("Workouts: zero the read counters", () =>
        useRecentWorkoutsStore.setState({ billedReads: 0, readout: { reads: 0, log: [] } })
      )}

      <TextBase style={styles.section}>Workout checks, newest first</TextBase>
      {w.readout.log.length === 0 ? (
        <TextBase style={styles.line}>None yet.</TextBase>
      ) : (
        w.readout.log.map((entry, index) => (
          <TextBase key={index} style={styles.line}>
            {time(entry.at)} {entry.outcome}
            {entry.kind ? ` ${entry.kind}` : ""}
            {entry.detail ? ` (${entry.detail})` : ""}
          </TextBase>
        ))
      )}

      <TextBase style={styles.section}>Workouts held, per plan</TextBase>
      {Object.entries(w.byPlan ?? {}).map(([planId, sessions]) => (
        <TextBase key={planId} style={styles.line}>
          {planId === FREESTYLE_ID ? "Freestyle" : (planNames.get(planId) ?? `${planId} (not a held plan)`)} · {sessions.length} held
          {sessions[0] ? ` · newest ${new Date(sessions[0].startedAt).toLocaleString()}` : " · never done"}
          {sessions.some((session) => !session.updatedAt) ? ` · ${sessions.filter((session) => !session.updatedAt).length} unstamped` : ""}
        </TextBase>
      ))}
    </>
  );
}

/** The stored summaries' head key, read directly. TEMPORARY, with `SummariesSection`. */
async function readSummariesDisk(): Promise<string> {
  try {
    const keys = storedSummariesKeys(EXERCISE_SUMMARIES_SHARDS);
    const rows = await AsyncStorage.multiGet(keys);
    const present = rows.filter(([, value]) => value !== null);
    if (present.length === 0) return "no keys";
    const head = JSON.parse(rows.find(([key]) => key === EXERCISE_SUMMARIES_STORAGE_KEY)?.[1] ?? "null");
    const chars = present.reduce((sum, [, value]) => sum + (value?.length ?? 0), 0);
    return `${present.length} of ${keys.length} keys · format ${head?.formatVersion} · user ${String(head?.uid).slice(0, 6)} · ${chars} chars`;
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** TEMPORARY (TICKET-076): the exercise summaries store, as the two sections above. */
function SummariesSection() {
  const { styles } = useThemeStyles(createStyles);
  const h = useExerciseHistoryStore();
  const [disk, setDisk] = useState("…");
  const refreshDisk = useCallback(() => {
    readSummariesDisk().then(setDisk);
  }, []);
  useFocusEffect(refreshDisk);
  React.useEffect(() => {
    const timer = setTimeout(refreshDisk, 300);
    return () => clearTimeout(timer);
  }, [h.byId, h.uid, refreshDisk]);

  const docs = Object.values(h.byId ?? {});
  const rows: [string, string][] = [
    ["Holds", h.byId === null ? "nothing (the next check is a first load)" : `${docs.length} summaries · ${docs.filter((doc) => !doc.updatedAt).length} not yet stamped`],
    ["On disk", disk],
    ["Check", h.checking ? (h.waitOver ? "running, wait over" : "running") : "idle"],
    ["Last result", h.lastResult ?? "none"],
    ["Last ok", h.lastOkAt ? `${time(h.lastOkAt)} · checks skipped until ${time(h.lastOkAt + EXERCISE_SUMMARIES_CHECK_SKIP_MS)}` : "never, or expired"],
    ["Last seen", h.lastSeen ? stamp(h.lastSeen) : "none (a change check starts at the epoch)"],
    ["Last full load", h.lastFullAt ? new Date(h.lastFullAt).toLocaleString() : "not recorded"],
    ["Checks", `${h.readout.reads} this app run`],
    ["Reads billed", `${h.billedReads} this app run (summary docs, 1 per empty query; a Finish's tx.get not counted)`],
  ];

  const button = (label: string, onPress: () => void) => (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <TextBase style={styles.buttonText}>{label}</TextBase>
    </TouchableOpacity>
  );

  return (
    <>
      <TextBase style={styles.section}>Exercise summaries store (TICKET-076, temporary)</TextBase>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <TextBase key={label} style={styles.line}>
            <TextBase style={styles.label}>{label}: </TextBase>
            {value}
          </TextBase>
        ))}
        {h.lastError && <TextBase style={styles.warn}>Error: {h.lastError}</TextBase>}
      </View>

      {button("Summaries: force check now", () => useExerciseHistoryStore.getState().check({ force: true }))}
      {button("Summaries: expire the skip", () => useExerciseHistoryStore.setState({ lastOkAt: null }))}
      {button("Summaries: full load now", () => useExerciseHistoryStore.getState().check({ force: true, full: true }))}
      {button("Summaries: zero the read counters", () =>
        useExerciseHistoryStore.setState({ billedReads: 0, readout: { reads: 0, log: [] } })
      )}

      <TextBase style={styles.section}>Summary checks, newest first</TextBase>
      {h.readout.log.length === 0 ? (
        <TextBase style={styles.line}>None yet.</TextBase>
      ) : (
        h.readout.log.map((entry, index) => (
          <TextBase key={index} style={styles.line}>
            {time(entry.at)} {entry.outcome}
            {entry.kind ? ` ${entry.kind}` : ""}
            {entry.detail ? ` (${entry.detail})` : ""}
          </TextBase>
        ))
      )}
    </>
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
