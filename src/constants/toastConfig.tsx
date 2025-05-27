import { BaseToast, BaseToastProps, ErrorToast } from "react-native-toast-message";
import { COLORS, FONT_FAMILY, FONT_SIZES } from "./styles";
import { TostSucessColor, TostWarnColor } from "./colors";

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: COLORS.cardBackground,
        borderLeftColor: TostSucessColor,
        borderRadius: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: COLORS.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: COLORS.textSecondary,
      }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: COLORS.cancelButton,
        backgroundColor: COLORS.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: COLORS.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: COLORS.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  ),
  warning: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: TostWarnColor,
        backgroundColor: COLORS.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: COLORS.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: COLORS.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: COLORS.tertiary,
        backgroundColor: COLORS.cardBackground,
        borderRadius: 8,
        paddingVertical: 10,
        minHeight: undefined,
        height: 'auto',
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        fontSize: FONT_SIZES.large,
        fontFamily: FONT_FAMILY.bold.name,
        color: COLORS.cardHeader,
      }}
      text2Style={{
        fontSize: FONT_SIZES.xMedium,
        fontFamily: FONT_FAMILY.regular.name,
        color: COLORS.textSecondary,
      }}
      text2NumberOfLines={0}
    />
  ),
};