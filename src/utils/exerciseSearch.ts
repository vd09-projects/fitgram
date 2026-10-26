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
  /** Set when the typed word matched nothing and was corrected (stage 2): its edit distance. */
  typo?: number;
  /** A corrected plain word: the catalog words it may have meant, all at `typo` edits. */
  candidates?: string[];
  /** The corrected spelling, for the exact-name check ("bech press" = "bench press"). */
  corrected?: string[];
  /** Two typed words run together (split-word retry): must match inside ONE word. */
  split?: true;
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
// Typos (stage 2). Only for a word that matched NOTHING: not a vocabulary word
// and not a prefix of any word in the catalog. "row" and "curl" keep exactly
// their results (19 and 27, the stage 1 baselines) because only the CLOSEST
// candidates are kept: a word that matches something is 0 edits from itself,
// so it can only be "corrected" to itself. The `knownPrefixes` check skips the
// dictionary scan for those words; it is a shortcut, not what protects them
// (removing it changes no result; keeping every candidate within the limit
// breaks "curl" and 29 other cases). Rejected: Fuse.js, which scores whole
// strings and could not hold the thresholds below or keep fuzzy below prefix
// matches.

/**
 * Edits allowed for a typed word of this length (TICKET-043, user 2026-10-27):
 * - 1–3 letters: none. "row" must not start matching "rod" or "bow"
 * - 4–5 letters: 1 ("bech" → bench, "squad" → squat)
 * - 6 or more: 2 ("incliend" → incline, "dumbell" needs 1)
 */
export function maxTypoEdits(length: number): number {
  return length <= 3 ? 0 : length <= 5 ? 1 : 2;
}

/**
 * Damerau-Levenshtein distance, optimal string alignment variant: insert,
 * delete, substitute, or swap two adjacent letters ("bnech" → bench is 1).
 * Stops early once every alignment needs more than `limit` edits and returns
 * `limit + 1`: it runs over the whole dictionary on a typo, on every keystroke.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > limit) return limit + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

/**
 * The catalog words a missed word may mean: those at the smallest distance
 * within its limit. Compared with the whole word and with the word's start of
 * the same length, so a typo while still typing counts ("dumbe" → dumbbell).
 */
function typoCandidates(dictionary: readonly string[], word: string): { words: string[]; distance: number } | null {
  const limit = maxTypoEdits(word.length);
  if (limit === 0) return null;
  let best = limit + 1;
  let words: string[] = [];
  for (const candidate of dictionary) {
    let distance = Math.abs(candidate.length - word.length) <= limit ? editDistance(word, candidate, limit) : Infinity;
    if (candidate.length > word.length)
      distance = Math.min(distance, editDistance(word, candidate.slice(0, word.length), limit));
    if (distance < best) {
      best = distance;
      words = [candidate];
    } else if (distance === best) words.push(candidate);
  }
  return best <= limit ? { words, distance: best } : null;
}

/**
 * Correct each plain word that matched nothing. When its only candidate is a
 * vocabulary word, it becomes that word ("dumbell" → equipment dumbbell, which
 * then preselects; "incliend" → the incline angle). Otherwise it matches any
 * of its candidates in names and aliases: "squad" is 1 edit from both "squat"
 * and "quad", and turning it into the quads muscle would hide Squat.
 */
function correctTypos(catalog: SearchCatalog, terms: readonly Term[]): Term[] {
  const { vocabulary, knownPrefixes, dictionary } = catalog;
  return terms.map((term) => {
    const plain = !term.muscle && !term.equipment && !term.axis && !term.region && term.words.length === 1;
    const word = term.words[0];
    if (!plain || knownPrefixes.has(word)) return term;
    const found = typoCandidates(dictionary, word);
    if (!found) return term;
    if (found.words.length === 1 && isPhrase(vocabulary, found.words[0]))
      return { ...termFor(vocabulary, found.words[0]), typo: found.distance, corrected: found.words };
    return { words: [word], candidates: found.words, typo: found.distance, corrected: found.words };
  });
}

// ---------------------------------------------------------------------------
// The searchable catalog, built once per catalog (not per keystroke).

