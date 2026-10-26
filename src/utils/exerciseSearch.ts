// src/utils/exerciseSearch.ts
//
// Exercise search (TICKET-043): movement first, then the version. Ported from
// the research prototype (`search()` in research/exercise-catalog/build.py,
// reference only), whose rules each fixed a bug it hit. They are restated where
// they are implemented below.
//
// Pure: the catalog and the search words are passed in, never imported. The app
// reads both from the catalog store (TICKET-042); tests pass `src/catalog`.

import {
  ANGLES,
  ATTACHMENTS,
  EQUIPMENT,
  GRIPS,
  MUSCLE_GROUPS,
  MUSCLES,
  ONE_SIDE_LABELS,
  type AngleId,
  type AttachmentId,
  type CategoryId,
  type EquipmentId,
  type GripId,
  type MuscleGroupId,
  type MuscleId,
} from "../constants/catalogVocabulary";
import type { AxisWord, Movement, MovementVersion, SearchWords } from "../types/catalog";
import type { Exercise } from "../types/workoutType";

// ---------------------------------------------------------------------------
// Words

/**
 * Crude plural fold, from the prototype: deadlifts → deadlift, flies → fly,
 * pull-ups → up. 10 of the app's 42 old names ("Deadlifts", "Pull-Ups") found
 * nothing before it. Applied to every word on both sides, vocabulary keys
 * included, so "calves" and "calf" both reach their table entry.
 */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Lower case, apostrophes dropped ("Farmer's" = "farmers"), split on anything else. */
