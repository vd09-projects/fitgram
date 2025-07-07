import React, { createContext, useContext, useMemo } from 'react';
import { AllColorSchemas, ColorSchemaValueType } from '../../constants/colors';
import { useColorSchemaStore } from '../../stores/colorSchemaStore';
import { FONT_SIZES, getShadow } from '../../constants/styles';

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
        fonts: FONT_SIZES,
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