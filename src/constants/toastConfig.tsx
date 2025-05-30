import { BaseToast, BaseToastProps, ErrorToast } from "react-native-toast-message";
import { FONT_FAMILY, FONT_SIZES } from "./styles";
import { TostSucessColor, TostWarnColor } from "./colors";
import { useThemeTokens } from "../components/ThemeContext";

export const toastConfig = {
  success: (props: BaseToastProps) => {
    const t = useThemeTokens();
    return <BaseToast
      {...props}
      style={{
        backgroundColor: t.colors.cardBackground,
        borderLeftColor: TostSucessColor,
        borderRadius: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: t.colors.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: t.colors.textSecondary,
      }}
    />
  },
  error: (props: BaseToastProps) => {
    const t = useThemeTokens();
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: t.colors.cancelButton,
        backgroundColor: t.colors.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: t.colors.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: t.colors.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  },
  warning: (props: BaseToastProps) => {
    const t = useThemeTokens();

    <BaseToast
      {...props}
      style={{
        borderLeftColor: TostWarnColor,
        backgroundColor: t.colors.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: t.colors.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: t.colors.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  },
  info: (props: BaseToastProps) => {
    const t = useThemeTokens();
    <BaseToast
      {...props}
      style={{
        borderLeftColor: t.colors.tertiary,
        backgroundColor: t.colors.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: t.colors.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: t.colors.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  },
};