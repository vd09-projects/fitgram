// src/utils/exerciseSummariesSync.ts
//
// The exercise summaries' own rules (TICKET-076): how an answer merges, how
// `lastSeen` moves, which check a trigger runs, what a reader is told about an
// exercise, and the stored copy. Pure: the store (`useExerciseHistoryStore`)
// does the reads and the writes. The rules every synced store shares are
// `syncCore.ts`.

import type { ExerciseHistoryEntry } from "../types/exerciseHistory";
import type { ExerciseStatsDoc } from "../types/workoutSession";
import type { SyncResult } from "../stores/syncRunner";
import { compareStamps, isStamp, lastSeenAfter, openEnvelope, type SyncStamp } from "./syncCore";
import {
  EXERCISE_SUMMARIES_FORMAT_VERSION,
  EXERCISE_SUMMARIES_STORAGE_KEY,
  exerciseSummariesShardKey,
} from "../config/storageKeys";

// EXERCISE_SUMMARIES_SHARDS: value and reason in src/config/sync.ts.
// EXERCISE_SUMMARIES_FORMAT_VERSION: value and reason in src/config/storageKeys.ts.

/** Exercise id → its summary. Holds every exercise done; no entry means no summary. */
export type SummariesById = Record<string, ExerciseStatsDoc>;

export type SummariesCheckKind = "full" | "change";

/**
 * Summaries after `incoming` arrives. A held summary is replaced by the copy
 * with the newer stamp, and by the incoming one on a tie: an unstamped copy
 * (written before 076) loses to a stamped one (`compareStamps`). Ordered by
 * stamp, not `lastPerformedAt`: a rebuild can rewrite a summary with no newer
 * session in it, and lower its bests.
 */
export function mergeSummaries(held: SummariesById, incoming: readonly ExerciseStatsDoc[]): SummariesById {
  const next = { ...held };
  for (const doc of incoming) {
    const current = next[doc.exerciseId];
    if (!current || compareStamps(doc.updatedAt, current.updatedAt) >= 0) next[doc.exerciseId] = doc;
  }
  return next;
}

/**
 * A Finish's summaries, as its transaction computed them, put into what is
 * held (TICKET-076): "last time" updates at once and offline, with no read.
 *
 * They replace what is held whatever its stamp: through `mergeSummaries` an
 * unstamped copy loses to the stamped one held, and the Finish would not show.
 * They go in unstamped, and `lastSeen` does not move, so the next check brings
 * the stamped copies back and they replace these (no stamp is older than any
 * stamp). That costs one read per exercise finished, on purpose. Rejected: a
 * read after Finish to learn the commit stamp, so `lastSeen` could move. It
 * saves one read per exercise finished, worth no money at this scale, and moving
 * `lastSeen` that way can skip another phone's Finish.
 */
export function withFinishedSummaries(held: SummariesById, finished: readonly ExerciseStatsDoc[]): SummariesById {
  return { ...held, ...Object.fromEntries(finished.map((doc) => [doc.exerciseId, doc])) };
}

/**
 * `lastSeen` after a check.
 * - change check: forward only, over every doc returned (`lastSeenAfter`).
 * - full load: the newest stamp in the answer, whatever was held, so it may
 *   move back (070 S1: a hand-set future stamp stops pinning it once that doc
 *   is fixed).
 *
 * No baseline read, unlike the workouts (`workoutsLastSeenAfter`): the whole
 * collection is one query, and one query sees every commit before it (070's
 * rule), so a write it missed has a later stamp than anything it returned, and
 * the next change check finds it. The workouts run one query per plan, where
 * that does not hold.
 */
export function summariesLastSeenAfter(
  kind: SummariesCheckKind,
  lastSeen: SyncStamp | null,
  docs: readonly ExerciseStatsDoc[]
): SyncStamp | null {
  return lastSeenAfter(kind === "full" ? null : lastSeen, docs);
}

/**
 * The run a trigger starts, or null to skip. A full load only when nothing is
 * held, or when asked for (the debug page).
 *
 * No timed full reload, as plans and workouts (TICKET-076 stage 2): every
 * write of a summary is stamped, so a change check finds it. All a timer would
 * catch is a deleted summary, and only the wipe scripts delete one; it would
 * read every summary each time, and that grows with exercises done. After a
 * wipe, sign out and in (the clear makes the next check a first load). The
 * first feature that can make a summary disappear writes a `deleted` marker
 * instead of deleting the doc (recorded on TICKET-032).
 */
export function summariesRunFor(
  state: { byId: SummariesById | null; lastSeen: SyncStamp | null },
  skipped: boolean,
  fullRequested: boolean
): { kind: SummariesCheckKind; seenAtStart: SyncStamp | null } | null {
  const seenAtStart = state.lastSeen;
  if (state.byId === null || fullRequested) return { kind: "full", seenAtStart };
  return skipped ? null : { kind: "change", seenAtStart };
}

/**
 * What a reader is told about one exercise, from what the store holds.
 *
 * "ready" with no stats is what the screens print as "First time", so it needs
 * a successful answer in this app run (`lastResult === "ok"`), not just a
 * loaded copy (CLAUDE.md 2.4). An exercise missing from a stored copy that the
 * check could not refresh is unknown: it may have been done on another phone
 * since, so it reads as failed. While a check runs after a success the last
 * answer stands, so the card does not flash "…" on every check.
 *
 * A held summary is always "ready": an old target does no harm, and `error`
 * says the copy could not be refreshed.
 */
