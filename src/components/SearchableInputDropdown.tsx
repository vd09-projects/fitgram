import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Switch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { BORDER_RADIUS, BUTTON_SIZES, FONT_FAMILY, FONT_SIZES, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { emptyOutlineStyle, PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';
import LoadingData from './LoadingData';
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TourStep } from './guide_tour/TourStep';
import { SEARCHABLE_INPUT_DROPDOWN_PREFIX, STEP_NAMES, TOUR_STEPS } from '../constants/tourSteps';
import { ValueOf } from 'react-native-gesture-handler/lib/typescript/typeUtils';

export interface DropdownItem<T> {
  label: string;
  value: T;
}

export interface DropdownSelection<T> {
  label: string;
  value: T | undefined;
  isCustom: boolean;
}

interface SearchableInputDropdownProps<T> {
  data: DropdownItem<T>[];
  placeholder?: string;
  value: DropdownSelection<T> | undefined;
  onChange: (data: DropdownSelection<T>) => void;
  title?: string;
  allowCustomInput?: boolean;
  conatinerStyle?: StyleProp<ViewStyle>;
  isDataLoading?: boolean;
  tourStepPrefix?: ValueOf<typeof SEARCHABLE_INPUT_DROPDOWN_PREFIX>;
}

export default function SearchableInputDropdown<T>({
  data,
  placeholder = 'field',
  value,
  onChange,
  title = 'Select Field',
  allowCustomInput = true,
  conatinerStyle,
  isDataLoading = false,
  tourStepPrefix = SEARCHABLE_INPUT_DROPDOWN_PREFIX.DEFAULT,
}: SearchableInputDropdownProps<T>) {
  const { styles, t } = useThemeStyles(createStyles);
  const [isNewMode, setIsNewMode] = useState(false);
  const [customValue, setCustomValue] = useState(value?.label || '');

  const handleAddCustomField = () => {
    if (customValue.trim() === '') return;
    onChange({ label: customValue, value: undefined, isCustom: true });
  };

  const handleSelectField = (item: DropdownItem<T>) => {
    onChange({ label: item.label, value: item.value, isCustom: false });
    setCustomValue(item.label);
  };

  console.log("SearchableInputDropdown ", tourStepPrefix + STEP_NAMES.SEARCHABLE_INPUT_DROPDOWN_NEW_BUTTON);
  return (
    <View style={[styles.container, conatinerStyle]}>
      <View style={styles.header}>
        <TextBase style={styles.heading}>{title}</TextBase>
        {allowCustomInput && (
          <TourStep {...TOUR_STEPS[tourStepPrefix + STEP_NAMES.SEARCHABLE_INPUT_DROPDOWN_NEW_BUTTON]}>
            <View style={styles.switchContainer}>
              <Switch
                value={isNewMode}
                onValueChange={setIsNewMode}
                trackColor={{ false: t.colors.switchFalse, true: t.colors.switchTrue }}
                thumbColor={t.colors.textSecondary}
                style={{ transform: [{ scaleX: 1.1 }] }}
              />
              <TextBase style={[styles.switchLabel, { opacity: isNewMode ? 1 : 0.5 }]}>New</TextBase>
            </View>
          </TourStep>
        )}
      </View>

      {isDataLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingData />
        </View>
      ) :
        allowCustomInput && isNewMode ? (
          <TourStep {...TOUR_STEPS[tourStepPrefix + STEP_NAMES.SEARCHABLE_INPUT_DROPDOWN_INPUT_AND_SAVE]}>
            <PrimaryInputField
              label=''
              value={customValue}
              onChangeText={setCustomValue}
              placeholder={"Enter " + placeholder}
              container={styles.primaryInputContainer}
              outline={emptyOutlineStyle}
              inputBox={{ color: t.colors.dropdownInputText }}
              placeholderTextColor={t.colors.dropdownInputPlaceholder}
              right={<TextInput.Icon
                icon="text-box-check"
                onPress={handleAddCustomField}
                color={t.colors.button}
                size={BUTTON_SIZES.large}
              />}
            />
          </TourStep>
        ) : (
          <Dropdown
            style={styles.dropdown}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.itemContainer}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            itemTextStyle={styles.itemTextStyle}
            data={data}
            search
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder={"Choose " + placeholder}
            searchPlaceholder="Search..."
            value={value}
            onChange={handleSelectField}
          />
        )}
    </View>

  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    marginTop: SPACING.medium,
    padding: SPACING.large,
    backgroundColor: t.colors.primary,
    borderRadius: BORDER_RADIUS,
    ...t.shadows.shadowLarge,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
    width: '100%',
  },
  heading: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: t.colors.textPrimary,
    flexShrink: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.small,
  },
  switchLabel: {
    fontSize: FONT_SIZES.small,
    color: t.colors.textPrimary,
    fontWeight: 'bold',
  },
  dropdown: {
    height: 48,
    backgroundColor: t.colors.dropdown,
    borderColor: t.colors.border,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: SPACING.medium,
    ...t.shadows.shadowSmall,
  },
  dropdownContainer: {
    backgroundColor: t.colors.dropdown,
    borderColor: t.colors.border,
    borderRadius: BORDER_RADIUS,
  },
  itemContainer: {
    backgroundColor: t.colors.dropdownItemBackground,
    borderColor: t.colors.border,
    borderRadius: BORDER_RADIUS,
    marginHorizontal: SPACING.xSmall,
    margin: 1,
  },
  placeholderStyle: {
    fontSize: FONT_SIZES.large,
    color: t.colors.dropdownInputPlaceholder,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  itemTextStyle: {
    fontSize: FONT_SIZES.large,
    color: t.colors.textPrimary,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  selectedTextStyle: {
    fontSize: FONT_SIZES.large,
    color: t.colors.dropdownInputText,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  inputSearchStyle: {
    fontSize: FONT_SIZES.large,
    color: t.colors.dropdownInputText,
    backgroundColor: t.colors.inputPrimaryBackground,
    borderRadius: BORDER_RADIUS,
    borderColor: t.colors.border,
    fontFamily: FONT_FAMILY.regular.name,
  },
  primaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    backgroundColor: t.colors.dropdown,
    height: 46,
    marginBottom: 0,
    // fontSize: FONT_SIZES.medium,
    fontSize: FONT_SIZES.large,
    borderWidth: 0,
    ...t.shadows.shadowSmall,
  },
  loadingContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.dropdown,
    borderRadius: BORDER_RADIUS,
    ...t.shadows.shadowSmall,
  },
  loadingText: {
    color: t.colors.dropdownInputPlaceholder,
    fontSize: FONT_SIZES.medium,
    fontFamily: FONT_FAMILY.regular.name,
  },
});