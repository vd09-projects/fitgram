// src/screens/workout_management/CatalogDebugScreen.tsx
//
// TEMPORARY. Exists only so TICKET-042 stage 2's catalog cache can be checked on
// a device: nothing else shows which catalog the phone holds or how many reads
// it cost. Delete this file, its route in constants/routes.tsx, its
// Stack.Screen in navigation/WorkoutNavigator.tsx, its tile in
// screens/WorkoutScreen.tsx, and `catalogReadCounter` with its two increments
// in services/db/catalog.ts. Nothing else references it.
//
// The device check (reads are counted since the app started):
//  - app start, unchanged hash: meta 1, catalog 0, source "cache"
//  - app start, after an upload with new content: meta 1, catalog 1, "network"
//  - "Clear local cache", restart: meta 1, catalog 1, "network"
//  - open Manage Workout and come back: meta +1, catalog +0
//  - "Unknown id check" twice: meta +1 the first time, +0 the second
//  - sign out and back in: the version is unchanged (sign-out keeps it)

import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScrollableScreen from "../../components/ScrollableScreen";
import { TextBase } from "../../components/TextBase";
import { CATALOG_CACHE_KEY, useCatalogStore } from "../../stores/useCatalogStore";
import { catalogReadCounter } from "../../services/db/catalog";
import { BORDER_RADIUS, SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../../components/app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

export default function CatalogDebugScreen() {
  const { styles } = useThemeStyles(createStyles);
  const { catalog, source, lastRefusal, lastError, unknownIdChecked } = useCatalogStore();
  // The counter is a plain object, not state: re-read it on focus and after each action.
  const [reads, setReads] = useState({ ...catalogReadCounter });
  const [diskBytes, setDiskBytes] = useState("…");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setReads({ ...catalogReadCounter });
    AsyncStorage.getItem(CATALOG_CACHE_KEY)
      .then((raw) => setDiskBytes(raw ? `${raw.length} chars` : "absent"))
      .catch((error) => setDiskBytes(`unreadable: ${String(error)}`));
  }, []);
  useFocusEffect(refresh);

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const clearCache = async () => {
    await AsyncStorage.removeItem(CATALOG_CACHE_KEY);
    useCatalogStore.setState({ catalog: null, source: "none" });
  };

  const versions = catalog ? catalog.index.size : 0;
  return (
    <ScrollableScreen title={<TextBase style={styles.heading}>Catalog (temporary)</TextBase>}>
      <View style={styles.card}>
        <TextBase style={styles.label}>Firestore reads since app start</TextBase>
        <TextBase style={styles.counter}>
          meta {reads.meta} · catalog {reads.catalog}
        </TextBase>
        <TextBase style={styles.line}>Version: {catalog ? catalog.version.slice(0, 12) : "none"}</TextBase>
        <TextBase style={styles.line}>Source: {source}</TextBase>
        <TextBase style={styles.line}>
          {catalog ? `${catalog.movements.length} movements, ${versions} versions` : "No catalog loaded"}
        </TextBase>
        <TextBase style={styles.line}>On disk: {diskBytes}</TextBase>
        <TextBase style={styles.line}>Unknown-id check used: {unknownIdChecked ? "yes" : "no"}</TextBase>
        {lastError && <TextBase style={styles.warn}>Last read failed: {lastError}</TextBase>}
        {lastRefusal && (
          <TextBase style={styles.warn}>
            Refused {lastRefusal.version?.slice(0, 12)} at {new Date(lastRefusal.at).toLocaleTimeString()}:{" "}
            {lastRefusal.errors.slice(0, 3).join("; ")}
            {lastRefusal.errors.length > 3 ? ` (+${lastRefusal.errors.length - 3} more)` : ""}
          </TextBase>
        )}
      </View>

      <TouchableOpacity style={styles.button} disabled={busy} onPress={run(() => useCatalogStore.getState().sync())}>
        <TextBase style={styles.buttonText}>Check now (as at app start)</TextBase>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} disabled={busy} onPress={run(() => useCatalogStore.getState().checkUnknownId())}>
        <TextBase style={styles.buttonText}>Unknown id check</TextBase>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} disabled={busy} onPress={run(clearCache)}>
        <TextBase style={styles.buttonText}>Clear local cache</TextBase>
      </TouchableOpacity>
    </ScrollableScreen>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    heading: { fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.textPrimary, textAlign: "center" },
    card: {
      backgroundColor: t.colors.cardBackground,
      borderRadius: BORDER_RADIUS,
      padding: SPACING.large,
      marginBottom: SPACING.large,
    },
    label: { fontSize: t.fonts.medium, color: t.colors.textPrimary },
    counter: { fontSize: t.fonts.xLarge, fontWeight: "bold", color: t.colors.cardHeader, marginVertical: SPACING.xSmall },
    line: { fontSize: t.fonts.xMedium, color: t.colors.textPrimary },
    warn: { fontSize: t.fonts.xMedium, color: t.colors.cancelButton, marginTop: SPACING.xSmall },
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
  });
