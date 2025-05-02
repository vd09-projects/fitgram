import React from "react";
import { View } from "react-native";
import { PrimaryInputField } from "./PrimaryInputField";
import { TextInput } from 'react-native-paper';
import { SPACING } from "../constants/styles";

interface SearchBoxProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ value, onChangeText, label, placeholder = "Search..." }) => {
  return (
    <View style={{paddingVertical: SPACING.small}}>
      <PrimaryInputField
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        left={<TextInput.Icon icon="feature-search-outline" />}
        right={value.length > 0 ?
          <TextInput.Icon
            icon="close"
            onPress={() => onChangeText("")}
          /> : undefined}
        container={{ width: '100%' }}
      />
    </View>
  );
};

export default SearchBox;