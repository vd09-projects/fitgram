import React from 'react';
import { TextInput } from 'react-native-paper';
import { StyleProp, TextStyle, StyleSheet, ViewStyle, KeyboardType, TextInput as RNTextInput } from 'react-native';
import { BORDER_RADIUS, FONT_FAMILY, SPACING } from '../constants/styles'; // adjust path if needed
import { ReturnTypeUseThemeTokens, useThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";
import { TransparentColor } from '../constants/colors';

interface PrimaryInputFieldProps {
  mode?: 'flat' | 'outlined';
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardType | undefined;
  secureTextEntry?: boolean;
  container?: StyleProp<TextStyle>;
  outline?: StyleProp<ViewStyle>;
  inputBox?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  labelColor?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  disabled?: boolean
}

export const PrimaryInputField = React.forwardRef<RNTextInput, PrimaryInputFieldProps>(({
  mode = 'outlined',
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  container,
  outline,
  inputBox,
  placeholder = '',
  placeholderTextColor,
  labelColor,
  disabled = false,
  left,
  right,
}, ref) => {
  const { styles, t } = useThemeStyles(createStyles);
  labelColor = labelColor || t.colors.textPrimary;
  placeholderTextColor = placeholderTextColor || t.colors.inputPrimaryPlaceholder;
  const [secureEntry, setSecureEntry] = React.useState(secureTextEntry);

  return (
    <TextInput
      mode={mode}
      ref={ref}

      label={label}
      value={value}
      onChangeText={onChangeText}
      disabled={disabled}

      keyboardType={secureTextEntry ? undefined : keyboardType}
      secureTextEntry={secureEntry}
      right={
        right ? right :
          secureTextEntry ? (
            <TextInput.Icon
              icon="eye"
              onPress={() => setSecureEntry(prev => !prev)}
              color={t.colors.inputBorder}
            />
          ) : undefined
      }
      left={left}

      placeholder={placeholder + "..."}
      placeholderTextColor={placeholderTextColor}

      style={[styles.container, container, left ? { paddingLeft: 0 } : {}]}
      outlineStyle={[styles.outline, outline]}
      contentStyle={[styles.inputBox, inputBox]}

      theme={{
        version: 3,
        isV3: true,
        colors: {
          primary: labelColor,
          background: t.colors.primary,
          // background: "#000000",
          onSurfaceVariant: labelColor,
        },
        fonts: {
          bodyLarge: {
            fontSize: t.fonts.large,
            fontFamily: FONT_FAMILY.regular.name,
            lineHeight: SPACING.large,
          },
        }
      }}
    />
  );
});

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: t.colors.inputPrimaryBackground,
    paddingBottom: SPACING.xSmall,
    paddingLeft: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: t.colors.transparent,
    borderRadius: BORDER_RADIUS,
    fontSize: t.fonts.large,
    lineHeight: SPACING.xxxLarge,
  },
  outline: {
    borderWidth: 2,
    borderColor: t.colors.inputBorder,
    borderRadius: BORDER_RADIUS,
  },
  inputBox: {
    padding: SPACING.small,
    color: t.colors.inputPrimaryText,
    fontWeight: 'normal',
  },
});

export const emptyOutlineStyle = {
  borderWidth: 0,
  borderColor: TransparentColor,
}

export const getClearIcon = (
  value: string | undefined,
  onChangeText: (text: string) => void
) => {
  return value && value.length > 0 ? (
    <TextInput.Icon icon="close" onPress={() => onChangeText('')} />
  ) : undefined;
};