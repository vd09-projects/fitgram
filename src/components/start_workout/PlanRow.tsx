import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { PartsText } from "./PartsText";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { PlanRow as PlanRowModel, TextPart, formatSince, formatVolume } from "../../utils/startWorkout";

const HIT = 44;

/** "6 exercises · last done 7 days ago · 4,980 kg · not uploaded yet" */
function summaryParts(row: PlanRowModel, now: number): TextPart[] {
  const parts: TextPart[] = [
    { text: String(row.exerciseCount), numeric: true },
    { text: row.exerciseCount === 1 ? " exercise" : " exercises" },
  ];
  if (row.lastDoneAt !== null) {
    parts.push({ text: " · last done " }, ...formatSince(row.lastDoneAt, now));
    const volume = formatVolume(row.volume, true);
    if (volume.length > 0) parts.push({ text: " · " }, ...volume);
    // The design has no slot for this; a bare date for a workout that only
    // exists on this phone would overstate what is saved.
    if (row.lastDoneSource === "pending") parts.push({ text: " · not uploaded yet" });
  }
  return parts;
}

/**
 * One plan: name and summary. Tapping opens its card (`PlanCard`, TICKET-065),
 * which replaced the row expanding in place.
 */
export function PlanRow({ row, now, onPress }: { row: PlanRowModel; now: number; onPress: () => void }) {
  const { styles, t } = useThemeStyles(createStyles);

  return (
    <View style={[styles.card, row.archived && styles.cardArchived]}>
      <TouchableOpacity
        style={styles.header}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={row.name}
      >
        <View style={styles.headerText}>
          <TextBase style={[styles.name, row.archived && styles.nameArchived]}>{row.name}</TextBase>
          <PartsText parts={summaryParts(row, now)} style={styles.summary} testID={`plan-summary-${row.id}`} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.colors.role.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: t.colors.role.surface,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      overflow: "hidden",
    },
    // TICKET-061: archived cards drop their fill and mute the name, so they
    // recede without a tag (the ARCHIVED label above already says it).
    cardArchived: {
      backgroundColor: "transparent",
    },
    nameArchived: {
      color: t.colors.role.textSecondary,
    },
    header: {
      minHeight: HIT,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.medium,
      paddingVertical: SPACING.medium,
      paddingHorizontal: SPACING.xMedium,
    },
    headerText: {
      flex: 1,
    },
    name: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    summary: {
      marginTop: 3,
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
  });
