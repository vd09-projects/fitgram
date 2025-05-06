import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZES, LARGE_BORDER_RADIUS, SHADOW, SHADOW_3, SPACING } from '../constants/styles';
import { TextBase } from './TextBase';

export interface AlertBaseButton {
  text: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export interface AlertBaseProps {
  visible: boolean;
  title?: string;
  message: string;
  buttons: AlertBaseButton[];
  onRequestClose?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
}

const AlertBase: React.FC<AlertBaseProps> = ({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
  containerStyle,
  titleStyle,
  messageStyle,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, containerStyle]}>
          {title ? (
            <TextBase style={[styles.title, titleStyle]}>{title}</TextBase>
          ) : null}
          <TextBase style={[styles.message, messageStyle]} isDefaultFontFamilyRequired>{message}</TextBase>

          <View style={styles.buttonRow}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={button.onPress}
                style={[styles.button, button.style]}
                activeOpacity={0.7}
              >
                <TextBase style={[styles.buttonText, button.textStyle]}>
                  {button.text}
                </TextBase>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AlertBase;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxLarge,
  },
  container: {
    backgroundColor: COLORS.popupBackground,
    borderRadius: LARGE_BORDER_RADIUS,
    padding: SPACING.large,
    width: '100%',
    ...SHADOW_3,
  },
  title: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: COLORS.popupTitleText,
    marginBottom: SPACING.medium,
    textAlign: 'center',
  },
  message: {
    fontSize: FONT_SIZES.medium,
    color: COLORS.popupText,
    textAlign: 'center',
    marginBottom: SPACING.xLarge,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.medium,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: 'center',
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.medium,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.popupButton,
    ...SHADOW,
  },
  buttonText: {
    color: COLORS.popupButtonText,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.medium,
    textAlign: 'center',
  },
});