type MovementEntry = {
  kind: "movement";
  movement: Movement;
  nameWords: string[];
  aliasWords: string[];
  /** Each alias (movement and version) as its own word list, for joined words and corrected exact matches. */
  aliasLists: Array<{ words: string[]; version?: MovementVersion }>;
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

export type SearchCatalog = {
  movements: MovementEntry[];
  custom: CustomEntry[];
  vocabulary: Vocabulary;
  /** Every prefix of every searchable word: a typed word in here matched something and is never corrected. */
  knownPrefixes: Set<string>;
  /** Every searchable word once, what typos are corrected to. */
  dictionary: string[];
};

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
  const aliasLists = [
    ...movement.aliases.map((alias) => ({ words: stemmed(alias) })),
    ...movement.versions.flatMap((version) => version.aliases.map((alias) => ({ words: stemmed(alias), version }))),
  ];

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
    aliasLists,
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
  const vocabulary = buildVocabulary(searchWords);
  const entries = movements.map(movementEntry);
  const customEntries: CustomEntry[] = custom.map((exercise) => ({
    kind: "custom",
    exercise,
    nameWords: stemmed(exercise.name),
    name: normalized(exercise.name),
  }));

  const words = new Set<string>();
  for (const e of entries) for (const w of [...e.nameWords, ...e.aliasWords, ...e.other]) words.add(w);
  for (const e of customEntries) for (const w of e.nameWords) words.add(w);
  for (const map of [vocabulary.muscles, vocabulary.equipment, vocabulary.axes, vocabulary.regions, vocabulary.synonyms] as Map<string, unknown>[])
    for (const key of map.keys()) for (const w of key.split(" ")) words.add(w);
  const knownPrefixes = new Set<string>();
  for (const w of words) for (let i = 1; i <= w.length; i++) knownPrefixes.add(w.slice(0, i));

  return { vocabulary, movements: entries, custom: customEntries, knownPrefixes, dictionary: [...words] };
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

/**
 * `fuzzy`: found only through a corrected typo. Fuzzy results always sort after
 * every other result; the picker heads the list "Close matches" when all are
 * fuzzy (board A4).
 */
export type SearchResult =
  | { kind: "movement"; movement: Movement; score: number; preselect: VersionPick; fuzzy: boolean }
  | { kind: "custom"; exercise: Exercise; score: number; fuzzy: boolean };

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
  /** Words typed in the name's own order: "low to high fly" → Low-to-High, not High-to-Low. */
  order: 2,
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

/**
 * Where a typed word matches in a word list: a prefix of one word, or JOINED
 * words, a prefix of several words run together from a word boundary
 * ("latpulldown" → Lat Pulldown). Boundaries still hold, so "rdl" never
 * matches inside HuRDLe. -1 = no match.
 */
function wordAt(word: string, list: readonly string[], joined = true): number {
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith(word)) return i;
    if (!joined) continue;
    if (word.length > list[i].length && word.startsWith(list[i]) && list.slice(i).join("").startsWith(word)) return i;
  }
  return -1;
}

/** Index of the term's first word in the list, or -1 unless every word matches. */
function termAt(term: Term, list: readonly string[]): number {
  const at = term.words.map((w) => wordAt(w, list, !term.split));
  return at.every((i) => i >= 0) ? at[0] : -1;
}

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
type Match = { score: number; typo: number; nameAt?: number };
const hit = (score: number, typo = 0, nameAt?: number): Match => ({ score: score - typo, typo, nameAt });

