import React from "react";
import { View } from "react-native";
import { getClearIcon, PrimaryInputField } from "./PrimaryInputField";
import { TextInput } from 'react-native-paper';
import { SPACING } from "../constants/styles";
import { useThemeTokens } from "./ThemeContext";

interface SearchBoxProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ value, onChangeText, label, placeholder = "Search..." }) => {
  const t = useThemeTokens();
  return (
    <View style={{paddingVertical: SPACING.small}}>
      <PrimaryInputField
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        left={<TextInput.Icon icon="feature-search-outline" color={t.colors.inputBorder} />}
        right={getClearIcon(value, onChangeText)}
        container={{ width: '100%' }}
      />
    </View>
  );
};

export default SearchBox;