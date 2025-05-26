import React from 'react';
import { TextInput } from 'react-native-paper';
import { StyleProp, TextStyle, StyleSheet, ViewStyle, KeyboardType } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_FAMILY, FONT_SIZES, SHADOW_4, SPACING } from '../constants/styles'; // adjust path if needed

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

export const PrimaryInputField: React.FC<PrimaryInputFieldProps> = ({
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
  placeholderTextColor = COLORS.inputPrimaryPlaceholder,
  labelColor = COLORS.textPrimary,
  disabled = false,
  left,
  right,
}) => {
  const [secureEntry, setSecureEntry] = React.useState(secureTextEntry);

  return (
    <TextInput
      mode={mode}

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
          onSurfaceVariant: labelColor,
        },
        fonts: {
          bodyLarge: {
            fontSize: FONT_SIZES.large,
            fontFamily: FONT_FAMILY.regular.name,
            lineHeight: SPACING.large,
          },
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: SPACING.xSmall,
    paddingLeft: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.inputPrimaryBackground,
    borderRadius: BORDER_RADIUS,
    fontSize: SPACING.xLarge,
    lineHeight: SPACING.xxxLarge,
  },
  outline: {
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    borderRadius: BORDER_RADIUS,
  },
  inputBox: {
    padding: SPACING.small,
    color: COLORS.inputPrimaryText,
    fontWeight: 'normal',
  },
});

export const emptyOutlineStyle = {
  borderWidth: 0,
  borderColor: COLORS.transparent,
}

export const getClearIcon = (
  value: string | undefined,
  onChangeText: (text: string) => void
) => {
  return value && value.length > 0 ? (
    <TextInput.Icon icon="close" onPress={() => onChangeText('')} />
  ) : undefined;
};