import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Switch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { BORDER_RADIUS, BUTTON_SIZES, COLORS, FONT_FAMILY, FONT_SIZES, SHADOW, SHADOW_3, SHADOW_4, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';
import { emptyOutlineStyle, PrimaryInputField } from './PrimaryInputField';
import { TextInput } from 'react-native-paper';
import LoadingData from './LoadingData';

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
}: SearchableInputDropdownProps<T>) {
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
          <View style={styles.switchContainer}>
            <Switch
              value={isNewMode}
              onValueChange={setIsNewMode}
              trackColor={{ false: COLORS.secondary, true: COLORS.tertiary }}
              thumbColor={COLORS.textSecondary}
              style={{ transform: [{ scaleX: 1.1 }] }}
            />
            <TextBase style={[styles.switchLabel, { opacity: isNewMode ? 1 : 0.5 }]}>New</TextBase>
          </View>
        )}
      </View>

      {isDataLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingData />
        </View>
      ) :
        allowCustomInput && isNewMode ? (
          <PrimaryInputField
            label=''
            value={customValue}
            onChangeText={setCustomValue}
            placeholder={"Enter " + placeholder}
            container={styles.primaryInputContainer}
            outline={emptyOutlineStyle}
            right={<TextInput.Icon
              icon="text-box-check"
              onPress={handleAddCustomField}
              color={COLORS.button}
              size={BUTTON_SIZES.large}
            />}
          />
        ) : (
          <Dropdown
            style={styles.dropdown}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.itemContainer}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            itemTextStyle={styles.selectedTextStyle}
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

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.medium,
    padding: SPACING.large,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS,
    ...SHADOW_4,
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
    color: COLORS.textPrimary,
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
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  dropdown: {
    height: 48,
    backgroundColor: COLORS.dropdown,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: SPACING.medium,
    ...SHADOW,
  },
  dropdownContainer: {
    backgroundColor: COLORS.dropdown,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
  },
  itemContainer: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
    margin: 1,
  },
  placeholderStyle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimaryPlaceholder,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  selectedTextStyle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY.regular.name,
    padding: SPACING.xSmall,
  },
  inputSearchStyle: {
    fontSize: FONT_SIZES.large,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.textSecondary,
    borderRadius: BORDER_RADIUS,
    fontFamily: FONT_FAMILY.regular.name,
  },
  primaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS,
    paddingLeft: 0,
    paddingBottom: 2,
    backgroundColor: COLORS.dropdown,
    height: 46,
    marginBottom: 0,
    // fontSize: FONT_SIZES.medium,
    fontSize: FONT_SIZES.large,
    borderWidth: 0,
    ...SHADOW,
  },
  loadingContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.dropdown,
    borderRadius: BORDER_RADIUS,
    ...SHADOW,
  },
  loadingText: {
    color: COLORS.textPrimaryPlaceholder,
    fontSize: FONT_SIZES.medium,
    fontFamily: FONT_FAMILY.regular.name,
  },
});