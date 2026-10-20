import React from "react";
import { StyleSheet } from "react-native";
import AlertBase from "../AlertBase";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

const HIT = 44;

/**
 * The one confirmation before an in-progress workout is thrown away. Shared by
 * the active workout's ··· menu and the Start screen's resume banner, so both
 * ask the same question with the same weight.
 *
 * `keepLabel` differs by screen: "Keep logging" mid-workout, "Keep it" from the
 * Start screen, where nothing is being logged.
 */
export function DiscardWorkoutDialog({
  visible,
  keepLabel,
  onKeep,
  onDiscard,
}: {
  visible: boolean;
  keepLabel: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);

  return (
    <AlertBase
      visible={visible}
      title="Discard this workout?"
      message="Every set logged in this session will be deleted. This cannot be undone."
      onRequestClose={onKeep}
      containerStyle={styles.card}
      titleStyle={styles.title}
      messageStyle={styles.message}
      buttons={[
        { text: keepLabel, onPress: onKeep, style: styles.keep, textStyle: styles.keepText },
        { text: "Discard", onPress: onDiscard, style: styles.discard, textStyle: styles.discardText },
      ]}
    />
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
    },
    title: {
      color: t.colors.role.textPrimary,
    },
    message: {
      color: t.colors.role.textSecondary,
    },
    // Dialog buttons are filled, not outlined. A 1dp outline on a button laid out
    // at a fractional pixel position renders some edges thinner than others on
    // Android; a bright danger outline made that obvious. Fills have no such edge.
    keep: {
      minHeight: HIT,
      backgroundColor: t.colors.role.raised,
    },
    keepText: {
      color: t.colors.role.textPrimary,
    },
    // Solid danger: the one irreversible action.
    discard: {
      minHeight: HIT,
      backgroundColor: t.colors.role.danger,
    },
    discardText: {
      color: t.colors.role.ground,
    },
  });