function scoreTerm(entry: MovementEntry, term: Term): Match | null {
  const m = entry.movement;
  const typo = term.typo ?? 0;
  if (term.muscle) {
    const { exact, broad } = term.muscle;
    if (exact.includes(entry.firstPrimary)) return hit(SCORE.firstPrimary, typo);
    if ([...entry.primary].some((x) => exact.includes(x) || broad.includes(x))) return hit(SCORE.otherPrimary, typo);
    if ([...entry.secondary].some((x) => exact.includes(x) || broad.includes(x))) return hit(SCORE.secondary, typo);
    return null;
  }
  if (term.equipment || term.axis) {
    const has = term.equipment ? hasEquipment(m, term.equipment) : hasAxis(m, term.axis!);
    if (has) return hit(SCORE.other, typo);
    const at = termAt(term, entry.nameWords);
    return at >= 0 ? hit(SCORE.name, typo, at) : null;
  }
  const at = termAt(term, entry.nameWords);
  if (at >= 0) return hit(SCORE.name, 0, at);
  if (term.region) return entry.regions.has(term.region) ? hit(SCORE.other) : null;
  if (term.split ? allPrefix(term, entry.aliasWords) : entry.aliasLists.some((a) => termAt(term, a.words) >= 0) || allPrefix(term, entry.aliasWords))
    return hit(SCORE.alias);
  if (term.words.length === 1 && entry.other.has(term.words[0])) return hit(SCORE.other);
  // A corrected word, last: it matches whole catalog words only.
  for (const c of term.candidates ?? []) {
    const i = entry.nameWords.indexOf(c);
    if (i >= 0) return hit(SCORE.name, typo, i);
  }
  for (const c of term.candidates ?? []) if (entry.aliasWords.includes(c)) return hit(SCORE.alias, typo);
  for (const c of term.candidates ?? []) if (entry.other.has(c)) return hit(SCORE.other, typo);
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

type TermsMatch = { score: number; fuzzy: boolean; nameAts: number[] };

function matchTerms(entry: MovementEntry, terms: readonly Term[]): TermsMatch | null {
  let score = 0;
  let fuzzy = false;
  const nameAts: number[] = [];
  for (const term of terms) {
    const match = scoreTerm(entry, term);
    if (!match) return null;
    score += match.score;
    fuzzy ||= match.typo > 0;
    if (match.nameAt !== undefined) nameAts.push(match.nameAt);
  }
  return { score, fuzzy, nameAts };
}

/**
 * SPLIT words: when the words fail one by one, try each adjacent pair run
 * together ("push down" → Pushdown, "kick back" → Kickback). Only on failure,
 * so a query that already matches keeps its meaning ("pull down" is "pull" +
 * "down"). The pair becomes a plain word, matched by name and alias.
 */
function matchWithSplitWords(entry: MovementEntry, terms: readonly Term[]): TermsMatch | null {
  const direct = matchTerms(entry, terms);
  if (direct) return direct;
  for (let i = 0; i + 1 < terms.length; i++) {
    // Inside one word only: across words it would be the two words again, and
    // "machine squat" would find Squat through its alias "smith machine squat".
    const joined: Term = { words: [terms[i].words.join("") + terms[i + 1].words.join("")], split: true };
    const match = matchTerms(entry, [...terms.slice(0, i), joined, ...terms.slice(i + 2)]);
    if (match) return match;
  }
  return null;
}

/**
 * The query, corrected, equals this word list exactly: each position is the
 * word typed, or for a corrected word one of its corrections. Lets "bech
 * press" count as the exact name Bench Press, and "squad" as Squat.
 */
function exactCorrected(terms: readonly Term[], words: readonly string[]): boolean {
  const positions = terms.flatMap((t) => (t.corrected && t.candidates ? [t.corrected] : (t.corrected ?? t.words).map((w) => [w])));
  return positions.length === words.length && positions.every((options, i) => options.includes(words[i]));
}

function scoreMovement(entry: MovementEntry, query: string, terms: readonly Term[]): Scored | null {
  const corrected = terms.some((t) => t.typo);
  let exactVersion = entry.versionAliases.get(query);
  let exact =
    query === entry.name ? SCORE.exactName : entry.aliases.has(query) || exactVersion ? SCORE.exactAlias : 0;
  if (!exact && corrected) {
    const alias = entry.aliasLists.find((a) => exactCorrected(terms, a.words));
    exactVersion = alias?.version;
    exact = exactCorrected(terms, entry.nameWords) ? SCORE.exactName : alias ? SCORE.exactAlias : 0;
  }

  const match = matchWithSplitWords(entry, terms);
  // AN EXACT NAME OR ALIAS IS ALWAYS A RESULT. "grip" is a muscle word
  // (forearms), so "neutral grip fly" returned nothing until this rule.
  if (!match && !exact) return null;
  let score = exact + (match?.score ?? 0);
  if (score === 0) return null;
  // ORDER: name words typed in the name's own order. "low to high fly" scored
  // 40 for both Low-to-High and High-to-Low Cable Fly in the prototype.
  const at = match?.nameAts ?? [];
  if (at.length >= 2 && at.every((i, k) => k === 0 || i > at[k - 1])) score += SCORE.order;
  if (entry.staple) score += SCORE.staple;
  const fuzzy = corrected && (match ? match.fuzzy || exact > 0 : true);

  return {
    result: {
      kind: "movement",
      movement: entry.movement,
      score,
      preselect: preselectFor(entry, terms, exactVersion),
      fuzzy,
    },
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
  let fuzzy = false;
  for (const t of terms) {
    if (termAt(t, entry.nameWords) >= 0) continue;
    if (!t.candidates?.some((c) => entry.nameWords.includes(c))) return null;
    fuzzy = true;
  }
  const exact = query === entry.name || (terms.some((t) => t.typo) && exactCorrected(terms, entry.nameWords));
  const score = terms.length * SCORE.name + (exact ? SCORE.exactName : 0);
  return {
    result: { kind: "custom", exercise: entry.exercise, score, fuzzy: fuzzy || (exact && query !== entry.name) },
    category: Object.keys(CATEGORY_RANK).length,
    isolation: 0,
    name: entry.exercise.name,
  };
}

/**
 * Search the catalog. Results are one row per movement, best first: every
 * exact or prefix match before any fuzzy one (stage 2), then score, then category (strength first), then compound before isolation (a
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
  const terms = correctTypos(catalog, queryTerms(catalog.vocabulary, query));
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
      Number(a.result.fuzzy) - Number(b.result.fuzzy) ||
      b.result.score - a.result.score ||
      a.category - b.category ||
      a.isolation - b.isolation ||
      a.name.localeCompare(b.name)
  );
  return { results: scored.slice(0, limit).map((s) => s.result), total: scored.length };
}
