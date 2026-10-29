import React from "react";
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from "react-native";
import { NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * A set's split rows under its value, on a rail: a line down the left and a
 * tick to each row, the last line stopping at its tick (board SH3,
 * TICKET-033-2). Shared by the history sheet and the Today list so a split
 * reads the same in both. The caller indents it to its own values column and
 * styles the text for its own type scale.
 */
export function SplitRail({
  rows,
  style,
  textStyle,
}: {
  rows: string[];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={style}>
      {rows.map((text, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.mark}>
            <View style={[styles.line, index === rows.length - 1 && styles.lineEnd]} />
            <View style={styles.tick} />
          </View>
          <NumericText style={[styles.text, textStyle]} numberOfLines={1}>
            {text}
          </NumericText>
        </View>
      ))}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 26,
  },
  mark: {
    width: 16,
    alignSelf: "stretch",
  },
  line: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: t.colors.role.hairlineStrong,
  },
  lineEnd: {
    bottom: "50%",
  },
  tick: {
    position: "absolute",
    left: 0,
    top: "50%",
    width: 11,
    height: 1,
    backgroundColor: t.colors.role.hairlineStrong,
  },
  text: {
    flexShrink: 1,
  },
});
