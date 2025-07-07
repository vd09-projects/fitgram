import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Easing,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { FONT_FAMILY, SPACING } from '../constants/styles';
import { ReturnTypeUseThemeTokens } from "./app_manager/ThemeContext";
import { useThemeStyles } from "../utils/useThemeStyles";

const MAX_DOTS = 3;
const DOT_ANIMATION_DURATION = 1000;
const DOT_ANIMATION_DELAY = 200;

interface LoadingDataProps {
  title?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  dotStyle?: StyleProp<TextStyle>;
  totalDots?: number;
}

const LoadingData: React.FC<LoadingDataProps> = ({
  title = 'Loading data',
  containerStyle,
  textStyle,
  dotStyle,
  totalDots = MAX_DOTS,
}) => {
  const { styles, t } = useThemeStyles(createStyles);
  const scales = useRef<Animated.Value[]>([]).current;

  if (scales.length === 0) {
    for (let i = 0; i < totalDots; i++) {
      scales.push(new Animated.Value(0));
    }
  }

  useEffect(() => {
    const animations = scales.map((scale, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * DOT_ANIMATION_DELAY),
          Animated.timing(scale, {
            toValue: 1,
            duration: DOT_ANIMATION_DURATION / 2,
            useNativeDriver: true,
            easing: Easing.bounce,
          }),
          Animated.timing(scale, {
            toValue: 0,
            duration: DOT_ANIMATION_DURATION / 2,
            useNativeDriver: true,
          }),
        ])
      )
    );

    const anim = Animated.stagger(DOT_ANIMATION_DELAY, animations);
    anim.start();

    return () => {
      anim.stop?.();
    };
  }, []);

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.Text style={[styles.loadingText, textStyle]}>
        {title}
      </Animated.Text>
      <View style={styles.dotRow}>
        {scales.map((scale, index) => (
          <Animated.Text
            key={index}
            style={[
              styles.dot,
              dotStyle,
              {
                transform: [{ scale }],
                opacity: scale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          >
            .
          </Animated.Text>
        ))}
      </View>
    </View>
  );
};

export default LoadingData;

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  container: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    fontSize: t.fonts.medium,
    fontFamily: FONT_FAMILY.regular.name,
    color: t.colors.textPrimaryPlaceholder,
  },
  dotRow: {
    flexDirection: 'row',
    marginLeft: SPACING.xSmall,
  },
  dot: {
    fontSize: t.fonts.large,
    fontFamily: FONT_FAMILY.regular.name,
    color: t.colors.textPrimaryPlaceholder,
    marginHorizontal: 1,
    fontWeight: 'bold',
  },
});