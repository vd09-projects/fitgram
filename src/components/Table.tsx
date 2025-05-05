import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
} from "react-native";
import TableControls from "./TableControl";
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from "../constants/styles";
import { TextBase } from "./TextBase";

type TableProps = {
  headers: string[];
  data: Record<string, string | number>[];
};

export default function Table({ headers, data }: TableProps) {
  const [isInvertedView, setIsInvertedView] = useState(false);
  const [visibleHeaders, setVisibleHeaders] = useState<string[]>(headers);

  const invertedData = useMemo(() => {
    return headers.map((header) => ({
      header,
      values: data.map((row) => row[header] || "-"),
    }));
  }, [headers, data]);

  const toggleHeader = (header: string) => {
    setVisibleHeaders((prev) =>
      prev.includes(header)
        ? prev.filter((h) => h !== header)
        : [...prev, header]
    );
  };

  const renderNoData = () => (
    <View style={styles.noDataContainer}>
      <TextBase style={styles.noDataText}>No Logged Data</TextBase>
    </View>
  );

  const renderStandardTable = () => (
    <View style={styles.tableWrapper}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {headers.map((header, idx) =>
          visibleHeaders.includes(header) ? (
            <View key={idx} style={styles.flexHeaderCell}>
              <TextBase
                style={styles.headerText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {header}
              </TextBase>
            </View>
          ) : null
        )}
      </View>

      {/* Rows */}
      <FlatList
        data={data}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.row,
              index % 2 === 0 ? styles.rowEven : styles.rowOdd,
            ]}
          >
            {headers.map((header, idx) =>
              visibleHeaders.includes(header) ? (
                <View key={idx} style={styles.flexCell}>
                  <TextBase
                    style={styles.cellText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item[header] || "-"}
                  </TextBase>
                </View>
              ) : null
            )}
          </View>
        )}
      />
    </View>
  );

  const renderInvertedTable = () => (
    <View>
      {invertedData.map(({ header, values }, rowIndex) =>
        visibleHeaders.includes(header) ? (
          <View key={rowIndex} style={styles.row}>
            <View style={[styles.flexHeaderCell, { backgroundColor: COLORS.tableHeader }]}>
              <TextBase style={styles.headerText}>{header}</TextBase>
            </View>
            {values.map((value, colIndex) => (
              <View
                key={colIndex}
                style={[
                  styles.flexCell,
                  colIndex % 2 === 0 ? styles.rowEven : styles.rowOdd,
                ]}
              >
                <TextBase style={styles.cellText}>{value}</TextBase>
              </View>
            ))}
          </View>
        ) : null
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, padding: SPACING.small }}>
      <TableControls
        isInverted={isInvertedView}
        setInverted={setIsInvertedView}
        selectedFields={visibleHeaders}
        onSelectFields={setVisibleHeaders}
        headers={headers}
        toggleFieldSelection={toggleHeader}
      />

      {data.length === 0 ? (
        renderNoData()
      ) : (
        <ScrollView horizontal style={styles.tableScroll}>
          {isInvertedView ? renderInvertedTable() : renderStandardTable()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tableScroll: {
    marginBottom: SPACING.large,
  },
  tableWrapper: {
    borderWidth: 1,
    borderColor: COLORS.tableBorder,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: COLORS.tableHeader,
  },
  flexHeaderCell: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.small,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: COLORS.tableBorder,
  },
  headerText: {
    fontWeight: "bold",
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.large,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: COLORS.tableBorder,
  },
  flexCell: {
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.small,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: COLORS.tableBorder,
  },
  cellText: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.tableText,
  },
  rowEven: {
    backgroundColor: COLORS.tableRowEven,
  },
  rowOdd: {
    backgroundColor: COLORS.tableRowOdd,
  },
  noDataContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.large,
  },
  noDataText: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textSecondary,
    fontWeight: "bold",
  },
});