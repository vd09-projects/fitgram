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
// The start page (TICKET-050, board A1): before anything is typed, Recent (the
// movements logged last, newest first) and then "All exercises" A–Z, a
// deviation from A1, which shows Recent only (user, 2026-10-27, D1). With no
// history, or while it is unknown, the A–Z list alone. Filter menus sit just
// above the search box (D2); any filter hides Recent and filters the A–Z list
// (D3), or ANDs with the query. The version sheet preselects the version used
// last, wherever it opens from (D8).

import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../../constants/styles";
import { MUSCLES } from "../../constants/catalogVocabulary";
import type { Movement, SearchWords } from "../../types/catalog";
import type { Exercise } from "../../types/workoutType";
import { planExerciseForVersion } from "../../utils/catalog";
import { versionDetail } from "../../utils/catalog";
import { searchExercises, type VersionPick } from "../../utils/exerciseSearch";
import {
  hasFilters,
  matchesFilters,
  PICKER_RESULT_LIMIT,
  preparePicker,
  withFilterPreselect,
  type PickerFilters,
  type PickerRow,
} from "../../utils/pickerData";
import { recentDateLabel, type LastUsed, type RecentHistory, type RecentRow } from "../../utils/recents";
import { ReturnTypeUseThemeTokens } from "../app_manager/ThemeContext";
import { useThemeStyles } from "../../utils/useThemeStyles";
import { TextBase } from "../TextBase";
import SearchBox from "../SearchBox";
import VersionSheet from "./VersionSheet";
import { FilterRow, FilterSheet, type FilterMenu } from "./FilterMenus";

const NO_MOVEMENTS: readonly Movement[] = [];
const NO_FILTERS: PickerFilters = {};
const NO_RECENTS: readonly RecentRow[] = [];

type Row =
  | PickerRow
  | { kind: "header"; key: string; title: string }
  | { kind: "recent"; key: string; recent: RecentRow };

/**
 * What the picker is for (TICKET-047). One prop rather than a label each: swap
 * changes the heading, the taken badge, a "Back to plan" row and the version
 * step's button, and TICKET-056 adds its own kind beside these.
 * - `plan`: Manage Workout adds to a plan. Taken ids read "In plan".
 * - `swap`: the active workout replaces `replacing`, for this workout only.
 *   Taken ids are today's exercises: `replacing` reads "Now", the rest "In
 *   workout". `planned` is the plan's exercise while the slot is swapped, for
 *   the "Back to plan" row; null when the slot holds what the plan has.
 * Titles come resolved from the caller, which holds the names (`useExerciseNames`).
 */
export type PickerMode =
  | { kind: "plan" }
  | {
      kind: "swap";
      replacing: { id: string; title: string };
      planned: { exercise: Exercise; title: string } | null;
    };

const PLAN_MODE: PickerMode = { kind: "plan" };

/** The badge on a row that cannot be picked because its id is taken. */
export function takenLabel(mode: PickerMode, id: string): string {
  if (mode.kind === "plan") return "In plan";
  return id === mode.replacing.id ? "Now" : "In workout";
}

