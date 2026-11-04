import React from "react";
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { FREESTYLE_NAME } from "../../constants/freestyle";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useNow } from "../../hooks/useNow";
import { formatElapsed } from "../../utils/workoutProgress";

const HIT = 44;

/**
 * Freestyle tapped while another workout runs (TICKET-067, board Busy 3): a
 * short card with the reason and Back to <name>, the plan card's blocked
 * footer in its own sheet. The name and timer come from the running workout
 * (`blockedBy`, the screen's `activeWorkout`), never from a plan lookup.
 *
 * Decisions:
 * - **Its own card, not the plan card's blocked state**: there is no plan to
 *   show, and the plan card is not modified (TICKET-067).
 * - **No drag to close**, unlike the plan card: X, the dim area and Android
 *   back cover every close, and a card this short has no header to drag
 *   while a list scrolls. TICKET-068 checks sheets on a phone.
 * - The scrim is `rgba(0,0,0,0.5)`, as the plan card; the board's darker one
 *   has no role token either.
 *
 * Type sizes: title 22 → xLarge, its line 13 → xMedium, the reason 14 →
 * xMedium, Back to 15 → medium (as the plan card's).
 */
export function FreestyleBlockedCard({
  blockedBy,
  onBack,
  onClose,
}: {
  /** The running workout; null hides the card. */
  blockedBy: { name: string; startTime: number } | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const { styles } = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  if (!blockedBy) return <Modal visible={false} transparent onRequestClose={onClose} />;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: SPACING.small + insets.bottom }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID="freestyle-blocked-backdrop"
        />
        <View style={styles.card} accessibilityViewIsModal testID="freestyle-blocked">
          <View style={styles.handle} />
          <Header onClose={onClose} />
          <TextBase style={styles.reason}>
            {blockedBy.name} is in progress. Finish or discard it to start a {FREESTYLE_NAME}.
          </TextBase>
          <BackButton blockedBy={blockedBy} onPress={onBack} />
        </View>
      </View>
    </Modal>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const { styles, t } = useThemeStyles(createStyles);
  return (
    <View style={styles.header}>
      <View style={styles.badge}>
        <Ionicons name="add" size={20} color={t.colors.role.accent} />
      </View>
      <View style={styles.headerText}>
        <TextBase style={styles.title} accessibilityRole="header">
          {FREESTYLE_NAME}
        </TextBase>
        <TextBase style={styles.subtitle}>No plan. Pick exercises as you go.</TextBase>
      </View>
      <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={20} color={t.colors.role.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/** Back to <name> · 23:14, ticking on its own clock so the hub does not. */
function BackButton({ blockedBy, onPress }: { blockedBy: { name: string; startTime: number }; onPress: () => void }) {
  const { styles } = useThemeStyles(createStyles);
  const elapsed = formatElapsed(blockedBy.startTime, useNow(1000));
  return (
    <TouchableOpacity
      style={styles.back}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${blockedBy.name}`}
    >
      <View style={styles.liveDot} />
      <TextBase style={styles.backText} numberOfLines={1}>
        Back to {blockedBy.name}
        {elapsed !== null && (
          <>
            {" · "}
            <TextBase numeric style={styles.backText}>{elapsed}</TextBase>
          </>
        )}
      </TextBase>
    </TouchableOpacity>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: SPACING.small,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    card: {
      paddingTop: SPACING.small,
      paddingHorizontal: SPACING.xLarge,
      paddingBottom: SPACING.large,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: t.colors.role.hairlineStrong,
      backgroundColor: t.colors.role.surface,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.role.hairlineStrong,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.medium,
      marginTop: SPACING.medium,
    },
    badge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.role.accentDeep,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    subtitle: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    close: {
      width: HIT,
      height: HIT,
      marginRight: -SPACING.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    reason: {
      marginTop: SPACING.large,
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
      textAlign: "center",
    },
    back: {
      marginTop: SPACING.small,
      minHeight: 52,
      flexDirection: "row",
      gap: SPACING.small,
      paddingHorizontal: SPACING.large,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.fieldEdge,
      alignItems: "center",
      justifyContent: "center",
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    backText: {
      flexShrink: 1,
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
  });
