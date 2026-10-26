// src/utils/textSearch.ts
//
// Name matching with no knowledge of what is being searched (TICKET-043): word
// prefixes, plurals, typos, words typed joined or split, word order. Exercise
// search (exerciseSearch.ts) adds muscles, equipment and versions on top; a
// later search over plans, logs or custom exercises can use this directly.
//
// Everything works on words already passed through `stemmed`, on both sides.

// ---------------------------------------------------------------------------
// Words

/**
 * Crude plural fold, from the research prototype: deadlifts → deadlift, flies
 * → fly, pull-ups → up. 10 of the app's 42 old exercise names ("Deadlifts",
 * "Pull-Ups") found nothing before it. Apply it to both sides, vocabulary keys
 * included, so "calves" and "calf" reach the same entry.
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

export const stemmed = (text: string): string[] => words(text).map(stem);
export const normalized = (text: string): string => stemmed(text).join(" ");

// ---------------------------------------------------------------------------
// Matching a typed word against a word list

/** Word-PREFIX, not substring: substring made "rdl" match HuRDLe Hop. Prefixes keep "bulg" working. */
export const prefixOfAny = (word: string, list: readonly string[]): boolean => list.some((w) => w.startsWith(word));

/**
 * Where a typed word matches in a word list: a prefix of one word, or JOINED
 * words, a prefix of several words run together from a word boundary
 * ("latpulldown" → Lat Pulldown). Boundaries still hold, so "rdl" never
 * matches inside HuRDLe. `joined: false` allows one word only. -1 = no match.
 */
export function wordAt(word: string, list: readonly string[], joined = true): number {
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith(word)) return i;
    if (!joined) continue;
    if (word.length > list[i].length && word.startsWith(list[i]) && list.slice(i).join("").startsWith(word)) return i;
  }
  return -1;
}

/** Index of the first typed word in the list, or -1 unless every word matches. */
export function wordsAt(typed: readonly string[], list: readonly string[], joined = true): number {
  const at = typed.map((w) => wordAt(w, list, joined));
  return at.every((i) => i >= 0) ? at[0] : -1;
}

/**
 * SPLIT words: `match` the terms as typed; if that fails, retry with each
 * adjacent pair run together by `join` ("push down" → "pushdown"). Only on
 * failure, so a query that already matches keeps its meaning ("pull down" is
 * "pull" + "down"). What a joined pair may match is the caller's: exercise
 * search lets it match inside one word only.
 */
export function matchWithSplitWords<T, R>(
  terms: readonly T[],
  match: (terms: readonly T[]) => R | null,
  join: (a: T, b: T) => T
): R | null {
  const direct = match(terms);
  if (direct) return direct;
  for (let i = 0; i + 1 < terms.length; i++) {
    const result = match([...terms.slice(0, i), join(terms[i], terms[i + 1]), ...terms.slice(i + 2)]);
    if (result) return result;
  }
  return null;
}

/**
 * Typed words matched in the name's own order: the positions where they
 * matched, at least two, strictly increasing. "low to high fly" is in order
 * for Low-to-High Cable Fly and not for High-to-Low.
 */
export function inOrder(positions: readonly number[]): boolean {
  return positions.length >= 2 && positions.every((p, k) => k === 0 || p > positions[k - 1]);
}

/**
 * A query equals a word list exactly, where each position lists the words it
 * may be: the word typed, or a typo's corrections ("bech press" = Bench Press).
 */
export function equalsWithCorrections(positions: ReadonlyArray<readonly string[]>, list: readonly string[]): boolean {
  return positions.length === list.length && positions.every((options, i) => options.includes(list[i]));
}

/** Sort key: anything found through a corrected typo after everything that was not. */
export const fuzzyLast = (a: { fuzzy: boolean }, b: { fuzzy: boolean }): number => Number(a.fuzzy) - Number(b.fuzzy);

// ---------------------------------------------------------------------------
// Typos. Only for a word that matched NOTHING: not a prefix of any word the
// caller searches. Words that match keep exactly their results because only
// the CLOSEST candidates are kept: a word that matches something is 0 edits
// from itself, so it can only be "corrected" to itself. The prefix check skips
// the dictionary scan for those words; it is a shortcut, not what protects
// them (removing it changed no exercise result; keeping every candidate within
// the limit broke "curl" and 29 other cases). Rejected: Fuse.js, which scores
// whole strings and could not hold the thresholds below or keep fuzzy below
// prefix matches.

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

/** Every word a search knows, and every prefix of each: built once, not per keystroke. */
export type TextDictionary = { words: string[]; prefixes: Set<string> };

export function buildTextDictionary(all: Iterable<string>): TextDictionary {
  const unique = new Set(all);
  const prefixes = new Set<string>();
  for (const w of unique) for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));
  return { words: [...unique], prefixes };
}

/**
 * The words a typed word may have meant, or null: when it matches something
 * already (a known prefix), is too short to correct, or nothing is close
 * enough. Only the candidates at the smallest distance are returned. Each is
 * compared whole and by its start of the typed word's length, so a typo while
 * still typing counts ("dumbe" → dumbbell).
 */
export function correctWord(dictionary: TextDictionary, word: string): { candidates: string[]; distance: number } | null {
  if (dictionary.prefixes.has(word)) return null;
  const limit = maxTypoEdits(word.length);
  if (limit === 0) return null;
  let best = limit + 1;
  let candidates: string[] = [];
  for (const candidate of dictionary.words) {
    let distance = Math.abs(candidate.length - word.length) <= limit ? editDistance(word, candidate, limit) : Infinity;
    if (candidate.length > word.length)
      distance = Math.min(distance, editDistance(word, candidate.slice(0, word.length), limit));
    if (distance < best) {
      best = distance;
      candidates = [candidate];
    } else if (distance === best) candidates.push(candidate);
  }
  return best <= limit ? { candidates, distance: best } : null;
}
