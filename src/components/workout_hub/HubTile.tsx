import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { TextBase } from "../TextBase";
import { PartsText } from "../start_workout/PartsText";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { useNow } from "../../hooks/useNow";
import { hubTileFace, PlanRow } from "../../utils/startWorkout";
import { formatElapsed } from "../../utils/workoutProgress";

type Props = {
  row: PlanRow;
  /** False while no recent workouts are held: not loaded yet, or the first load failed (`hubTileFace`). */
  sessionsKnown: boolean;
  /** The screen's clock, read on focus: days since are counted from it. */
  now: number;
  /** Set when this tile's plan is the running workout. */
  running: { startTime: number; setsLogged: number } | null;
  onPress: () => void;
};

/**
 * One plan on the hub (TICKET-066): its name, then days since it was last done
 * (`hubTileFace`), or, while it runs, the live timer and sets logged. Every
 * tile opens the plan card, running or not; the card decides Start, Resume or
 * blocked.
 *
 * Type sizes: name 15 → medium (row title), number 24–28 → xLarge, caption
 * 11 → small.
 */
export function HubTile({ row, sessionsKnown, now, running, onPress }: Props) {
  const { styles } = useThemeStyles(createStyles);
  const face = hubTileFace(row, sessionsKnown, now);
  return (
    <TouchableOpacity
      style={[styles.tile, running && styles.tileRunning]}
      onPress={onPress}
      accessibilityRole="button"
      testID={`hub-tile-${row.id}`}
    >
      <TextBase style={styles.name} numberOfLines={3}>
        {row.name}
      </TextBase>
      {running ? (
        <LiveFooter startTime={running.startTime} setsLogged={running.setsLogged} />
      ) : (
        <View>
          <PartsText parts={face.big} style={styles.big} />
          <PartsText parts={face.caption} style={styles.caption} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * The running tile's timer. Its own clock (`useNow`), so only this ticks each
 * second, never the hub or the other tiles.
 */
function LiveFooter({ startTime, setsLogged }: { startTime: number; setsLogged: number }) {
  const { styles } = useThemeStyles(createStyles);
  const elapsed = formatElapsed(startTime, useNow(1000));
  return (
    <View>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <TextBase numeric style={styles.big}>{elapsed ?? "—"}</TextBase>
      </View>
      <TextBase style={[styles.caption, styles.captionRunning]}>
        in progress · <TextBase numeric style={[styles.caption, styles.captionRunning]}>{setsLogged}</TextBase>
        {setsLogged === 1 ? " set" : " sets"}
      </TextBase>
    </View>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      minHeight: 128,
      padding: 14,
      justifyContent: "space-between",
      gap: SPACING.small,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.role.hairline,
      backgroundColor: t.colors.role.surface,
    },
    tileRunning: {
      borderWidth: 1.5,
      borderColor: t.colors.role.accent,
      backgroundColor: t.colors.role.accentDeep,
    },
    name: {
      fontSize: t.fonts.medium,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    liveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.small,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.role.accent,
    },
    big: {
      fontSize: t.fonts.xLarge,
      fontWeight: "bold",
      color: t.colors.role.textPrimary,
    },
    caption: {
      fontSize: t.fonts.small,
      color: t.colors.role.textSecondary,
    },
    captionRunning: {
      color: t.colors.role.textPrimary,
    },
  });
