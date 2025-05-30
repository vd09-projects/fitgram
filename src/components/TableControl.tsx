import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { SPACING, BORDER_RADIUS, FONT_SIZES } from "../constants/styles";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "./TextBase";
import CompactTextSwitch from "./CompactTextSwitch";
import { ReturnTypeUseThemeTokens } from "./ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

interface TableControlsProps {
  headers: string[];
  selectedFields: string[];
  onSelectFields: (fields: string[]) => void;
  toggleFieldSelection: (field: string) => void;
  isInverted?: boolean;
  setInverted?: (value: boolean) => void;
}

const MAX_DISPLAY_LENGTH = 20;

const TableControls: React.FC<TableControlsProps> = ({
  headers,
  selectedFields,
  onSelectFields,
  toggleFieldSelection,
  isInverted = false,
  setInverted,
}) => {
  const { styles, t } = useThemeStyles(createStyles);
  const [isModalVisible, setModalVisible] = useState(false);

  const toggleModal = () => setModalVisible((prev) => !prev);

  const handleSelectAll = () => onSelectFields(headers);
  const handleUnselectAll = () => onSelectFields([]);

  const truncatedFieldText = selectedFields.join(", ")

  const renderFieldCheckboxes = () =>
    headers.map((header) => (
      <TouchableOpacity
        key={header}
        style={styles.checkboxContainer}
        onPress={() => toggleFieldSelection(header)}
      >
        <View style={[styles.checkbox, selectedFields.includes(header) && styles.checkboxSelected]} />
        <TextBase style={styles.checkboxLabel}>{header}</TextBase>
      </TouchableOpacity>
    ));

  const renderModalContent = () => (
    <TouchableWithoutFeedback onPress={() => { }}>
      <View style={styles.modalContainer}>
        <TextBase style={styles.modalTitle}>Select Columns</TextBase>

        <View style={styles.selectionButtonsContainer}>
          <TouchableOpacity style={styles.selectionButton} onPress={handleSelectAll}>
            <TextBase style={styles.selectionButtonText}>Select All</TextBase>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionButton} onPress={handleUnselectAll}>
            <TextBase style={styles.selectionButtonText}>Unselect All</TextBase>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.checkboxScrollView}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {renderFieldCheckboxes()}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );

  return (
    <View style={styles.container}>
      {/* Column Picker Button */}
      <TouchableOpacity style={styles.modalButton} onPress={toggleModal}>
        <View style={styles.buttonContent}>
          {selectedFields.length === 0 ?
            <TextBase style={[styles.buttonText, { color: t.colors.dropdownInputPlaceholder }]} numberOfLines={1}>*No field selected</TextBase>
            :
            <TextBase style={styles.buttonText} numberOfLines={1}>{truncatedFieldText}</TextBase>}
          <Ionicons name="chevron-down" size={20} color={t.colors.textPrimary} style={styles.dropdownArrow} />
        </View>
      </TouchableOpacity>

      {/* Inverted Toggle */}
      {setInverted && <CompactTextSwitch
        value={isInverted}
        onToggle={setInverted}
        labels={["Std", "Flip"]}
        width={50}
        height={24}
        containerStyle={{ marginLeft: SPACING.small }}
      />}

      {/* Modal for Column Selection */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={toggleModal}>
          <View style={styles.modalOverlay}>{renderModalContent()}</View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.medium,
  },
  checkboxScrollView: {
    maxHeight: 300,
    width: "100%",
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.medium,
    backgroundColor: t.colors.dropdown,
    borderRadius: BORDER_RADIUS,
    flex: 1,
    ...t.shadows.shadowSmall
  },
  buttonText: {
    color: t.colors.dropdownInputText,
    fontSize: FONT_SIZES.medium,
    flexShrink: 1,  // Allows text to shrink if too long
  },
  dropdownArrow: {
    color: t.colors.dropdownInputText,
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
  modalContainer: { width: "80%", backgroundColor: t.colors.collapsed, padding: 20, borderRadius: BORDER_RADIUS, alignItems: "center" },
  modalTitle: { fontSize: FONT_SIZES.large, fontWeight: "bold", marginBottom: 10, color: t.colors.textPrimary },
  checkboxContainer: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: t.colors.textPrimary, marginRight: 10 },
  checkboxSelected: { backgroundColor: t.colors.textPrimary },
  checkboxLabel: { fontSize: FONT_SIZES.medium, color: t.colors.textPrimary },
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
    backgroundColor: t.colors.primary,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
  },
  selectionButtonText: {
    color: t.colors.textSecondary,
    fontSize: FONT_SIZES.medium,
    fontWeight: "bold",
  },
});

export default TableControls;