type Props = {
  /** Null while the phone has no catalog (first launch offline, before the upload). */
  movements: readonly Movement[] | null;
  /** Null until `search_words` loads: labels still search, slang does not. */
  searchWords: SearchWords | null;
  /** The user's custom exercises (from their plans), searched by name only. */
  customExercises: readonly Exercise[];
  /** Exercise ids already taken (in the plan, or in today's workout): those versions are disabled. */
  inPlan: ReadonlySet<string>;
  /** Default `plan`. */
  mode?: PickerMode;
  /** Recents and last-used versions (`buildRecentHistory`); null while unknown: no Recent, nothing preselected. */
  recentHistory: RecentHistory | null;
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

export default function ExercisePicker({
  movements,
  searchWords,
  customExercises,
  inPlan,
  mode = PLAN_MODE,
  recentHistory,
  onPick,
  onClose,
  tourStepPrefix,
}: Props) {
  const { styles, t } = useThemeStyles(createStyles);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PickerFilters>(NO_FILTERS);
  const [menu, setMenu] = useState<FilterMenu | null>(null);
  const [sheet, setSheet] = useState<{ movement: Movement; preselect: VersionPick; lastUsed: LastUsed | null } | null>(null);

  const { catalog, alphabetical, equipmentByUse } = useMemo(
    () => preparePicker(movements ?? NO_MOVEMENTS, searchWords, customExercises),
    [movements, searchWords, customExercises]
  );
  const filtering = hasFilters(filters);
  const keep = useMemo(() => (filtering ? (m: Movement) => matchesFilters(m, filters) : undefined), [filtering, filters]);
  // Timed by src/scripts/benchmarkSearch.ts, against benchmarks/exercise-search.json.
  const search = useMemo(
    () => (query.trim() ? searchExercises(catalog, query, PICKER_RESULT_LIMIT, keep) : null),
    [catalog, query, keep]
  );
  const browse = useMemo(
    () => (keep ? alphabetical.filter((r) => r.kind === "movement" && keep(r.movement)) : alphabetical),
    [alphabetical, keep]
  );
  // Board A4: no special state for typos, just the heading.
  const closeMatches = !!search && search.results.length > 0 && search.results.every((r) => r.fuzzy);
  const recents = !search && !filtering ? recentHistory?.recents ?? NO_RECENTS : NO_RECENTS;

  const rows: readonly Row[] = useMemo(() => {
    if (search) {
      return [
        { kind: "header", key: "h:results", title: closeMatches ? "Close matches" : "Exercises" },
        ...search.results.map((r): Row =>
          r.kind === "movement"
            ? { kind: "movement", key: r.movement.id, movement: r.movement, preselect: r.preselect }
            : { kind: "custom", key: `custom:${r.exercise.id}`, exercise: r.exercise }
        ),
      ];
    }
    if (recents.length === 0) return browse.length ? [{ kind: "header", key: "h:all", title: "Exercises" }, ...browse] : [];
    return [
      { kind: "header", key: "h:recent", title: "Recent" },
      ...recents.map((recent): Row => ({
        kind: "recent",
        key: `recent:${recent.kind === "movement" ? recent.movement.id : recent.exercise.id}`,
        recent,
      })),
      { kind: "header", key: "h:all", title: "All exercises" },
      ...browse,
    ];
  }, [search, closeMatches, recents, browse]);
  const hasResults = rows.some((r) => r.kind !== "header");

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sheet) setSheet(null);
      else if (menu) setMenu(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [sheet, menu, onClose]);

  const pickMovement = (movement: Movement, preselect: VersionPick) => {
    if (movement.versions.length === 1) onPick(planExerciseForVersion(movement, movement.versions[0]));
    else
      setSheet({
        movement,
        // An Equipment filter counts as typed equipment, so it, like a query
        // naming an axis, opens the sheet without last used (D4, D7).
        preselect: withFilterPreselect(movement, preselect, filters),
        lastUsed: recentHistory?.lastUsed.get(movement.id) ?? null,
      });
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "header") return <TextBase style={styles.section}>{item.title}</TextBase>;
    if (item.kind === "recent") return renderRecent(item.recent);
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
          {taken && <TextBase style={styles.badge}>{takenLabel(mode, item.exercise.id)}</TextBase>}
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
          <TextBase style={styles.badge}>{takenLabel(mode, movement.versions[0].id)}</TextBase>
        ) : (
          count > 1 && <TextBase style={styles.count}>{`${count} versions`}</TextBase>
        )}
      </TouchableOpacity>
    );
  };

  // Board A1: a Recent row is the movement, then the combination last logged
  // and its date ("Barbell, close grip · 22 Oct"); the date alone for a
  // movement with one version. A single version is added at once, or reads
  // In plan when it is already there.
  const renderRecent = (recent: RecentRow) => {
    const date = recentDateLabel(recent.performedAt, Date.now());
    if (recent.kind === "custom") {
      const taken = inPlan.has(recent.exercise.id);
      return (
        <TouchableOpacity
          style={[styles.row, taken && styles.rowDisabled]}
          disabled={taken}
          onPress={() => onPick(recent.exercise)}
          accessibilityRole="button"
          accessibilityState={{ disabled: taken }}
        >
          <View style={styles.rowText}>
            <TextBase style={styles.name}>{recent.exercise.name}</TextBase>
            <TextBase style={styles.detail}>{`Custom · ${date}`}</TextBase>
          </View>
          {taken && <TextBase style={styles.badge}>{takenLabel(mode, recent.exercise.id)}</TextBase>}
        </TouchableOpacity>
      );
    }
    const { movement, version } = recent;
    const detail = versionDetail(movement, version);
    const taken = movement.versions.length === 1 && inPlan.has(movement.versions[0].id);
    return (
      <TouchableOpacity
        style={[styles.row, taken && styles.rowDisabled]}
        disabled={taken}
        onPress={() => pickMovement(movement, {})}
        accessibilityRole="button"
        accessibilityState={{ disabled: taken }}
      >
        <View style={styles.rowText}>
          <TextBase style={styles.name}>{movement.name}</TextBase>
          <TextBase style={styles.detail}>{detail ? `${detail} · ${date}` : date}</TextBase>
        </View>
        {taken && <TextBase style={styles.badge}>{takenLabel(mode, movement.versions[0].id)}</TextBase>}
      </TouchableOpacity>
    );
  };

  const backTaken = mode.kind === "swap" && !!mode.planned && inPlan.has(mode.planned.exercise.id);

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
        <View style={styles.headingText}>
          <TextBase style={styles.heading} numberOfLines={2}>
            {mode.kind === "swap" ? `Swap ${mode.replacing.title}` : "Add exercise"}
          </TextBase>
          {mode.kind === "swap" && (
            <TextBase style={styles.detail}>
              {`For this workout only. Your plan keeps ${mode.planned ? mode.planned.title : "it"}.`}
            </TextBase>
          )}
        </View>
      </View>
      {/* Board SwapBack: the way back from a swap is here, not on the logger.
          Taken like any other row: another slot may have been swapped to the
          plan's exercise, and the store refuses a duplicate id (PR #34 review). */}
      {mode.kind === "swap" && mode.planned && (
        <TouchableOpacity
          style={[styles.backToPlan, backTaken && styles.rowDisabled]}
          disabled={backTaken}
          onPress={() => mode.planned && onPick(mode.planned.exercise)}
          accessibilityRole="button"
          accessibilityLabel={`Back to plan: ${mode.planned.title}`}
          accessibilityState={{ disabled: backTaken }}
        >
          <Ionicons name="arrow-undo" size={20} color={t.colors.role.accent} />
          <View style={styles.rowText}>
            <TextBase style={styles.name}>{`Back to plan: ${mode.planned.title}`}</TextBase>
            <TextBase style={styles.detail}>The one your plan has</TextBase>
          </View>
          {backTaken && <TextBase style={styles.badge}>{takenLabel(mode, mode.planned.exercise.id)}</TextBase>}
        </TouchableOpacity>
      )}
      {movements === null ? (
        <TextBase style={[styles.empty, styles.body]}>Exercise catalog not loaded yet. Connect once and reopen.</TextBase>
      ) : !hasResults ? (
        <View style={[styles.none, styles.body]}>
          <TextBase style={styles.noneTitle}>No exercise matches</TextBase>
          <TextBase style={styles.empty}>
            {search
              ? "Every word has to match. Try fewer words, the movement (“low row”) or a muscle (“lats”)."
              : "Every filter has to match. Clear one to see more."}
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
        />
      )}

      <FilterRow filters={filters} onOpen={setMenu} />

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
          lastUsed={sheet.lastUsed}
          inPlan={inPlan}
          mode={mode}
          onClose={() => setSheet(null)}
          onAdd={(version) => onPick(planExerciseForVersion(sheet.movement, version))}
          tourStepPrefix={tourStepPrefix}
        />
      )}

      {menu && (
        <FilterSheet menu={menu} filters={filters} equipmentByUse={equipmentByUse} onChange={setFilters} onClose={() => setMenu(null)} />
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
  headingText: { flex: 1, minWidth: 0 },
  heading: { fontSize: t.fonts.large, fontWeight: "bold", color: t.colors.role.textPrimary },
  backToPlan: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.small,
    marginTop: SPACING.medium,
    padding: SPACING.medium,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.role.hairlineStrong,
    backgroundColor: t.colors.role.raised,
  },
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
