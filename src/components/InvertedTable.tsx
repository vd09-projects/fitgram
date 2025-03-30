import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOW } from "../constants/styles";

interface TableProps {
  headers: string[];
  data: { [key: string]: string | number }[];
}

const COLUMN_WIDTH = 90;

const InvertedTable: React.FC<TableProps> = ({ headers, data }) => {
  const [isInverted, setIsInverted] = useState(false);

  // Transform data for inverted table format
  const transformedData = headers.map((header) => ({
    header,
    values: data.map((row) => row[header] || "-"),
  }));

  return (
    <View>
      {/* Toggle Button */}
      <TouchableOpacity style={styles.toggleButton} onPress={() => setIsInverted(!isInverted)}>
        <Text style={styles.toggleButtonText}>{isInverted ? "Normal View" : "Inverted View"}</Text>
      </TouchableOpacity>

      <ScrollView horizontal style={styles.tableContainer}>
        <View>
          {/* Inverted Table Header */}
          <View style={styles.tableRowHeader}>
            <View style={[styles.headerCell, { width: COLUMN_WIDTH }]}> 
              <Text style={styles.headerText}>Field</Text>
            </View>
            {data.map((_, index) => (
              <View key={index} style={[styles.headerCell, { width: COLUMN_WIDTH }]}> 
                <Text style={styles.headerText}>Record {index + 1}</Text>
              </View>
            ))}
          </View>

          {/* Table Body */}
          <FlatList
            data={transformedData}
            keyExtractor={(item) => item.header}
            renderItem={({ item, index }) => (
              <View style={[styles.tableRow, index % 2 === 0 ? styles.alternateRowEven : styles.alternateRowOdd]}>
                <View style={[styles.cellContainer, { width: COLUMN_WIDTH }]}> 
                  <Text style={styles.headerText}>{item.header}</Text>
                </View>
                {item.values.map((value, valueIndex) => (
                  <View key={valueIndex} style={[styles.cellContainer, { width: COLUMN_WIDTH }]}> 
                    <Text style={styles.cellText}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    marginBottom: SPACING.medium,
    ...SHADOW,
  },
  toggleButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.medium,
    fontWeight: "bold",
  },
  tableContainer: { marginBottom: SPACING.large },
  tableRowHeader: { flexDirection: "row", backgroundColor: COLORS.tableHeader, borderWidth: 0.7, borderColor: COLORS.tableBorder },
  headerCell: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: COLORS.tableBorder, borderBottomWidth: 1 },
  headerText: { fontWeight: "bold", color: COLORS.textSecondary, textAlign: "center", padding: SPACING.medium, fontSize: FONT_SIZES.large },
  tableRow: { flexDirection: "row", borderWidth: 0.7, borderColor: COLORS.tableBorder },
  alternateRowEven: { backgroundColor: COLORS.tableRowEven },
  alternateRowOdd: { backgroundColor: COLORS.tableRowOdd },
  cellContainer: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: COLORS.tableBorder },
  cellText: { textAlign: "center", paddingVertical: SPACING.small, fontSize: FONT_SIZES.medium, color: COLORS.tableText },
});

export default InvertedTable;
