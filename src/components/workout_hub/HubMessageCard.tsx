import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
 * button use (as the plan card's Start), secondary 15 → medium. The optional
 * icon sits above the title, in the secondary text colour, so a failure reads
 * as one at a glance. The first run's Start Freestyle (TICKET-067) is the
 * primary with its own icon; Create a plan is the secondary under it.
 */
export function HubMessageCard({
  icon,
  title,
  body,
  action,
  secondaryAction,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
  secondaryAction?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <View style={styles.card} testID={testID}>
      {icon && <Ionicons name={icon} size={32} color={t.colors.role.textSecondary} />}
      <TextBase style={styles.title}>{title}</TextBase>
      <TextBase style={styles.body}>{body}</TextBase>
      {action && (
        <TouchableOpacity style={styles.primary} onPress={action.onPress} accessibilityRole="button">
          {action.icon && <Ionicons name={action.icon} size={18} color={t.colors.role.ground} />}
          <TextBase style={styles.primaryText}>{action.label}</TextBase>
        </TouchableOpacity>
      )}
      {secondaryAction && (
        <TouchableOpacity style={styles.secondary} onPress={secondaryAction.onPress} accessibilityRole="button">
          <TextBase style={styles.secondaryText}>{secondaryAction.label}</TextBase>
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
      flexDirection: "row",
      gap: SPACING.small,
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
    secondary: {
      height: 48,
      marginTop: -SPACING.xSmall,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.raised,
    },
    secondaryText: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
  });
