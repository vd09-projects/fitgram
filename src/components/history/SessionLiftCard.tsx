import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextBase } from "../TextBase";
import { SPACING } from "../../constants/styles";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { EffortMark } from "./EffortMark";
import { closedSets, type CompareColumn, type LiftCardView, type LiftCompare, type SetView } from "../../utils/sessionView";

/**
 * One lift of a Session (TICKET-083, boards HistSession01 to 17), drawn from `liftCards` and `liftCompare`. It owns no
 * rule: the word, the captions, the arrows and the set text are `utils/sessionView.ts`. The amber edge and word mark a
 * lift that beat last time; a lower lift reads in the muted colour, never red (red is for discard).
 * Closed: the first sets as chips, each with its arrow against the same set last time, and "+N" for the rest. Open
 * (a tap): the compare, today beside the earlier sessions, a row per set number, so a split set makes its row
 * taller and every column stays aligned. Columns share the width, so there is no sideways scroll; the board's
 * scroll beyond 4 columns would only be reached by raising `SESSION_COMPARE_COUNT`.
 * Type sizes, board px through the System board's table: name 17 → large, word and caption 13 → xMedium, set
 * value 16 → medium, compare cell 14 → xMedium, split rows and the mark 12 and 11 → small.
 * `compare` is read only for an open card. Memoized: opening one card does not redraw the others.
 */
export const SessionLiftCard = React.memo(function SessionLiftCard({
  card,
  beat,
  open,
  compare,
  onToggle,
  onOpenHistory,
}: {
  card: LiftCardView;
  beat: boolean;
  open: boolean;
  compare: LiftCompare | null;
  onToggle: () => void;
  /** Opens this lift's Exercise screen (TICKET-084). Shown under an open card's compare. */
  onOpenHistory: () => void;
}) {
  const { styles, t } = useThemeStyles(createStyles);
  const lower = card.label === "Lower";
  const { shown, more } = closedSets(card.sets);
  return (
    <TouchableOpacity
      style={styles.card}
      testID={`session-lift-${card.id}`}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${card.name}${card.label ? `, ${card.label}` : ""}`}
    >
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
      {open ? (
        <>
          <Compare compare={compare} today={card.sets} />
          <TouchableOpacity
            style={styles.historyLink}
            onPress={onOpenHistory}
            accessibilityRole="link"
            accessibilityLabel={`${card.name} history`}
            testID={`session-lift-history-${card.id}`}
          >
            <TextBase style={styles.historyLinkText}>{card.name} history</TextBase>
            <Ionicons name="chevron-forward" size={16} color={t.colors.role.accent} />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.sets}>
          {shown.map((set) => (
            <SetChip key={set.number} set={set} />
          ))}
          {more > 0 && (
            <View style={styles.set} accessible accessibilityLabel={`${more} more sets`}>
              <TextBase style={styles.split}>+{more}</TextBase>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

function Arrow({ arrow }: { arrow: SetView["arrow"] }) {
  const { t } = useThemeStyles(createStyles);
  if (arrow === null) return null;
  return (
    <Ionicons
      name={arrow === "up" ? "caret-up" : "caret-down"}
      size={11}
      color={arrow === "up" ? t.colors.role.signal : t.colors.role.textSecondary}
      accessibilityLabel={arrow === "up" ? "better than last time" : "lower than last time"}
    />
  );
}

function SetChip({ set }: { set: SetView }) {
  const { styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.set} accessible accessibilityLabel={`Set ${set.number}`}>
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
      <EffortMark effort={set.effort} />
      <Arrow arrow={set.arrow} />
    </View>
  );
}

function Compare({ compare, today }: { compare: LiftCompare | null; today: SetView[] }) {
  const { styles } = useThemeStyles(createStyles);
  if (compare === null || compare.kind === "unavailable") {
    return <TextBase style={styles.compareNote}>Earlier sessions are not loaded yet.</TextBase>;
  }
  // Today's sets are the card's own, with their arrows; the compare's column 0 has none.
  if (compare.kind === "none") {
    return (
      <View>
        <View style={styles.sets}>
          {today.map((set) => (
            <SetChip key={set.number} set={set} />
          ))}
        </View>
        <TextBase style={styles.compareNote}>No earlier session to compare with.</TextBase>
      </View>
    );
  }
  const column = (c: CompareColumn, index: number) => (
    <TextBase key={c.sessionId ?? index} style={[styles.compareHead, index === 0 && styles.compareHeadToday]} numberOfLines={1}>
      {c.header}
    </TextBase>
  );
  return (
    <View style={styles.compare} testID="session-compare">
      <View style={styles.compareRow}>{compare.columns.map(column)}</View>
      {Array.from({ length: compare.rows }, (_, row) => (
        <View key={row} style={styles.compareRow}>
          {compare.columns.map((c, index) => {
            const cell = index === 0 ? (today[row] ?? null) : c.cells[row];
            return (
              <View key={c.sessionId ?? index} style={styles.compareCell}>
                {cell === null ? (
                  <TextBase style={styles.compareEmpty}>–</TextBase>
                ) : (
                  <>
                    <View style={styles.cellLine}>
                      <TextBase numeric style={[styles.compareText, index === 0 && styles.compareTextToday]}>
                        {cell.text ?? "Not readable"}
                      </TextBase>
                      <EffortMark effort={cell.effort} />
                      {index === 0 && <Arrow arrow={cell.arrow} />}
                    </View>
                    {cell.split.map((line, i) => (
                      <TextBase key={i} numeric style={styles.split}>
                        + {line}
                      </TextBase>
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

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
    historyLink: { marginTop: SPACING.medium, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", minHeight: 36 },
    historyLinkText: { fontSize: t.fonts.xMedium, fontWeight: "bold", color: t.colors.role.accent },
    compare: { marginTop: SPACING.medium, gap: SPACING.small },
    compareRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.small },
    compareHead: { flex: 1, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
    compareHeadToday: { fontWeight: "bold", color: t.colors.role.textPrimary },
    compareCell: { flex: 1, minWidth: 0 },
    cellLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
    compareText: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    compareTextToday: { fontWeight: "bold", color: t.colors.role.textPrimary },
    compareEmpty: { fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
    compareNote: { marginTop: SPACING.small, fontSize: t.fonts.xMedium, color: t.colors.role.textSecondary },
  });
