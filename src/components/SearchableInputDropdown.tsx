import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Switch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { BORDER_RADIUS, BUTTON_SIZES, FONT_FAMILY, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { emptyOutlineStyle, PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';
import LoadingData from './LoadingData';
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { SEARCHABLE_INPUT_STEP_NAMES } from '../tour_steps/commonStepNames';
import { makeStepId } from '../tour_steps/utils';
import { MaybeTourStep } from './guide_tour/MaybeTourStep';
import { PositionType } from './guide_tour/TourGuideProvider';

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
  tourStepPrefix?: string;
  positionType?: PositionType;
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
  tourStepPrefix,
  positionType
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

  return (
    <View style={[styles.container, conatinerStyle]}>
      <View style={styles.header}>
        <TextBase style={styles.heading}>{title}</TextBase>
        {allowCustomInput && (
          <MaybeTourStep stepId={[
            makeStepId(SEARCHABLE_INPUT_STEP_NAMES.NEW_BUTTON, tourStepPrefix),
            makeStepId(SEARCHABLE_INPUT_STEP_NAMES.OLD_BUTTON, tourStepPrefix)
          ]} positionType={positionType}>
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
          </MaybeTourStep>
        )}
      </View>

      <MaybeTourStep stepId={[
        makeStepId(SEARCHABLE_INPUT_STEP_NAMES.INPUT_AND_SAVE, tourStepPrefix),
        makeStepId(SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON, tourStepPrefix)
      ]} positionType={positionType}>
        {isDataLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingData />
          </View>
        ) :
          allowCustomInput && isNewMode ? (
            <MaybeTourStep stepId={makeStepId(SEARCHABLE_INPUT_STEP_NAMES.INPUT_AND_SAVE, tourStepPrefix)}>
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
            </MaybeTourStep>
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
      </MaybeTourStep>
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
    fontSize: t.fonts.large,
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
    fontSize: t.fonts.small,
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
    fontSize: t.fonts.large,
    color: t.colors.dropdownInputPlaceholder,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  itemTextStyle: {
    fontSize: t.fonts.large,
    color: t.colors.textPrimary,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  selectedTextStyle: {
    fontSize: t.fonts.large,
    color: t.colors.dropdownInputText,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  inputSearchStyle: {
    fontSize: t.fonts.large,
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
    // fontSize: t.fonts.medium,
    fontSize: t.fonts.large,
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
    fontSize: t.fonts.medium,
    fontFamily: FONT_FAMILY.regular.name,
  },
});