export function summaryEntry(input: {
  exerciseId: string;
  stats: ExerciseStatsDoc | undefined;
  checking: boolean;
  waitOver: boolean;
  lastResult: SyncResult;
  lastError: string | null;
}): ExerciseHistoryEntry {
  const { exerciseId, stats, checking, waitOver, lastResult, lastError } = input;
  const failed = lastResult === "failed";
  if (stats) return { exerciseId, status: "ready", stats, error: failed ? lastError : null };
  if (lastResult === "ok") return { exerciseId, status: "ready", stats: null, error: null };
  if (checking && !waitOver) return { exerciseId, status: "loading", stats: null, error: null };
  if (failed || waitOver) return { exerciseId, status: "error", stats: null, error: lastError };
  return { exerciseId, status: "idle", stats: null, error: null };
}

// ---------------------------------------------------------------------------
// The stored copy.
// ---------------------------------------------------------------------------

/**
 * What the head key holds. The summaries are in `shards` other keys, split by
 * exercise id (`summaryShard`; why several keys is `EXERCISE_SUMMARIES_SHARDS`).
 */
export type StoredSummariesHead = {
  formatVersion: number;
  uid: string;
  shards: number;
  lastSeen: SyncStamp | null;
  lastFullAt: number | null;
};

export type HeldSummaries = { byId: SummariesById; lastSeen: SyncStamp | null; lastFullAt: number | null };

/** Which shard holds an exercise. A plain string hash: stable across runs, spread is all it needs. */
export function summaryShard(exerciseId: string, shards: number): number {
  let hash = 0;
  for (let i = 0; i < exerciseId.length; i += 1) hash = (hash * 31 + exerciseId.charCodeAt(i)) >>> 0;
  return hash % shards;
}

/** Every key of the stored copy, head first. */
export const storedSummariesKeys = (shards: number): string[] => [
  EXERCISE_SUMMARIES_STORAGE_KEY,
  ...Array.from({ length: shards }, (_, shard) => exerciseSummariesShardKey(shard)),
];

/**
 * The stored copy as key/value pairs for one `multiSet`, one transaction on
 * Android, so a kill cannot leave a head newer than its shards. Every shard is
 * written, empty ones too: a missing shard then means a broken copy, not an
 * empty one.
 */
export function serializeStoredSummaries(uid: string, shards: number, held: HeldSummaries): [string, string][] {
  const { byId, lastSeen, lastFullAt } = held;
  const split: ExerciseStatsDoc[][] = Array.from({ length: shards }, () => []);
  for (const doc of Object.values(byId)) split[summaryShard(doc.exerciseId, shards)].push(doc);
  const head: StoredSummariesHead = { formatVersion: EXERCISE_SUMMARIES_FORMAT_VERSION, uid, shards, lastSeen, lastFullAt };
  return [
    [EXERCISE_SUMMARIES_STORAGE_KEY, JSON.stringify(head)],
    ...split.map((docs, shard): [string, string] => [exerciseSummariesShardKey(shard), JSON.stringify(docs)]),
  ];
}

/** The fields readers and merges use. Anything else in the doc is carried, not checked. */
const isSummary = (value: unknown): value is ExerciseStatsDoc => {
  if (typeof value !== "object" || value === null) return false;
  const { exerciseId, lastPerformedAt, fields, recentSessions, bestByReps, volumeHistory, updatedAt } =
    value as Partial<ExerciseStatsDoc>;
  return (
    typeof exerciseId === "string" &&
    Number.isFinite(lastPerformedAt) &&
    Array.isArray(fields) &&
    Array.isArray(recentSessions) &&
    typeof bestByReps === "object" &&
    bestByReps !== null &&
    Array.isArray(volumeHistory) &&
    (updatedAt === undefined || isStamp(updatedAt))
  );
};

const parseShard = (raw: string | null | undefined): ExerciseStatsDoc[] | null => {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isSummary) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * The stored copy for `uid`, or null for "nothing stored", with the reason.
 * Refused whole on any doubt, never in part: a copy missing one shard would
 * show its exercises as never done, and `lastSeen` would stop the change check
 * from bringing them back. Another shard count is refused too, as an exercise
 * would be looked for in the wrong key; a refill costs one first load.
 */
export function readStoredSummaries(
  rows: readonly (readonly [string, string | null])[],
  uid: string,
  shards: number
): { held: HeldSummaries | null; error: string | null } {
  const values = new Map(rows);
  const { body, error } = openEnvelope(
    values.get(EXERCISE_SUMMARIES_STORAGE_KEY) ?? null,
    uid,
    EXERCISE_SUMMARIES_FORMAT_VERSION
  );
  if (body === null) return { held: null, error };
  const { shards: storedShards, lastSeen, lastFullAt } = body as Partial<StoredSummariesHead>;
  if (storedShards !== shards) return { held: null, error: `split in ${String(storedShards)} keys, this build uses ${shards}` };
  if (lastSeen === undefined || (lastSeen !== null && !isStamp(lastSeen)) || (lastFullAt !== null && typeof lastFullAt !== "number"))
    return { held: null, error: "check times in an unknown shape" };
  const byId: SummariesById = {};
  for (let shard = 0; shard < shards; shard += 1) {
    const docs = parseShard(values.get(exerciseSummariesShardKey(shard)));
    if (docs === null) return { held: null, error: `shard ${shard} missing or in an unknown shape` };
    for (const doc of docs) byId[doc.exerciseId] = doc;
  }
  return { held: { byId, lastSeen, lastFullAt: lastFullAt ?? null }, error: null };
}
