import React from "react";
import { View } from "react-native";
import { getClearIcon, PrimaryInputField } from "./PrimaryInputField";
import { TextInput } from 'react-native-paper';
import { SPACING } from "../constants/styles";
import { useThemeTokens } from "./app_manager/ThemeContext";
import { MaybeTourStep } from "./guide_tour/MaybeTourStep";
import { ValueOf } from "react-native-gesture-handler/lib/typescript/typeUtils";
import { makeStepId } from "../tour_steps/utils";
import { SEARCH_BOX_STEP_NAMES } from "../tour_steps/commonStepNames";

interface SearchBoxProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  tourStepPrefix?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({ value, onChangeText, label, placeholder = "Search...", tourStepPrefix }) => {
  const t = useThemeTokens();
  return (
    <MaybeTourStep stepId={makeStepId(SEARCH_BOX_STEP_NAMES.SEARCH_BOX, tourStepPrefix)}>
      <View style={{ paddingVertical: SPACING.small }}>
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
    </MaybeTourStep>
  );
};

export default SearchBox;