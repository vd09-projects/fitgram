// src/components/exercise_picker/ExercisePicker.tsx
//
// The exercise picker (TICKET-043, boards A2–A4): search, then the version.
// Full screen over Manage Workout, opened in place of the old Exercise
// dropdown. Returns the plan exercise `planExerciseFromPick` expects, so the
// field editor and Save are unchanged.
//
// An overlay inside the screen, not a navigation route and not an RN `Modal`:
// it hands the pick back by callback and keeps Manage Workout's state, and the
// guided tour's overlay (mounted at the app root) still draws over it. The
// Android back button closes the sheet, then the picker.
//
// The search box is fixed at the bottom, under the list (user, 2026-10-27,
// after the first device run; board A2 had it at the top): within thumb
// reach, and it rides on the keyboard. The list still reads top-down, not
// inverted, so A–Z and the best match start at the top.
//
// Not here, by ticket: recents, filter menus and "last used" (TICKET-050).

import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { MUSCLES } from "../../constants/catalogVocabulary";
import type { Movement, SearchWords } from "../../types/catalog";
import type { Exercise } from "../../types/workoutType";
import { planExerciseForVersion } from "../../utils/catalog";
import { searchExercises, type VersionPick } from "../../utils/exerciseSearch";
import { PICKER_RESULT_LIMIT, preparePicker, type PickerRow as Row } from "../../utils/pickerData";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { TextBase } from "../TextBase";
import SearchBox from "../SearchBox";
import VersionSheet from "./VersionSheet";

const NO_MOVEMENTS: readonly Movement[] = [];

type Props = {
  /** Null while the phone has no catalog (first launch offline, before the upload). */
  movements: readonly Movement[] | null;
  /** Null until `search_words` loads: labels still search, slang does not. */
  searchWords: SearchWords | null;
  /** The user's custom exercises (from their plans), searched by name only. */
  customExercises: readonly Exercise[];
  /** Exercise ids already in the plan: those versions are disabled. */
  inPlan: ReadonlySet<string>;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  tourStepPrefix?: string;
};

/**
 * A movement's second line (board A2, chosen): the main muscle, then the
 * others, "Chest · triceps, front delts". At most three others, primaries first.
 */
export function muscleLine(movement: Movement): string {
  const [main, ...rest] = movement.primaryMuscles;
  const others = [...new Set([...rest, ...movement.secondaryMuscles])].filter((m) => m !== main).slice(0, 3);
  const label = MUSCLES[main].label;
  return others.length ? `${label} · ${others.map((m) => MUSCLES[m].label.toLowerCase()).join(", ")}` : label;
}

