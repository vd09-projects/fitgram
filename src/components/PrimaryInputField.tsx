import React from 'react';
import { TextInput } from 'react-native-paper';
import { StyleProp, TextStyle, StyleSheet, ViewStyle, KeyboardType } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOW, SPACING } from '../constants/styles'; // adjust path if needed

type keyboardTypePassword = 'password';

interface PrimaryInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardType | undefined;
  secureTextEntry?: boolean;
  container?: StyleProp<ViewStyle>;
  outline?: StyleProp<ViewStyle>;
  inputBox?: StyleProp<TextStyle>;
  backgroundColor?: string;
  placeholderTextColor?: string;
  labelColor?: string;
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
        secureTextEntry ? (
          <TextInput.Icon
            icon="eye"
            onPress={() => setSecureEntry(prev => !prev)}
          />
        ) : undefined
      }

      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}

      style={[styles.container, container]}
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
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '80%',
    paddingBottom: SPACING.xSmall,
    paddingLeft: SPACING.xSmall,
    marginBottom: SPACING.small,
    borderWidth: 1,
    borderColor: COLORS.transparent,
    borderRadius: BORDER_RADIUS,
    fontWeight: 'bold',
    fontSize: SPACING.xLarge,
    fontFamily: 'ComicReliefBold',
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
    fontFamily: 'ComicRelief',
  },
  inputLabel: {
    // fontSize: FONT_SIZES.small,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});