import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS } from "../constants/styles";

interface SearchBoxProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ value, onChangeText, placeholder = "Search..." }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={COLORS.textPrimary} style={styles.icon} />
      
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textPrimaryPlaceholder}
        value={value}
        onChangeText={onChangeText}
      />

      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText("")} style={styles.clearButton}>
          <Ionicons name="close" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.dropdown,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginVertical: 10,
  },
  icon: {
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS,
  },
  clearButton: {
    padding: 5,
  },
});

export default SearchBox;