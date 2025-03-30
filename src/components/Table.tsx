import React, { useState, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet, Switch, Modal, TouchableWithoutFeedback } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOW } from "../constants/styles";
import ScrollableScreen from "./ScrollableScreen";
import TableControls from "./TableControl";

const COLUMN_WIDTH = 90;
const INVERTED_COLUMN_WIDTH = 70;

type TableFormat = "standard" | "inverted";

interface TableProps {
  headers: string[];
  data: { [key: string]: string | number }[];
}

const Table: React.FC<TableProps> = ({ headers, data }) => {
  const [isInvertedTableFormat, setIsInvertedTableFormat] = useState<boolean>(false);
  const [selectedFields, setSelectedFields] = useState(headers);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const invertedData = useMemo(() => {
    return headers.map((header) => ({
      header,
      values: data.map((row) => row[header] || "-"),
    }));
  }, [headers, data]);

  const toggleFieldSelection = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <View style={{ flex: 1, padding: SPACING.small }}>
      <TableControls
        isInverted={isInvertedTableFormat}
        setInverted={setIsInvertedTableFormat}
        selectedFields={selectedFields}
        onSelectFields={setSelectedFields}
        headers={headers}
        toggleFieldSelection={toggleFieldSelection}
      />

      {/* Table Display */}
      {/* Show "No Data Available" if there's no data */}
      {data.length === 0 ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No Logged Data</Text>
        </View>
      ) : (
        <ScrollView horizontal style={styles.tableContainer}>
          <View>
            {!isInvertedTableFormat ? (
              <View>
                <View style={styles.tableRowHeader}>
                  {headers.map((field, index) => (
                    selectedFields.includes(field) &&
                    <View key={index} style={[styles.headerCell, { width: COLUMN_WIDTH }]}>
                      <Text style={styles.headerText}>{field}</Text>
                    </View>
                  ))}
                </View>
                <FlatList
                  data={data}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item, index }) => (
                    <View style={[styles.tableRow, index % 2 === 0 ? styles.alternateRowEven : styles.alternateRowOdd]}>
                      {headers.map((field, fieldIndex) => (
                        selectedFields.includes(field) &&
                        <View key={fieldIndex} style={[styles.cellContainer, { width: COLUMN_WIDTH }]}>
                          <Text style={styles.cellText}>{item[field] || "-"}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                />
              </View>
            ) : (
              <View>
                {invertedData.map(({ header, values }, rowIndex) => {
                  if (!selectedFields.includes(header)) return null;
                  return (
                    <View key={rowIndex} style={styles.tableRow}>
                      <View style={[styles.headerCell, { width: COLUMN_WIDTH, backgroundColor: COLORS.tableHeader }]}>
                        <Text style={styles.headerText}>{header}</Text>
                      </View>
                      {values.map((value, colIndex) => (
                        <View key={colIndex} style={[styles.cellContainer, colIndex % 2 === 0 ? styles.alternateRowEven : styles.alternateRowOdd, { width: INVERTED_COLUMN_WIDTH }]}>
                          <Text style={styles.cellText}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tableContainer: { marginBottom: SPACING.large },
  tableRowHeader: { flexDirection: "row", backgroundColor: COLORS.tableHeader, borderWidth: 0.7, borderColor: COLORS.tableBorder },
  headerCell: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: COLORS.tableBorder },
  headerText: { fontWeight: "bold", color: COLORS.textSecondary, textAlign: "center", padding: SPACING.medium, fontSize: FONT_SIZES.large },
  tableRow: { flexDirection: "row", borderWidth: 0.7, borderColor: COLORS.tableBorder },
  alternateRowEven: { backgroundColor: COLORS.tableRowEven },
  alternateRowOdd: { backgroundColor: COLORS.tableRowOdd },
  cellContainer: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: COLORS.tableBorder },
  cellText: { textAlign: "center", paddingVertical: SPACING.small, fontSize: FONT_SIZES.medium, color: COLORS.tableText },

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

export default Table;