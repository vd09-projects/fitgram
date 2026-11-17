import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import type { LiftCardView } from "../../utils/sessionView";

const EFFORT_MARK = { easy: "E", hard: "H" } as const;

/**
 * One lift of a Session (TICKET-083, boards HistSession01 to 17), drawn from `liftCards`. It owns no rule: the
 * word, the captions and the set text are `utils/sessionView.ts`. The amber edge and word mark a lift that beat
 * last time; a lower lift reads in the muted colour, never red (red is for discard).
 * Type sizes, board px through the System board's table: name 17 → large, word and caption 13 → xMedium, set
 * value 16 → medium, split rows and the mark 12 and 11 → small.
 * Not built yet (stage 3): opening the card to compare against earlier sessions, per-set arrows, and the options sheet.
 */
export const SessionLiftCard = React.memo(function SessionLiftCard({ card, beat }: { card: LiftCardView; beat: boolean }) {
  const { styles, t } = useThemeStyles(createStyles);
  const lower = card.label === "Lower";
  return (
    <View style={styles.card} testID={`session-lift-${card.id}`}>
      <View style={[styles.edge, beat && styles.edgeBeat]} />
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <TextBase style={styles.name}>{card.name}</TextBase>
          {card.captions.map((caption) => (
            <TextBase key={caption} style={styles.caption}>
              {caption}
            </TextBase>
          ))}
        </View>
        {card.label !== null && (
          <View style={[styles.pill, beat && styles.pillBeat]}>
            {(beat || lower) && (
              <Ionicons
                name={beat ? "caret-up" : "caret-down"}
                size={11}
                color={beat ? t.colors.role.signal : t.colors.role.textSecondary}
              />
            )}
            <TextBase style={[styles.pillText, beat && styles.pillTextBeat]}>{card.label}</TextBase>
          </View>
        )}
      </View>
      <View style={styles.sets}>
        {card.sets.map((set) => (
          <View key={set.number} style={styles.set} accessible accessibilityLabel={`Set ${set.number}`}>
            {set.text === null ? (
              <TextBase style={styles.unreadable}>Not readable</TextBase>
            ) : (
              <TextBase numeric style={styles.setText}>
                {set.text}
              </TextBase>
            )}
            {set.split.length > 0 && (
              <TextBase numeric style={styles.split}>
                + {set.split.join(" + ")}
              </TextBase>
            )}
            {set.effort !== null && (
              <View style={styles.mark}>
                <TextBase style={styles.markText}>{EFFORT_MARK[set.effort]}</TextBase>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
});

const createStyles = (t: ReturnTypeUseThemeTokens) =>
  StyleSheet.create({
    card: {
      marginHorizontal: SPACING.medium,
      marginBottom: SPACING.small,
      paddingVertical: SPACING.medium,
      paddingHorizontal: SPACING.large,
      borderRadius: 16,
      backgroundColor: t.colors.role.surface,
    },
    edge: { position: "absolute", left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: "transparent" },
    edgeBeat: { backgroundColor: t.colors.role.signal },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.small },
    titleText: { flexShrink: 1 },
    name: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
    caption: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    pill: {
      height: 26,
      paddingHorizontal: SPACING.small + 2,
      borderRadius: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: t.colors.role.raised,
    },
    pillBeat: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.colors.role.signal },
    pillText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.textSecondary },
    pillTextBeat: { color: t.colors.role.signal },
    sets: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.small, marginTop: SPACING.medium },
    set: {
      minHeight: 36,
      paddingHorizontal: SPACING.medium,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.role.raised,
    },
    setText: { fontSize: t.fonts.medium, fontWeight: "bold", color: t.colors.role.textPrimary },
    split: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    unreadable: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    mark: { width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.role.textPrimary },
    markText: { fontSize: t.fonts.small, fontWeight: "bold", color: t.colors.role.ground },
  });
