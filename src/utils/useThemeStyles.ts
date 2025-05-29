import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { ReturnTypeUseThemeTokens, useThemeTokens } from '../components/ThemeContext';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export const useThemeStyles = <T extends NamedStyles<T>>(
  createRawStyles: (t: ReturnTypeUseThemeTokens) => T
): { styles: T; t: ReturnTypeUseThemeTokens } => {
  const t = useThemeTokens();
  const styles = createRawStyles(t);
  return { styles, t };
};