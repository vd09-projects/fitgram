// src/scripts/searchBenchmark.ts
//
// What the exercise picker costs (TICKET-043), measured on the code the
// picker runs: opening (building the search index and the A–Z list) and
// searching (one search per keystroke, no debounce: the picker searches on
// every change of the text). Run by benchmarkSearch.ts in Node and, bundled,
// in the Hermes CLI.
//
// Pure: takes the clock as an argument, because the Hermes CLI has no
// `performance`, only `Date.now` (1 ms). So one timing is the mean of the
// operation repeated until at least WINDOW_MS has passed, the same way on
// both engines.
//
// Each figure is the fastest of ROUNDS such timings. Without that, identical
// runs differed up to 4.6× at p95 (Hermes typo p95 8.5–39 ms, 2026-10-27):
// GC pauses and other processes, not the search. So these figures are the
// cost of the work itself; a phone's GC pauses come on top and are not in
// them. Percentiles are across keystrokes (or open samples), each its fastest.

import { CATALOG } from "../catalog";
import { SEARCH_WORDS } from "../catalog/searchWords";
import { buildSearchCatalog, searchExercises } from "../utils/exerciseSearch";
import { PICKER_RESULT_LIMIT, preparePicker } from "../utils/pickerData";

const WINDOW_MS = 20;
const ROUNDS = 5;

/** Stage 1's normal queries, typed letter by letter. */
export const NORMAL_QUERIES = [
  "incline db bench press",
  "cable standing neutral grip fly",
  "chest",
  "lat pulldown",
  "bulgarian split squat",
  "abs",
  "back",
];
/** Stage 2's typo table (exerciseSearch.test.ts TYPO_CASES), typed letter by letter. */
export const TYPO_QUERIES = [
  "Latpulldown",
  "push down",
  "kick back",
  "Incliend",
  "squad",
  "bech press",
  "dumbell curl",
  "low to high fly",
];

export type Stats = { n: number; median: number; p90: number; p95: number; max: number };
export type BenchmarkResult = {
  /** Opening the picker: index + A–Z (what `preparePicker` builds), and the index alone. */
  open: { first: number; picker: Stats; index: Stats };
  /** One search per keystroke. */
  search: { normal: Stats; typo: Stats; all: Stats };
};

/** Fastest of ROUNDS timings of `run`. */
function timeOf(now: () => number, run: () => void): number {
  let best = Infinity;
  for (let r = 0; r < ROUNDS; r++) best = Math.min(best, meanOf(now, run));
  return best;
}

/** Mean ms of `run`, repeated until WINDOW_MS has passed. */
function meanOf(now: () => number, run: () => void): number {
  let reps = 0;
  const start = now();
  let elapsed = 0;
  do {
    run();
    reps++;
    elapsed = now() - start;
  } while (elapsed < WINDOW_MS);
  return elapsed / reps;
}

export function stats(samples: readonly number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  // Nearest rank: the value at or above q of the samples.
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { n: sorted.length, median: at(0.5), p90: at(0.9), p95: at(0.95), max: sorted[sorted.length - 1] };
}

/** Every prefix the picker searches while the query is typed (blank ones are not searched). */
export function keystrokes(queries: readonly string[]): string[] {
  return queries.flatMap((q) => [...q].map((_, i) => q.slice(0, i + 1))).filter((k) => k.trim());
}

export function runSearchBenchmark(now: () => number): BenchmarkResult {
  // A new custom list each time defeats preparePicker's cache: every call
  // builds, as the first open after a catalog or plan change does.
  const firstStart = now();
  preparePicker(CATALOG, SEARCH_WORDS, []);
  const first = now() - firstStart;
  const picker = stats(Array.from({ length: 7 }, () => timeOf(now, () => preparePicker(CATALOG, SEARCH_WORDS, []))));
  const index = stats(Array.from({ length: 7 }, () => timeOf(now, () => buildSearchCatalog(CATALOG, SEARCH_WORDS, []))));

  const catalog = buildSearchCatalog(CATALOG, SEARCH_WORDS, []);
  const search = (k: string) => searchExercises(catalog, k, PICKER_RESULT_LIMIT);
  const normalKeys = keystrokes(NORMAL_QUERIES);
  const typoKeys = keystrokes(TYPO_QUERIES);
  for (const k of [...normalKeys, ...typoKeys]) search(k); // warm-up
  const normal = normalKeys.map((k) => timeOf(now, () => search(k)));
  const typo = typoKeys.map((k) => timeOf(now, () => search(k)));

  return {
    open: { first, picker, index },
    search: { normal: stats(normal), typo: stats(typo), all: stats([...normal, ...typo]) },
  };
}
