import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { TextBase } from "./TextBase";
import CollapsibleSection from "./CollapsibleSection";
import TableControls from "./TableControl";
import { CollapsibleTable } from "./collapsible_table/CollapsibleTable";
import { SPACING, BORDER_RADIUS, FONT_SIZES, LARGE_BORDER_RADIUS } from "../constants/styles";
import { LoggedExercise } from "../types/zustandWorkoutType";
import { Column } from "./collapsible_table/CollapsibleTableParts";
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface ActiveExerciseLogHistoryProps {
  exercise: LoggedExercise;
}

export default function ActiveExerciseLogHistory({
  exercise,
}: ActiveExerciseLogHistoryProps) {
  const { styles, t } = useThemeStyles(createStyles);
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
      collapsibleIconColor={t.colors.textPrimary}
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

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  exerciseContainer: {
    backgroundColor: t.colors.collapsed,
    borderRadius: BORDER_RADIUS,
    marginBottom: SPACING.medium,
    padding: SPACING.large,
    ...t.shadows.shadowSmall,
  },
  toggleButtonText: {
    color: t.colors.collapsedTitleText,
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
    color: t.colors.textPrimary,
    fontWeight: "bold",
  },
});