import React, { createContext, useContext, useMemo } from 'react';
import { AllColorSchemas, ColorSchemaValueType } from '../../constants/colors';
import { useColorSchemaStore } from '../../stores/colorSchemaStore';
import { FONT_FAMILY, FontFamilyType, getShadow } from '../../constants/styles';
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // base iPhone width

export const normalizeFont = (size: number) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Spacing Normalizer (percentage of height or width)
export const normalizeSpacing = (percent: number, axis: 'vertical' | 'horizontal' = 'vertical') => {
  return axis === 'vertical'
    ? Math.round((SCREEN_HEIGHT * percent) / 100)
    : normalizeFont(percent);
};

export const THEME_FONT_SIZES = {
  xSmall: normalizeFont(10),
  small: normalizeFont(12),
  xMedium: normalizeFont(14),
  medium: normalizeFont(16),
  large: normalizeFont(18),
  xLarge: normalizeFont(22),
};
export type FontSizeType = typeof THEME_FONT_SIZES;

// The font family is a THEME TOKEN, not a module const, so the deferred
// display-font selector only has to change what this resolves to -- every
// consumer already reads it off the theme.
export const THEME_FONT_FAMILY = FONT_FAMILY;
export type { FontFamilyType };

// Spacing
export const THEME_SPACING = {
  ScrollingBuffer: normalizeSpacing(20),
};
export type SpacingType = typeof THEME_SPACING;

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

type ShadowsType = {
  shadowSmall: ShadowStyle;
  shadowMedium: ShadowStyle;
  shadowLarge: ShadowStyle;
};

const ThemeContext = createContext<null | {
  colors: ColorSchemaValueType;
  fonts: FontSizeType;
  fontFamily: FontFamilyType;
  shadows: ShadowsType;
  space: SpacingType;
}>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const current = useColorSchemaStore((s) => s.currentColorSchema);

  const value = useMemo(
    () => {
      const cs = AllColorSchemas[current];
      return {
        colors: cs,
        fonts: THEME_FONT_SIZES,
        fontFamily: THEME_FONT_FAMILY,
        space: THEME_SPACING,
        shadows: {
          shadowSmall: getShadow(2, cs.shadowSmall),
          shadowMedium: getShadow(3, cs.shadowSmall),
          shadowLarge: getShadow(5, cs.shadowSmall),
        },
      }
    },
    [current]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeTokens = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeTokens must be used inside ThemeProvider');
  return ctx;
};

export type ReturnTypeUseThemeTokens = ReturnType<typeof useThemeTokens>;