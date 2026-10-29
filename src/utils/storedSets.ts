// src/utils/storedSets.ts
//
// The stored set (TICKET-055): one record per set, `{ segments, effort }`. This
// file is the only code that writes it from the live sets or reads it raw from
// a doc, and it holds the one rule for which segment a comparison reads.
// Pure; tests in storedSets.test.ts.

import { Effort, StoredSet, StoredSetFields } from "../types/workoutSession";
import { ExerciseSet } from "../types/zustandWorkoutType";
import { isEffort } from "./effort";

/**
 * Anything with segments: a live `ExerciseSet`, a `DecodedSet`, a `HistorySet`.
 * `segmentsIncomplete` true: some segments could not be read.
 */
export type SegmentedSet = { segments: readonly StoredSetFields[]; segmentsIncomplete?: boolean };

/**
 * The set as planned, its first segment: what a set's row shows and what an
 * edit changes. Structure, not policy: what a comparison reads is
 * `comparisonSegment`, which may stop being this one.
 */
export const plannedSegment = <T>(set: { segments: readonly T[] }): T => set.segments[0];

/** The split rows after the planned segment. Empty for a normal set. */
export const splitSegments = <T>(set: { segments: readonly T[] }): T[] => set.segments.slice(1);

/**
 * The segment a comparison with another session reads: records
 * (`bestByReps`), deltas, ghost targets and repeat. Today the first segment,
 * the set as planned, for every exercise type (TICKET-033 Decisions).
 *
 * Rejected: any segment counting toward a record, which would make a tired
 * 3-rep split row the "best 3-rep set" for someone who never did one. Cost
 * accepted: in a split that goes up, the heavier later segment earns no
 * record; a treadmill split compares 10 min when 30 were done. Changing that
 * (summing time and distance for cardio, say) changes this function, not the
 * stored shape. Display and volume read `segments` directly.
 */
export const comparisonSegment = <T>(set: { segments: readonly T[] }): T => plannedSegment(set);

/** What each live set stores. A mark absent (logged before 034) is null, never undefined. */
export const toStoredSets = (sets: readonly ExerciseSet[]): StoredSet[] =>
  sets.map((set) => ({ segments: set.segments, effort: set.effort ?? null }));

export type DecodedSet = {
  /** Never empty. `[{}]` (no values) when the set could not be read at all. */
  segments: StoredSetFields[];
  /** True when any of the stored segments could not be read. */
  segmentsIncomplete: boolean;
  effort: Effort | null;
};

const isSegment = (value: unknown): value is StoredSetFields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * One stored set, read without trusting it.
 *
 * - `{ segments: [segment, …], effort }`: as written.
 * - A segment that is not a map: `segmentsIncomplete`, and `segments` keeps
 *   the readable ones before it. Volume then reads the set as unknown, never
 *   as a partial sum; a first segment that did read still compares.
 * - Not that shape at all, including a doc written before TICKET-055 (`sets[i]`
 *   a bare map of values): one empty segment, `segmentsIncomplete`. Its
 *   numbers read null, so it shows no value and compares with nothing.
 *   Rejected: reading the old shape as one segment. Its split rows and mark
 *   live in arrays this reader no longer pairs, so it would show a split set
 *   as a normal one; pre-launch, those docs are wiped instead.
 * - An unknown mark (a later version's third value, a typo in a hand-edited
 *   doc): null. The segments stand.
 */
export function decodeStoredSet(raw: unknown): DecodedSet {
  const stored = typeof raw === "object" && raw !== null ? (raw as { segments?: unknown; effort?: unknown }) : {};
  const effort = isEffort(stored.effort) ? stored.effort : null;
  const listed = Array.isArray(stored.segments) ? stored.segments : [];
  const readable = listed.findIndex((segment) => !isSegment(segment));
  const segments = (readable === -1 ? listed : listed.slice(0, readable)) as StoredSetFields[];
  if (segments.length === 0) return { segments: [{}], segmentsIncomplete: true, effort };
  return { segments, segmentsIncomplete: readable !== -1, effort };
}

/** A doc's `sets` through `decodeStoredSet`. Not an array: no sets. */
export const decodeStoredSets = (raw: unknown): DecodedSet[] =>
  Array.isArray(raw) ? raw.map(decodeStoredSet) : [];
