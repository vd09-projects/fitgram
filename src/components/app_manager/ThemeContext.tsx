import React, { createContext, useContext, useMemo } from 'react';
import { AllColorSchemas, ColorSchemaValueType } from '../../constants/colors';
import { useColorSchemaStore } from '../../stores/colorSchemaStore';
import { getShadow } from '../../constants/styles';
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // base iPhone width

export const normalizeFont = (size: number) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
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
  shadows: ShadowsType;
  // fonts: typeof FONT_SIZES;
}>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const current = useColorSchemaStore((s) => s.currentColorSchema);

  const value = useMemo(
    () => {
      const cs = AllColorSchemas[current];
      return {
        colors: cs,
        fonts: THEME_FONT_SIZES,
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