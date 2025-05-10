import React, { useState } from "react";
import {
  StyleSheet,
  Platform,
  UIManager,
} from "react-native";
import { ExerciseLog, SetLog } from "../types/workoutLogs";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import CollapsibleSection from "./CollapsibleSection";
import { TextBase } from "./TextBase";
import { Column } from "./collapsible_table/CollapsibleTableParts";
import { CollapsibleTable } from "./collapsible_table/CollapsibleTable";

type Props = {
  log: ExerciseLog;
  visibleHeaders?: string[];
  enableVerticalScroll?: boolean;
};

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ExerciseLogTableFlatList({
  log,
  visibleHeaders = [],
  enableVerticalScroll = false,
}: Props) {
  console.log("VDJI ExerciseLogTableFlatList", log);
  if (!log || !log.sets || log.sets.length === 0) return null;

  const allFieldKeys = Array.from(
    new Set(
      log.sets.flatMap((set) => Object.keys(set.fields ?? {}))
    )
  );
  // .filter((key) => key !== "Sets");

  const data = log.sets.map((set) => set.fields);
  const columns: Column<SetLog['fields']>[] = allFieldKeys.map((header) => ({
    key: header,
    label: header.charAt(0).toUpperCase() + header.slice(1),
    align: "center",
  }));
  const visibleColumns: Column<SetLog['fields']>[] = columns.filter((column) =>
    visibleHeaders.includes(column.key as string)
  );

  return (
    <CollapsibleSection
      title={<TextBase style={styles.dateText}>Logged on: {new Date(log.timestamp).toLocaleString()}</TextBase>}
      defaultCollapsed={false}
      collapsibleStyle={styles.container}
    >
      <CollapsibleTable<SetLog['fields']>
        data={data}
        columns={columns}
        visibleColumns={visibleColumns}
      />
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.collapsed,
    padding: SPACING.small,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
  },
  dateText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.collapsedTitleText,
  },
});