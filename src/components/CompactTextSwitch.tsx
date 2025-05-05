import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { COLORS, FONT_FAMILY, FONT_SIZES, SPACING } from "../constants/styles";

interface SideTextSwitchProps {
  value: boolean;
  onToggle: (val: boolean) => void;
  labels?: [string, string]; // [LeftLabel, RightLabel]
  width?: number;
  height?: number;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 36;
const PADDING = 2;

const SideTextSwitch: React.FC<SideTextSwitchProps> = ({
  value,
  onToggle,
  labels = ["Std", "Flip"],
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  containerStyle,
  textStyle,
}) => {
  const thumbSize = height - PADDING * 2;
  const translateDistance = width - thumbSize - PADDING * 2;

  const animatedTranslateX = useRef(
    new Animated.Value(value ? translateDistance : 0)
  ).current;

  // Animate thumb movement
  useEffect(() => {
    Animated.timing(animatedTranslateX, {
      toValue: value ? translateDistance : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  // Background and text color logic
  const backgroundColor = value ? COLORS.tertiary : COLORS.secondary;
  const textColor = backgroundColor === COLORS.tertiary ? COLORS.textSecondary : COLORS.textPrimary;


  return (
    <Pressable
      onPress={() => onToggle(!value)}
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor,
          padding: PADDING,
        },
        containerStyle,
      ]}
    >
      {/* Left label when value is true (Flip mode) */}
      {value && (
        <Text style={[styles.labelLeft, { color: textColor }, textStyle]}>
          {labels[1]}
        </Text>
      )}

      {/* Right label when value is false (Standard mode) */}
      {!value && (
        <Text style={[styles.labelRight, { color: textColor }, textStyle]}>
          {labels[0]}
        </Text>
      )}

      {/* White Thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            transform: [{ translateX: animatedTranslateX }],
          }
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: {
    backgroundColor: COLORS.textSecondary,
    position: "absolute",
    top: PADDING,
    left: PADDING,
    zIndex: 1,
  },
  labelLeft: {
    position: "absolute",
    left: SPACING.small,
    zIndex: 2,
    fontSize: FONT_SIZES.xSmall,
    fontWeight: "600",
    fontFamily: FONT_FAMILY.bold.name,
  },
  labelRight: {
    position: "absolute",
    right: SPACING.xSmall,
    zIndex: 2,
    fontSize: FONT_SIZES.small,
    fontFamily: FONT_FAMILY.bold.name,
  },
});

export default SideTextSwitch;