import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { TextBase } from "./TextBase";
import CollapsibleSection from "./CollapsibleSection";
import TableControls from "./TableControl";
import { CollapsibleTable } from "./collapsible_table/CollapsibleTable";
import { COLORS, SPACING, BORDER_RADIUS, SHADOW, FONT_SIZES, LARGE_BORDER_RADIUS } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { Column } from "./collapsible_table/CollapsibleTableParts";

interface ActiveExerciseLogHistoryProps {
  exercise: LoggedExercise;
}

export default function ActiveExerciseLogHistory({
  exercise,
}: ActiveExerciseLogHistoryProps) {
  const [visibleHeaders, setVisibleHeaders] = useState<string[]>(exercise.fields);

  const toggleHeader = (header: string) => {
    setVisibleHeaders((prev) =>
      prev.includes(header)
        ? prev.filter((h) => h !== header)
        : [...prev, header]
    );
  };

  const data = exercise.sets.map((set) => set.fields);

  const renderNoData = () => (
    <View style={styles.noDataContainer}>
      <TextBase style={styles.noDataText}>No Logged Data</TextBase>
    </View>
  );

  const columns: Column<Record<string, any>>[] = exercise.fields.map((header) => ({
    key: header,
    label: header.charAt(0).toUpperCase() + header.slice(1),
    align: "center",
  }));

  const visibleColumns: Column<Record<string, any>>[] = visibleHeaders.map((header) => ({
    key: header,
    label: header.charAt(0).toUpperCase() + header.slice(1),
    align: "center",
  }));

  return (
    <CollapsibleSection
      collapsibleStyle={styles.exerciseContainer}
      collapsibleIconColor={COLORS.textPrimary}
      title={<TextBase style={styles.toggleButtonText}>Log History</TextBase>}
    >
      <View style={{ flex: 1, padding: SPACING.small }}>
        <TableControls
          selectedFields={visibleHeaders}
          onSelectFields={setVisibleHeaders}
          headers={exercise.fields}
          toggleFieldSelection={toggleHeader}
        />

        {data.length === 0 ? (
          renderNoData()
        ) : (
          <CollapsibleTable<Record<string, string | number>>
            data={data}
            columns={columns}
            visibleColumns={visibleColumns}
          />
        )}
      </View>
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  exerciseContainer: {
    backgroundColor: COLORS.collapsed,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
    padding: SPACING.large,
    ...SHADOW,
  },
  toggleButtonText: {
    color: COLORS.collapsedTitleText,
    fontSize: FONT_SIZES.large,
    fontWeight: "bold",
  },
  noDataContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.large,
  },
  noDataText: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontWeight: "bold",
  },
});