export default function ExercisePicker({ movements, searchWords, customExercises, inPlan, onPick, onClose, tourStepPrefix }: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{ movement: Movement; preselect: VersionPick } | null>(null);

  // Empty query: every movement A–Z (TICKET-043; TICKET-050 replaces it with Recent).
  const { catalog, alphabetical } = useMemo(
    () => preparePicker(movements ?? NO_MOVEMENTS, searchWords, customExercises),
    [movements, searchWords, customExercises]
  );
  // Timed by src/scripts/benchmarkSearch.ts, against benchmarks/exercise-search.json.
  const search = useMemo(
    () => (query.trim() ? searchExercises(catalog, query, PICKER_RESULT_LIMIT) : null),
    [catalog, query]
  );
  const rows: readonly Row[] = search
    ? search.results.map((r) =>
        r.kind === "movement"
          ? { kind: "movement", key: r.movement.id, movement: r.movement, preselect: r.preselect }
          : { kind: "custom", key: `custom:${r.exercise.id}`, exercise: r.exercise }
      )
    : alphabetical;
  // Board A4: no special state for typos, just the heading.
  const closeMatches = !!search && search.results.length > 0 && search.results.every((r) => r.fuzzy);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sheet) setSheet(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [sheet, onClose]);

  const pickMovement = (movement: Movement, preselect: VersionPick) => {
    if (movement.versions.length === 1) onPick(planExerciseForVersion(movement, movement.versions[0]));
    else setSheet({ movement, preselect });
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "custom") {
      const taken = inPlan.has(item.exercise.id);
      return (
        <TouchableOpacity
          style={[styles.row, taken && styles.rowDisabled]}
          disabled={taken}
          onPress={() => onPick(item.exercise)}
          accessibilityRole="button"
          accessibilityState={{ disabled: taken }}
        >
          <View style={styles.rowText}>
            <TextBase style={styles.name}>{item.exercise.name}</TextBase>
            <TextBase style={styles.detail}>Custom</TextBase>
          </View>
          {taken && <TextBase style={styles.badge}>In plan</TextBase>}
        </TouchableOpacity>
      );
    }
    const { movement, preselect } = item;
    const count = movement.versions.length;
    // One version already in the plan: nothing left to add (board A2, "In plan").
    const taken = count === 1 && inPlan.has(movement.versions[0].id);
    return (
      <TouchableOpacity
        style={[styles.row, taken && styles.rowDisabled]}
        disabled={taken}
        onPress={() => pickMovement(movement, preselect)}
        accessibilityRole="button"
        accessibilityState={{ disabled: taken }}
      >
        <View style={styles.rowText}>
          <TextBase style={styles.name}>{movement.name}</TextBase>
          <TextBase style={styles.detail}>{muscleLine(movement)}</TextBase>
        </View>
        {taken ? (
          <TextBase style={styles.badge}>In plan</TextBase>
        ) : (
          count > 1 && <TextBase style={styles.count}>{`${count} versions`}</TextBase>
        )}
      </TouchableOpacity>
    );
  };

  return (
    // iOS: padding lifts the search box over the keyboard. Android: none, the
    // window already resizes for the keyboard (Expo's default), and "height"
    // on top of that would lift it twice.
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID="exercise-picker"
    >
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={t.colors.role.textPrimary} />
        </TouchableOpacity>
        <TextBase style={styles.heading}>Add exercise</TextBase>
      </View>
      {movements === null ? (
        <TextBase style={[styles.empty, styles.body]}>Exercise catalog not loaded yet. Connect once and reopen.</TextBase>
      ) : search && search.results.length === 0 ? (
        <View style={[styles.none, styles.body]}>
          <TextBase style={styles.noneTitle}>No exercise matches</TextBase>
          <TextBase style={styles.empty}>
            Every word has to match. Try fewer words, the movement (“low row”) or a muscle (“lats”).
          </TextBase>
        </View>
      ) : (
        <FlatList
          style={styles.body}
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          ListHeaderComponent={
            <TextBase style={styles.section}>{closeMatches ? "Close matches" : "Exercises"}</TextBase>
          }
        />
      )}

      <SearchBox
        label="Search"
        placeholder="Name, muscle or equipment"
        value={query}
        onChangeText={setQuery}
        tourStepPrefix={tourStepPrefix}
        tourPosition="above"
      />

      {sheet && (
        <VersionSheet
          key={sheet.movement.id}
          movement={sheet.movement}
          subtitle={muscleLine(sheet.movement)}
          preselect={sheet.preselect}
          inPlan={inPlan}
          onClose={() => setSheet(null)}
          onAdd={(version) => onPick(planExerciseForVersion(sheet.movement, version))}
          tourStepPrefix={tourStepPrefix}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: ReturnTypeUseThemeTokens) => StyleSheet.create({
  screen: {
    backgroundColor: t.colors.role.ground,
    paddingHorizontal: SPACING.large,
    paddingTop: SPACING.medium,
    paddingBottom: SPACING.small,
  },
  top: { flexDirection: "row", alignItems: "center", gap: SPACING.small },
  body: { flex: 1 },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  section: {
    fontSize: t.fonts.small,
    fontWeight: "600",
    color: t.colors.role.textSecondary,
    marginTop: SPACING.small,
    marginBottom: SPACING.xSmall,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.medium,
    borderBottomWidth: 1,
    borderColor: t.colors.role.hairline,
    gap: SPACING.small,
  },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: t.fonts.medium, fontWeight: "600", color: t.colors.role.textPrimary },
  detail: { marginTop: 2, fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  count: { fontSize: t.fonts.small, color: t.colors.role.textSecondary },
  badge: { fontSize: t.fonts.small, fontWeight: "600", color: t.colors.role.accent },
  none: { marginTop: SPACING.xLarge, gap: SPACING.small },
  noneTitle: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  empty: { fontSize: t.fonts.small, color: t.colors.role.textSecondary, marginTop: SPACING.medium },
});