function words(text: string): string[] {
  return text.toLowerCase().replace(/['’]/g, "").match(/[a-z0-9]+/g) ?? [];
}

const stemmed = (text: string): string[] => words(text).map(stem);
const normalized = (text: string): string => stemmed(text).join(" ");

// ---------------------------------------------------------------------------
// Vocabulary: what a typed word means. Two sources, merged once per catalog in
// `buildVocabulary`:
// - DERIVED from the labels in catalogVocabulary.ts: every muscle, muscle
//   group, equipment, angle, attachment, grip and one-side label is searchable
//   with no entry anywhere ("upper chest", "smith machine", "close grip")
// - LOADED slang, `exercise_catalog/search_words` (`SearchWords`, source
//   src/catalog/searchWords.ts): "pecs", "db", "machine" → three machines.
//   A slang entry overrides a derived one with the same key
// Rejected (user, 2026-10-27): a hand-written table in this file, which copied
// the labels and shipped every new slang word as an app build.
//
// Keys are stemmed once, so lookups match stemmed query words. Multi-word keys
// are PHRASES, matched before the query is split into words: splitting
// `side_delts` made "side" a muscle word, and "Side Plank" returned nothing. So
// modifiers (side, rear, front, upper, lower, deep, hip) mean a muscle only
// inside a phrase.

/**
 * A muscle word picks the muscles it names. `exact` decides the 10-point
 * "first primary" match; `broad` only counts as another primary (8) or a
 * secondary (1).
 */
type MuscleTarget = { exact: MuscleId[]; broad: MuscleId[] };

/** A version axis named by a word. */
type AxisValue = AxisWord;

type Region = "upper" | "lower";

type Vocabulary = {
  muscles: Map<string, MuscleTarget>;
  equipment: Map<string, EquipmentId[]>;
  axes: Map<string, AxisValue>;
  regions: Map<string, Region>;
  synonyms: Map<string, string>;
  /** Longest phrase first, e.g. [3, 2]. */
  phraseLengths: number[];
};

const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];
const inGroup = (group: MuscleGroupId): MuscleId[] => MUSCLE_IDS.filter((m) => MUSCLES[m].group === group);

/**
 * "abs" is exact on `abs` and broad on the rest of the core, so a Plank (abs
 * first) outranks a Side Plank (obliques first), and both are found. A rule, so
 * it stays here: every word that means abs gets it, slang included.
 */
const BROADER: Partial<Record<MuscleId, MuscleGroupId>> = { abs: "core" };
const muscleTarget = (exact: MuscleId[]): MuscleTarget => ({
  exact,
  broad: exact.flatMap((m) => (BROADER[m] ? inGroup(BROADER[m]!) : [])),
});

/**
 * "cardio" is never a muscle word, though it is a muscle and a group label: it
 * is a category, and as a muscle it would hide every cardio exercise whose
 * muscles do not list it.
 */
const NOT_MUSCLE_WORDS = new Set(["cardio"]);

/**
 * Split days (TICKET-043, user 2026-10-27): "push day", "leg day", "upper
 * body". "day" and "workout" are filler and dropped; what is left already
 * resolves ("push" through the pattern, "leg" as a muscle group), plus the two
 * region phrases here. Rules, not slang: they stay in code.
 */
const FILLER = new Set(["day", "workout"]);
const REGION_WORDS: Record<string, Region> = { "upper body": "upper", "lower body": "lower" };

/** Words for a category, which no label spells. */
const WORD_SYNONYMS: Record<string, string> = { stretch: "stretching", warmup: "mobility" };

/** The vocabulary for one catalog: derived labels, then loaded slang over them. */
function buildVocabulary(slang: SearchWords | null): Vocabulary {
  const muscles = new Map<string, MuscleTarget>();
  const equipment = new Map<string, EquipmentId[]>();
  const axes = new Map<string, AxisValue>();
  const put = <T>(map: Map<string, T>, word: string, value: T) => {
    const key = normalized(word);
    if (key && !NOT_MUSCLE_WORDS.has(key)) map.set(key, value);
  };

  // Muscles first, then groups: "chest" and "neck" are both, and the group wins
  // (typing "chest" means the whole chest, upper chest included).
  for (const m of MUSCLE_IDS) put(muscles, MUSCLES[m].label, muscleTarget([m]));
  for (const g of Object.keys(MUSCLE_GROUPS) as MuscleGroupId[]) put(muscles, MUSCLE_GROUPS[g], muscleTarget(inGroup(g)));
  // Equipment by its label and by its key spelled out ("plate loaded machine").
  for (const e of Object.keys(EQUIPMENT) as EquipmentId[]) {
    put(equipment, EQUIPMENT[e], [e]);
    put(equipment, e.replace(/_/g, " "), [e]);
  }
  for (const a of Object.keys(ANGLES) as AngleId[]) put(axes, ANGLES[a], { axis: "angle", value: a });
  for (const a of Object.keys(ATTACHMENTS) as AttachmentId[]) put(axes, ATTACHMENTS[a], { axis: "attachment", value: a });
  for (const g of Object.keys(GRIPS) as GripId[]) put(axes, GRIPS[g], { axis: "grip", value: g });
  for (const label of Object.values(ONE_SIDE_LABELS)) put(axes, label, { axis: "unilateral", value: true });

  if (slang) {
    for (const [word, g] of Object.entries(slang.muscleGroups)) put(muscles, word, muscleTarget(inGroup(g)));
    for (const [word, ms] of Object.entries(slang.muscles)) put(muscles, word, muscleTarget(ms));
    for (const [word, es] of Object.entries(slang.equipment)) put(equipment, word, es);
    for (const [word, axis] of Object.entries(slang.axes)) put(axes, word, axis);
  }

  const regions = new Map(Object.entries(REGION_WORDS).map(([w, r]) => [normalized(w), r]));
  const synonyms = new Map(Object.entries(WORD_SYNONYMS).map(([w, t]) => [normalized(w), t]));
  const lengths = new Set<number>();
  for (const map of [muscles, equipment, axes, regions] as Map<string, unknown>[])
    for (const key of map.keys()) if (key.includes(" ")) lengths.add(key.split(" ").length);
  return { muscles, equipment, axes, regions, synonyms, phraseLengths: [...lengths].sort((a, b) => b - a) };
}

/**
 * Equipment and axis values named by a prefix of 4 or more letters, for
 * typing in progress: "incl db" names incline. Unambiguous prefixes only.
 * Shorter prefixes stay plain words ("dec" is not yet decline).
 */
const PREFIX_MIN = 4;
function namedByPrefix(vocab: Vocabulary, word: string): { equipment?: EquipmentId[]; axis?: AxisValue } {
  if (word.length < PREFIX_MIN) return {};
  const hits: Array<{ equipment?: EquipmentId[]; axis?: AxisValue }> = [];
  for (const [key, equipment] of vocab.equipment) if (!key.includes(" ") && key.startsWith(word)) hits.push({ equipment });
  for (const [key, axis] of vocab.axes) if (!key.includes(" ") && key.startsWith(word)) hits.push({ axis });
  return hits.length === 1 ? hits[0] : {};
}

// ---------------------------------------------------------------------------
// Query → terms. Every term must match (AND across axes: "dumbbell chest"
// means both).

type Term = {
  /** The typed words, stemmed. Name and alias matches use these, as prefixes. */
  words: string[];
  muscle?: MuscleTarget;
  equipment?: EquipmentId[];
  axis?: AxisValue;
  region?: Region;
};

function termFor(vocab: Vocabulary, key: string): Term {
  const w = key.split(" ");
  const muscle = vocab.muscles.get(key);
  if (muscle) return { words: w, muscle };
  const equipment = vocab.equipment.get(key);
  if (equipment) return { words: w, equipment };
  const axis = vocab.axes.get(key);
  if (axis) return { words: w, axis };
  const region = vocab.regions.get(key);
  if (region) return { words: w, region };
  const synonym = vocab.synonyms.get(key);
  if (synonym) return { words: [synonym] };
  return { words: w, ...namedByPrefix(vocab, key) };
}

const isPhrase = (vocab: Vocabulary, key: string): boolean =>
  vocab.muscles.has(key) || vocab.equipment.has(key) || vocab.axes.has(key) || vocab.regions.has(key);

function queryTerms(vocab: Vocabulary, query: string): Term[] {
  const w = stemmed(query).filter((word) => !FILLER.has(word));
  const terms: Term[] = [];
  let i = 0;
  while (i < w.length) {
    const length = vocab.phraseLengths.find((n) => i + n <= w.length && isPhrase(vocab, w.slice(i, i + n).join(" ")));
    const n = length ?? 1;
    terms.push(termFor(vocab, w.slice(i, i + n).join(" ")));
    i += n;
  }
  return terms;
}

// ---------------------------------------------------------------------------
// The searchable catalog, built once per catalog (not per keystroke).

type MovementEntry = {
  kind: "movement";
  movement: Movement;
  nameWords: string[];
  aliasWords: string[];
  name: string;
  aliases: Set<string>;
  /** Normalized version alias → that version, for an exact alias hit. */
  versionAliases: Map<string, MovementVersion>;
  firstPrimary: MuscleId;
  primary: Set<MuscleId>;
  secondary: Set<MuscleId>;
  /** Pattern words, category, push/pull and region: the 4-point matches. */
  other: Set<string>;
  regions: Set<Region>;
  staple: boolean;
};

type CustomEntry = { kind: "custom"; exercise: Exercise; nameWords: string[]; name: string };

export type SearchCatalog = { movements: MovementEntry[]; custom: CustomEntry[]; vocabulary: Vocabulary };

const UPPER_GROUPS: ReadonlySet<MuscleGroupId> = new Set(["chest", "back", "shoulders", "arms", "neck"]);

function movementEntry(movement: Movement): MovementEntry {
  // Version overrides count as primaries too ("upper chest" finds Bench Press
  // through its incline versions); the movement's own first one ranks.
  const primary = new Set<MuscleId>(movement.primaryMuscles);
  for (const version of movement.versions) for (const m of version.primaryMuscles ?? []) primary.add(m);
  const secondary = new Set(movement.secondaryMuscles.filter((m) => !primary.has(m)));

  const versionAliases = new Map<string, MovementVersion>();
  for (const version of movement.versions) for (const alias of version.aliases) versionAliases.set(normalized(alias), version);
  const allAliases = [...movement.aliases, ...movement.versions.flatMap((v) => v.aliases)];

  // Region from primary muscle groups, as in the prototype's `enrich()`:
  // upper only when every primary is upper body, lower only when every one is legs.
  const groups = new Set([...primary].map((m) => MUSCLES[m].group));
  const regions = new Set<Region>();
  if ([...groups].every((g) => UPPER_GROUPS.has(g))) regions.add("upper");
  if ([...groups].every((g) => g === "legs")) regions.add("lower");

  const other = new Set<string>([stem(movement.category)]);
  if (movement.pattern) for (const w of movement.pattern.split("_")) other.add(stem(w));

  return {
    kind: "movement",
    movement,
    nameWords: stemmed(movement.name),
    aliasWords: allAliases.flatMap(stemmed),
    name: normalized(movement.name),
    aliases: new Set(movement.aliases.map(normalized)),
    versionAliases,
    firstPrimary: movement.primaryMuscles[0],
    primary,
    secondary,
    other,
    regions,
    staple: isStaple(movement),
  };
}

/**
 * "Staple": a +3 tie-break for the lifts most people mean. A PROXY until the
 * app records which versions people pick (TICKET-042: "replace it with real
 * pick counts"): a movement with more than one version, because the catalog
 * gives variants to what is commonly done (Bench Press 26, Lateral Raise 10)
 * and not to niche moves. Derived, never stored (user, 2026-10-27).
 * Measured on the 91 cases: dropping the rule fails 9, this proxy fails 2,
 * the research's hand-picked list of 96 fails 1.
 */
export function isStaple(movement: Movement): boolean {
  return movement.versions.length > 1;
}

/**
 * Custom exercises from the user's plans, one per id (TICKET-043: searched by
 * name only). Catalog exercises are skipped: search already finds their movement.
 */
export function customExercisesFromPlans(plans: ReadonlyArray<{ exercises: Exercise[] }>): Exercise[] {
  const byId = new Map<string, Exercise>();
  for (const plan of plans) {
    for (const exercise of plan.exercises) {
      if (!exercise.nameSnapshot?.trim() && exercise.name?.trim() && !byId.has(exercise.id)) byId.set(exercise.id, exercise);
    }
  }
  return [...byId.values()];
}

/**
 * Build once per catalog (and per search-words or plans change), never per
 * keystroke. `searchWords` null (not uploaded yet, or refused): the derived
 * labels still work; slang ("pecs", "db") finds nothing until it loads.
 */
export function buildSearchCatalog(
  movements: readonly Movement[],
  searchWords: SearchWords | null,
  custom: readonly Exercise[] = []
): SearchCatalog {
  return {
    vocabulary: buildVocabulary(searchWords),
    movements: movements.map(movementEntry),
    custom: custom.map((exercise) => ({
      kind: "custom",
      exercise,
      nameWords: stemmed(exercise.name),
      name: normalized(exercise.name),
    })),
  };
}

// ---------------------------------------------------------------------------
// Scoring

/** What the query names on the version axes; absent = not named. */
export type VersionPick = {
  equipment?: EquipmentId;
  angle?: AngleId;
  attachment?: AttachmentId;
  grip?: GripId;
  unilateral?: true;
};

export type SearchResult =
  | { kind: "movement"; movement: Movement; score: number; preselect: VersionPick }
  | { kind: "custom"; exercise: Exercise; score: number };

export type SearchResults = { results: SearchResult[]; total: number };

const SCORE = {
  firstPrimary: 10,
  otherPrimary: 8,
  secondary: 1,
  name: 10,
  alias: 8,
  /** Equipment, axis, pattern, category, region. */
  other: 4,
  exactName: 30,
  /** Below an exact name: an alias can be shared by several movements. */
  exactAlias: 25,
  staple: 3,
} as const;

/**
 * Ties: strength before stretching. Someone typing "chest" in a gym logger
 * wants presses before a doorway stretch (prototype).
 */
const CATEGORY_RANK: Record<CategoryId, number> = Object.fromEntries(
  (
    ["strength", "powerlifting", "calisthenics", "olympic", "strongman", "conditioning", "plyometric", "cardio", "rehab", "mobility", "stretching"] as CategoryId[]
  ).map((c, i) => [c, i])
) as Record<CategoryId, number>;

/** Word-PREFIX, not substring: substring made "rdl" match HuRDLe Hop. Prefixes keep "bulg" working. */
const prefixOf = (word: string, list: readonly string[]): boolean => list.some((w) => w.startsWith(word));
const allPrefix = (term: Term, list: readonly string[]): boolean => term.words.every((w) => prefixOf(w, list));

const hasEquipment = (m: Movement, ids: readonly EquipmentId[]) => m.versions.some((v) => ids.includes(v.equipment));
const hasAxis = (m: Movement, a: AxisValue) =>
  m.versions.some((v) => (a.axis === "unilateral" ? v.unilateral : v[a.axis] === a.value));

/**
 * One term against one movement; null = no match (the movement is out).
 *
 * MUSCLE WORDS SCORE FROM MUSCLE DATA ONLY, NEVER THE NAME: otherwise "chest"
 * ranks Chest-Supported Row as a chest exercise, and "back" finds Low-Bar Back
 * Squat (decided: it does not, user 2026-10-27).
 *
 * EQUIPMENT AND AXIS WORDS SCORE FROM VERSION DATA (4), like muscle words
 * from muscle data. Only a word no version has falls back to the name ("reverse"
 * in Reverse Lunge, which has no reverse grip). Rejected: name first (10).
 * "cable back" then ranked Cable Lat Prayer and Cable Shrug-In above Seated
 * Row, whose cable is in its versions, not its name: the same fact worth 10 or
 * 4 by how the movement happens to be named. Aliases are not read for these
 * words either, for the same reason: version aliases spell equipment unevenly.
 */
function scoreTerm(entry: MovementEntry, term: Term): number | null {
  const m = entry.movement;
  if (term.muscle) {
    const { exact, broad } = term.muscle;
    if (exact.includes(entry.firstPrimary)) return SCORE.firstPrimary;
    if ([...entry.primary].some((x) => exact.includes(x) || broad.includes(x))) return SCORE.otherPrimary;
    if ([...entry.secondary].some((x) => exact.includes(x) || broad.includes(x))) return SCORE.secondary;
    return null;
  }
  if (term.equipment || term.axis) {
    const has = term.equipment ? hasEquipment(m, term.equipment) : hasAxis(m, term.axis!);
    if (has) return SCORE.other;
    return allPrefix(term, entry.nameWords) ? SCORE.name : null;
  }
  if (allPrefix(term, entry.nameWords)) return SCORE.name;
  if (term.region) return entry.regions.has(term.region) ? SCORE.other : null;
  if (allPrefix(term, entry.aliasWords)) return SCORE.alias;
  if (term.words.length === 1 && entry.other.has(term.words[0])) return SCORE.other;
  return null;
}

/**
 * The version axes the query names, for the sheet to preselect (TICKET-043,
 * user 2026-10-27: any axis, not only equipment, when that combination exists).
 * - an exact version alias ("hex bar deadlift", "12-3-30") picks that version
 * - otherwise each named value the movement has; a value it has no version for
 *   is dropped (in "reverse lunge", "reverse" is a name word, not a grip)
 * - an equipment word naming several of the movement's equipment ("machine":
 *   machine and plate-loaded) picks none of them
 * - if no version has every remaining value together, nothing is preselected:
 *   a combination that does not exist is never offered
 */
function preselectFor(entry: MovementEntry, terms: readonly Term[], exactVersion?: MovementVersion): VersionPick {
  if (exactVersion) return pickOf(exactVersion);
  const m = entry.movement;
  const pick: VersionPick = {};
  for (const term of terms) {
    if (term.equipment) {
      const present = term.equipment.filter((e) => hasEquipment(m, [e]));
      if (present.length === 1) pick.equipment = present[0];
    } else if (term.axis && hasAxis(m, term.axis)) {
      const a = term.axis;
      if (a.axis === "unilateral") pick.unilateral = true;
      else if (a.axis === "angle") pick.angle = a.value;
      else if (a.axis === "attachment") pick.attachment = a.value;
      else pick.grip = a.value;
    }
  }
  return m.versions.some((v) => versionHas(v, pick)) ? pick : {};
}

function pickOf(v: MovementVersion): VersionPick {
  const pick: VersionPick = { equipment: v.equipment };
  if (v.angle) pick.angle = v.angle;
  if (v.attachment) pick.attachment = v.attachment;
  if (v.grip) pick.grip = v.grip;
  if (v.unilateral) pick.unilateral = true;
  return pick;
}

/** Does this version have every value the pick names? */
export function versionHas(v: MovementVersion, pick: VersionPick): boolean {
  return (
    (pick.equipment === undefined || v.equipment === pick.equipment) &&
    (pick.angle === undefined || v.angle === pick.angle) &&
    (pick.attachment === undefined || v.attachment === pick.attachment) &&
    (pick.grip === undefined || v.grip === pick.grip) &&
    (pick.unilateral === undefined || v.unilateral)
  );
}

type Scored = { result: SearchResult; category: number; isolation: number; name: string };

function scoreMovement(entry: MovementEntry, query: string, terms: readonly Term[]): Scored | null {
  const exactVersion = entry.versionAliases.get(query);
  const exact =
    query === entry.name ? SCORE.exactName : entry.aliases.has(query) || exactVersion ? SCORE.exactAlias : 0;

  let score = exact;
  let ok = true;
  for (const term of terms) {
    const s = scoreTerm(entry, term);
    if (s === null) {
      ok = false;
      break;
    }
    score += s;
  }
  // AN EXACT NAME OR ALIAS IS ALWAYS A RESULT. "grip" is a muscle word
  // (forearms), so "neutral grip fly" returned nothing until this rule.
  if (!ok && exact) {
    ok = true;
    score = exact;
  }
  if (!ok || score === 0) return null;
  if (entry.staple) score += SCORE.staple;

  return {
    result: { kind: "movement", movement: entry.movement, score, preselect: preselectFor(entry, terms, exactVersion) },
    category: CATEGORY_RANK[entry.movement.category],
    isolation: entry.movement.mechanic === "isolation" ? 1 : 0,
    name: entry.movement.name,
  };
}

/**
 * A custom exercise is searched by its name only (TICKET-043): it has no
 * muscles or equipment, so every typed word, muscle words included, must be
 * a prefix of a word of its name. It ranks among movements by that score;
 * no staple. Ties put it after the catalog (category rank past every category).
 */
function scoreCustom(entry: CustomEntry, query: string, terms: readonly Term[]): Scored | null {
  if (!terms.every((t) => allPrefix(t, entry.nameWords))) return null;
  const score = terms.length * SCORE.name + (query === entry.name ? SCORE.exactName : 0);
  return {
    result: { kind: "custom", exercise: entry.exercise, score },
    category: Object.keys(CATEGORY_RANK).length,
    isolation: 0,
    name: entry.exercise.name,
  };
}

/**
 * Search the catalog. Results are one row per movement, best first:
 * score, then category (strength first), then compound before isolation (a
 * search for a muscle wants the main lift before its accessories: "db
 * shoulders" lists Shoulder Press before Front Raise; added 2026-10-27), then
 * name A–Z. `total` counts every
 * match before the limit. An empty query returns nothing; the picker shows its
 * own list then (TICKET-043: every movement A–Z, until TICKET-050).
 *
 * Takes a `SearchCatalog` from `buildSearchCatalog`, built once per catalog,
 * not the raw movements: the word lists would otherwise be rebuilt on every
 * keystroke.
 */
export function searchExercises(catalog: SearchCatalog, query: string, limit: number): SearchResults {
  const terms = queryTerms(catalog.vocabulary, query);
  if (terms.length === 0) return { results: [], total: 0 };
  const q = normalized(query);

  const scored: Scored[] = [];
  for (const entry of catalog.movements) {
    const s = scoreMovement(entry, q, terms);
    if (s) scored.push(s);
  }
  for (const entry of catalog.custom) {
    const s = scoreCustom(entry, q, terms);
    if (s) scored.push(s);
  }
  scored.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      a.category - b.category ||
      a.isolation - b.isolation ||
      a.name.localeCompare(b.name)
  );
  return { results: scored.slice(0, limit).map((s) => s.result), total: scored.length };
}
