import React from 'react';
import { TextInput } from 'react-native-paper';
import { StyleProp, TextStyle, StyleSheet, ViewStyle, KeyboardType } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_FAMILY, FONT_SIZES, SPACING } from '../constants/styles'; // adjust path if needed

interface PrimaryInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardType | undefined;
  secureTextEntry?: boolean;
  container?: StyleProp<TextStyle>;
  outline?: StyleProp<ViewStyle>;
  inputBox?: StyleProp<TextStyle>;
  backgroundColor?: string;
  placeholderTextColor?: string;
  labelColor?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export const PrimaryInputField: React.FC<PrimaryInputFieldProps> = ({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  container,
  outline,
  inputBox,
  placeholder = '',
  placeholderTextColor = COLORS.textPrimaryPlaceholder,
  backgroundColor = COLORS.textSecondary,
  labelColor = COLORS.textPrimary,
  left,
  right,
}) => {
  const [secureEntry, setSecureEntry] = React.useState(secureTextEntry);

  return (
    <TextInput
      mode='outlined'

      label={label}
      value={value}
      onChangeText={onChangeText}

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
          background: backgroundColor,
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
    borderColor: COLORS.transparent,
    borderRadius: BORDER_RADIUS,
    fontSize: SPACING.xLarge,
    lineHeight: SPACING.xxxLarge,
  },
  outline: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS,
  },
  inputBox: {
    padding: SPACING.small,
    color: COLORS.textPrimary,
    fontWeight: 'normal',
  },
  inputLabel: {
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});

export const emptyOutlineStyle = {
  borderWidth: 0,
  borderColor: COLORS.transparent,
}
