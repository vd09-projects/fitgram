import { COLORS } from "./../../constants/styles";
import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import {
  BORDER_RADIUS,
  BUTTON_SIZES,
  FONT_SIZES,
  SHADOW,
  SPACING,
} from "../../constants/styles";

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

export const defaultStyles = StyleSheet.create<CollapsibleTableStyles>({
  outerScroll: {
    flexGrow: 0,
    ...SHADOW,
  },
  container: {
    borderWidth: 1,
    borderColor: COLORS.tableBorder,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.medium,
  },
  header: {
    backgroundColor: COLORS.tableHeader,
    paddingVertical: SPACING.xMedium,
  },
  rowContainer: {
    backgroundColor: COLORS.tableRowEven,
    borderBottomWidth: 1,
    borderColor: COLORS.tableBorder,
  },
  rowText: {
    fontSize: FONT_SIZES.xMedium,
    color: COLORS.tableText,
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
    color: COLORS.tableHeaderText,
  },
  headerCellSpliter: {
    borderRightColor: COLORS.tableBorder,
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
    color: COLORS.tableText,
  },
  kvValue: {
    color: COLORS.tableText,
  },
  customCollapse: {
    borderTopWidth: 1,
    borderColor: COLORS.textSecondary,
    marginTop: SPACING.small,
    paddingTop: SPACING.small,
  },
  evenRowColor: {
    backgroundColor: COLORS.tableRowEven,
  },
  oddRowColor: {
    backgroundColor: COLORS.tableRowOdd,
  },
});
