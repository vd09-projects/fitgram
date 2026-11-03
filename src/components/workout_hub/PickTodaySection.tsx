import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { MaybeTourStep } from "../guide_tour/MaybeTourStep";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { START_WOURKOUT_STEP_NAMES } from "../../tour_steps/startWorkout";
import { PlanRow } from "../../utils/startWorkout";

const HIT = 44;

/**
 * "Pick today's workout" (TICKET-066): the section label, All plans N →, and
 * the tiles two to a row. The tiles themselves come from `renderTile`, so this
 * knows only the layout, not the running workout or the card.
 *
 * All plans is always shown: it is the only way to archived plans, so N counts
 * every plan, archived included. It carries the Start tour's first step, moved
 * here from the old Start Workout tile. With every plan archived there are no
 * tiles, and the line says where they went.
 *
 * Type sizes: label 10 → xSmall, as All plans' YOUR PLANS; All plans and the
 * subline 13–14 → xMedium.
 */
export function PickTodaySection({
  planCount,
  tiles,
  renderTile,
  onAllPlans,
}: {
  planCount: number;
  tiles: PlanRow[];
  renderTile: (row: PlanRow) => React.ReactNode;
  onAllPlans: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);

  // Two per row; an odd last tile keeps its half width.
  const pairs: PlanRow[][] = [];
  for (let i = 0; i < tiles.length; i += 2) pairs.push(tiles.slice(i, i + 2));

  return (
    <>
      <View style={styles.header}>
        <TextBase style={styles.label}>PICK TODAY'S WORKOUT</TextBase>
        <MaybeTourStep stepId={START_WOURKOUT_STEP_NAMES.START_WORKOUT_BUTTON}>
          <View>
            <TouchableOpacity
              style={styles.allPlans}
              onPress={onAllPlans}
              accessibilityRole="button"
              accessibilityLabel={`All plans, ${planCount}`}
            >
              <TextBase style={styles.allPlansText}>All plans </TextBase>
              <TextBase numeric style={styles.allPlansCount}>{planCount}</TextBase>
              <Ionicons name="chevron-forward" size={16} color={t.colors.role.accent} />
            </TouchableOpacity>
          </View>
        </MaybeTourStep>
      </View>
      {tiles.length === 0 ? (
        <TextBase style={styles.subline}>All your plans are archived. Open All plans to start one.</TextBase>
      ) : (
        <>
          <TextBase style={styles.subline}>Longest since you did it first.</TextBase>
          <View style={styles.grid}>
            {pairs.map((pair) => (
              <View key={pair[0].id} style={styles.gridRow}>
                {pair.map(renderTile)}
                {pair.length === 1 && <View style={styles.spacer} />}
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: HIT,
    },
    label: {
      flex: 1,
      fontSize: t.fonts.xSmall,
      fontWeight: "bold",
      letterSpacing: 1.5,
      color: t.colors.role.textSecondary,
    },
    allPlans: {
      minHeight: HIT,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    allPlansText: {
      fontSize: t.fonts.xMedium,
      fontWeight: "bold",
      color: t.colors.role.accent,
    },
    allPlansCount: {
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    subline: {
      marginTop: -SPACING.small,
      fontSize: t.fonts.xMedium,
      color: t.colors.role.textSecondary,
    },
    grid: {
      gap: 10,
    },
    gridRow: {
      flexDirection: "row",
      gap: 10,
    },
    spacer: {
      flex: 1,
    },
  });
