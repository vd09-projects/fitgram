import React, { createContext, useContext, useMemo } from 'react';
import { AllColorSchemas, ColorSchemaValueType } from '../constants/colors';
import { useColorSchemaStore } from '../stores/colorSchemaStore';
import { FONT_SIZES } from '../constants/styles';

const ThemeContext = createContext<null | {
  colors: ColorSchemaValueType;
  // fonts: typeof FONT_SIZES;
}>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const current = useColorSchemaStore((s) => s.currentColorSchema);

  const value = useMemo(
    () => ({
      colors: AllColorSchemas[current],
      fonts: FONT_SIZES,
    }),
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