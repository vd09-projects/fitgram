import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { formatCountdown, restCountdown, RestTimer } from "../../utils/restTimer";
import { useNow } from "../../hooks/useNow";
import { TextBase, NumericText } from "../TextBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * The edit card's one line about a rest it is covering (TICKET-040, board 11).
 *
 * Editing during a rest takes the rest panel's slot but leaves the rest alone,
 * so this says it is still counting. Derived with `restCountdown` from the
 * stored timer, the panel's own call: on Save or Cancel the panel shows the
 * same time this line last showed. A rest that ends mid-edit reads "Rest done",
 * the only sign of it — there is no rest-end alert.
 */
export default function EditRestLine({ rest }: { rest: RestTimer }) {
  const { styles, t } = useThemeStyles(createStyles);
  const now = useNow(500);
  const countdown = restCountdown(rest.startedAt, rest.durationMs, now);
  const running = countdown?.state === "running";
  const remaining = running ? formatCountdown(countdown.remainingSeconds) : null;

  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={remaining !== null ? `Rest keeps running, ${remaining} left` : "Rest done"}
    >
      <Ionicons name="time-outline" size={13} color={t.colors.role.textSecondary} />
      {remaining !== null ? (
        <TextBase style={styles.text}>
          Rest keeps running · <NumericText style={styles.value}>{remaining}</NumericText> left
        </TextBase>
      ) : (
        <TextBase style={styles.text}>Rest done</TextBase>
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -SPACING.small,
  },
  text: {
    fontSize: t.fonts.small,
    color: t.colors.role.textSecondary,
  },
  value: {
    fontSize: t.fonts.small,
    color: t.colors.role.textPrimary,
  },
});
