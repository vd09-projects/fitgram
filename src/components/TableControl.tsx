import React, { useState } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, Modal, TouchableWithoutFeedback, ScrollView } from "react-native";
import { COLORS, SPACING, BORDER_RADIUS, SHADOW, FONT_SIZES } from "../constants/styles";
import { Ionicons } from "@expo/vector-icons";

interface TableControlsProps {
  headers: string[];
  selectedFields: string[];
  onSelectFields: (fields: string[]) => void;
  toggleFieldSelection: (field: string) => void;
  isInverted: boolean;
  setInverted: (value: boolean) => void;
}

const TableControls: React.FC<TableControlsProps> = ({
  headers,
  selectedFields,
  onSelectFields,
  toggleFieldSelection,
  isInverted,
  setInverted,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);


  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <View style={styles.controlContainer}>
      {/* Control Panel - Single Row */}
      {/* Button to open modal */}
      <TouchableOpacity style={styles.modalButton} onPress={() => setIsDropdownOpen(true)}>
        <View style={styles.buttonContent}>
          <Text style={styles.buttonText} numberOfLines={1} ellipsizeMode="tail">
            {selectedFields.length > 0 ? truncateText(selectedFields.join(", "), 20) : "Select Columns"}
          </Text>
          <Ionicons name="chevron-down" size={20} style={styles.dropdownArrow} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Toggle Table Format */}
      <View style={styles.switchContainer}>
        <Switch
          value={isInverted}
          onValueChange={setInverted}
          trackColor={{ false: COLORS.secondary, true: COLORS.tertiary }}
          thumbColor={COLORS.textSecondary}
          style={{ transform: [{ scaleX: 1.1 }] }}
        />
        <Text style={[styles.switchLabel, { opacity: isInverted ? 1 : 0.5 }]}>Inverted</Text>
      </View>


      {isDropdownOpen && (
        <Modal visible={isDropdownOpen} animationType="slide" transparent={true}>
          <TouchableWithoutFeedback onPress={() => setIsDropdownOpen(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => { }}>
                <View style={styles.modalContainer}>
                  <Text style={styles.modalTitle}>Select Columns</Text>

                  {/* ✅ Buttons for Select All / Unselect All */}
                  <View style={styles.selectionButtonsContainer}>
                    <TouchableOpacity style={styles.selectionButton} onPress={() => onSelectFields(headers)}>
                      <Text style={styles.selectionButtonText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.selectionButton} onPress={() => onSelectFields([])}>
                      <Text style={styles.selectionButtonText}>Unselect All</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ✅ Scrollable View Inside Modal (Without Scrollbar) */}
                  <ScrollView
                    style={{ maxHeight: 300, width: "100%" }}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}  // 🔥 Hides scrollbar
                  >
                    {headers.map((header, index) => (
                      <TouchableOpacity key={index} style={styles.checkboxContainer} onPress={() => toggleFieldSelection(header)}>
                        <View style={[styles.checkbox, selectedFields.includes(header) && styles.checkboxSelected]} />
                        <Text style={styles.checkboxLabel}>{header}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  controlContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.medium },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
  },
  switchLabel: {
    fontSize: 10,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.medium,
    backgroundColor: COLORS.textSecondary,
    borderRadius: BORDER_RADIUS,
    flex: 1,
    ...SHADOW
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.medium,
    flexShrink: 1,  // Allows text to shrink if too long
  },
  dropdownArrow: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.medium,
    marginLeft: 8,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContainer: { width: "80%", backgroundColor: "#fff", padding: 20, borderRadius: BORDER_RADIUS, alignItems: "center" },
  modalTitle: { fontSize: FONT_SIZES.large, fontWeight: "bold", marginBottom: 10 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: COLORS.textPrimary, marginRight: 10 },
  checkboxSelected: { backgroundColor: COLORS.primary },
  checkboxLabel: { fontSize: FONT_SIZES.medium, color: COLORS.textPrimary },
  selectionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  selectionButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
  },
  selectionButtonText: {
    color: "#fff",
    fontSize: FONT_SIZES.medium,
    fontWeight: "bold",
  },
});

export default TableControls;