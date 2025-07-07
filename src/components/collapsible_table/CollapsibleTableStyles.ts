import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import {
  BORDER_RADIUS,
  BUTTON_SIZES,
  FONT_SIZES,
  SPACING,
} from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";

export type CollapsibleTableStyles = {
  outerScroll: ViewStyle;
  container: ViewStyle;
  row: ViewStyle;
  header: ViewStyle;
  rowContainer: ViewStyle;
  rowText: TextStyle;
  iconCell: ViewStyle;
  cell: ViewStyle;
  headerText: TextStyle;
  headerCellSpliter: ViewStyle;
  collapseBox: ViewStyle;
  kvGrid: ViewStyle;
  kvRow: ViewStyle;
  kvKey: TextStyle;
  kvValue: TextStyle;
  customCollapse: ViewStyle;
  evenRowColor: ViewStyle;
  oddRowColor: ViewStyle;
};

export const defaultCreateStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create<CollapsibleTableStyles>({
  outerScroll: {
    flexGrow: 0,
    ...t.shadows.shadowSmall,
  },
  container: {
    borderWidth: 1,
    borderColor: t.colors.tableBorder,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.medium,
  },
  header: {
    backgroundColor: t.colors.tableHeader,
    paddingVertical: SPACING.xMedium,
  },
  rowContainer: {
    backgroundColor: t.colors.tableRowEven,
    borderBottomWidth: 1,
    borderColor: t.colors.tableBorder,
  },
  rowText: {
    fontSize: FONT_SIZES.xMedium,
    color: t.colors.tableText,
  },
  iconCell: {
    width: BUTTON_SIZES.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    paddingHorizontal: SPACING.small,
    justifyContent: "center",
  },
  headerText: {
    fontWeight: "bold",
    fontSize: FONT_SIZES.medium,
    color: t.colors.tableHeaderText,
  },
  headerCellSpliter: {
    borderRightColor: t.colors.tableBorder,
    borderRightWidth: 1,
  },
  collapseBox: {
    paddingHorizontal: SPACING.small,
    paddingBottom: SPACING.small,
  },
  kvGrid: {
    flexDirection: "column",
  },
  kvRow: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: SPACING.xSmall,
    paddingHorizontal: SPACING.small,
  },
  kvKey: {
    fontSize: FONT_SIZES.xMedium,
    color: t.colors.tableText,
  },
  kvValue: {
    color: t.colors.tableText,
  },
  customCollapse: {
    borderTopWidth: 1,
    borderColor: t.colors.textSecondary,
    marginTop: SPACING.small,
    paddingTop: SPACING.small,
  },
  evenRowColor: {
    backgroundColor: t.colors.tableRowEven,
  },
  oddRowColor: {
    backgroundColor: t.colors.tableRowOdd,
  },
});
