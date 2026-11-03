import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";

/**
 * A card in place of the tiles (TICKET-066): the first run's "Ready when you
 * are", and "Your plans did not load". One shape for both, so they read as the
 * same kind of message.
 *
 * Type sizes: title 22 → xLarge, body 14 → xMedium, button 17 → medium, the
 * button use (as the plan card's Start).
 */
export function HubMessageCard({
  title,
  body,
  action,
  testID,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.card} testID={testID}>
      <TextBase style={styles.title}>{title}</TextBase>
      <TextBase style={styles.body}>{body}</TextBase>
      {action && (
        <TouchableOpacity style={styles.primary} onPress={action.onPress} accessibilityRole="button">
          <TextBase style={styles.primaryText}>{action.label}</TextBase>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      marginTop: SPACING.small,
      padding: SPACING.large,
      gap: SPACING.medium,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      backgroundColor: t.colors.role.surface,
    },
    title: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    body: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    primary: {
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.accent,
    },
    primaryText: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.ground,
    },
  });
