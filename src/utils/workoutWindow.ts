// src/utils/workoutWindow.ts
//
// The workout window (TICKET-082): the newest whole months of workouts, kept on the
// phone until there are at least `WORKOUTS_ON_PHONE_MIN` of them. Pure: the store
// (`useRecentWorkoutsStore`) does the reads and the writes. What every synced
// store shares (stamps, skip window, envelope) is `syncCore.ts`.
//
// What the window promises, and what it does not:
// - A month is in the window whole or not at all: every workout the user started in
//   that local month is in `sessions`. That is what lets a month row say "complete".
// - `windowStart` is where the promise starts: the first instant of the oldest month
//   in the window. Every workout in it is at or after that. `null`: the whole
//   history is in the window, there is nothing older.
// - Counts over `sessions` are counts of the months on the phone, not of the user's
//   history (CLAUDE.md 2.4). The selectors say so in their return type.
//
// The floor, `lastByPlan`: the newest workout of every plan, a full doc, kept apart
// from the months. Why: the hub suggests the plan done longest ago, the plan card
// shows its date and minutes, and Start sorts by date. A plan idle for longer than the
// window has no workout in it, so without the floor it would have no date and drop out
// of the suggestions when it is most due. The floor is not part of any month: the
// month selectors and the counts read `sessions` only, and `windowStart` does not
// apply to it. An entry is a doc, `null` for "looked up, never done", and a missing key
// for "not looked up yet" (a reader says "last session unknown", never "never done").

import type { WorkoutPlan } from "../types/workoutType";
import type { WorkoutSessionDoc } from "../types/workoutSession";
import { compareStamps, isStamp, lastSeenAfter, openEnvelope, type SyncStamp } from "./syncCore";
import { chooseMonthsToKeep, localMonthKey, localMonthRange, localMonthStart, utcMonthKey } from "./monthWindow";
import { readLifts } from "./liftRecord";
import { WORKOUTS_FORMAT_VERSION, WORKOUTS_STORAGE_KEY, workoutsShardKey } from "../config/storageKeys";

// WORKOUTS_ON_PHONE_MIN: value and reason in src/config/sync.ts.
// WORKOUTS_FORMAT_VERSION: value and reason in src/config/storageKeys.ts.

export type WorkoutWindow = {
  /** Newest first (`compareSessions`). Never holds a `deleted` marker. */
  sessions: WorkoutSessionDoc[];
  /** First instant of the oldest local month in the window, ms; null: nothing older exists. */
  windowStart: number | null;
  /**
   * The floor: plan id to the plan's newest workout (a doc, possibly older than `windowStart`),
   * or null when the plan was looked up and never done. A key missing: not looked up yet.
   */
  lastByPlan: Record<string, WorkoutSessionDoc | null>;
};

const hasKey = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

const isDeletedMarker = (session: WorkoutSessionDoc) => session.deleted === true;

/**
 * Newest first: `startedAt` descending, then `sessionId` descending, the order
 * Firestore gives `orderBy("startedAt", "desc")` (ties by document id, and the
 * id is the session id). So the window and a fresh read of it agree on which
 * workouts are newest, even with two started the same millisecond.
 */
export function compareSessions(a: WorkoutSessionDoc, b: WorkoutSessionDoc): number {
  if (a.startedAt !== b.startedAt) return b.startedAt - a.startedAt;
  return a.sessionId < b.sessionId ? 1 : a.sessionId > b.sessionId ? -1 : 0;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** The fields readers and merges use. Anything else in the doc is carried, not checked. */
export const isSession = (value: unknown): value is WorkoutSessionDoc => {
  if (typeof value !== "object" || value === null) return false;
  const { sessionId, workoutId, startedAt, endedAt, exerciseIds, lifts, note, deleted, updatedAt } = value as Partial<WorkoutSessionDoc>;
  return (
    typeof sessionId === "string" &&
    typeof workoutId === "string" &&
    Number.isFinite(startedAt) &&
    Number.isFinite(endedAt) &&
    isStringArray(exerciseIds) &&
    readLifts(lifts) !== null &&
    (note === undefined || typeof note === "string") &&
    (deleted === undefined || deleted === true) &&
    (updatedAt === undefined || isStamp(updatedAt))
  );
};

// ---------------------------------------------------------------------------
// Building and changing the window.
// ---------------------------------------------------------------------------

/**
 * Where the first load's second query starts, or null when it needs none.
 *
 * The first load is two queries by `startedAt`: the newest `min` (`newest`),
 * then the rest of the oldest of those months, from the first instant of that
 * month, so the month is complete. Fewer than `min` came back: the server has
 * no more, the whole history is in the window, and there is no second query.
 *
 * The month is the phone's local one, the month rows' (`localMonthKey`), not
 * the UTC month the shards are named by: a workout at 23:30 on the last night
 * of a month must not be split from its own month row. Rejected: UTC months for
 * the window, which put its start up to a day away from where the rows draw it.
 */
export function secondQueryStart(newest: readonly WorkoutSessionDoc[], min: number): number | null {
  if (newest.length < min) return null;
  return localMonthStart(newest[newest.length - 1].startedAt);
}

/** The window a first load's two answers make: replaces whatever was there. */
export function windowFromFirstLoad(
  newest: readonly WorkoutSessionDoc[],
  rest: readonly WorkoutSessionDoc[],
  min: number
): WorkoutWindow {
  const windowStart = secondQueryStart(newest, min);
  const byId = new Map<string, WorkoutSessionDoc>();
  // A doc in both answers (the second query may start at the first's last doc) is one workout.
  for (const session of [...newest, ...rest]) if (!isDeletedMarker(session)) byId.set(session.sessionId, session);
  const sessions = [...byId.values()]
    .filter((session) => windowStart === null || session.startedAt >= windowStart)
    .sort(compareSessions);
  // Every plan with a workout in the window knows its newest already; the others are looked up
  // (`plansToLookUp`), one limit-1 query each.
  const lastByPlan: WorkoutWindow["lastByPlan"] = {};
  for (const session of sessions) lastByPlan[session.workoutId] ??= session;
  return { sessions, windowStart, lastByPlan };
}

/**
 * The window with every month it no longer needs removed. `sorted` is newest first.
 *
 * Definition of the window, pinned here once: the newest local months that
 * hold at least `min` workouts together (`chooseMonthsToKeep`), counted over
 * what is on the phone now. So when a Finish starts a new month and the newer
 * months already reach `min` without the oldest, the oldest month leaves, whole,
 * and the window starts at the next one. The same rule drops a month when the
 * newest month alone reaches `min`: the definition, applied to the data.
 *
 * A workout before `windowStart` is dropped: it belongs to a month this phone
 * does not keep whole (a late upload from the offline queue), and a part-month
 * would read as complete. Rejected: keeping it and moving `windowStart` back,
 * which would claim a month the phone has one workout of. (It may still become a
 * floor entry: see `addToWindow`.)
 *
 * A dropped month loses nothing the floor needs: the floor already holds each plan's
 * newest workout, whichever month it is in, so no doc has to be moved.
 */
function dropMonthsOutsideWindow(
  sorted: readonly WorkoutSessionDoc[],
  windowStart: number | null,
  min: number,
  lastByPlan: WorkoutWindow["lastByPlan"]
): WorkoutWindow {
  const sinceStart = windowStart === null ? [...sorted] : sorted.filter((s) => s.startedAt >= windowStart);
  const workoutsPerMonth = new Map<string, number>();
  for (const session of sinceStart) {
    const month = localMonthKey(session.startedAt);
    workoutsPerMonth.set(month, (workoutsPerMonth.get(month) ?? 0) + 1);
  }
  const { keptMonths, olderMonths } = chooseMonthsToKeep(workoutsPerMonth, min);
  if (olderMonths.length === 0) return { sessions: sinceStart, windowStart, lastByPlan };
  const keep = new Set(keptMonths);
  const kept = sinceStart.filter((session) => keep.has(localMonthKey(session.startedAt)));
  const oldestKeptMonthStart = localMonthStart(kept[kept.length - 1].startedAt);
  // Never earlier than before: a phone that changed time zone must not widen its claim.
  return {
    sessions: kept,
    windowStart: windowStart === null ? oldestKeptMonthStart : Math.max(windowStart, oldestKeptMonthStart),
    lastByPlan,
  };
}

/**
 * `incoming` workouts added to the window, then the months it no longer needs dropped.
 *
 * Deduplicated by `sessionId`, the copy with the newer stamp kept and the
 * incoming one on a tie: an unstamped copy (this phone's own Finish) loses to a
 * stamped one (`compareStamps`), so a Finish applied with no read is replaced
 * by the server's copy when a check brings it. Ordered by `startedAt`, never by
 * stamp: a late upload sits at its start time.
 *
 * A `deleted` marker removes the workout it is newer than, and is never kept
 * (TICKET-032's rule: the marker is how another phone learns of a delete). A
 * marker for a workout not on the phone changes nothing.
 */
export function addToWindow(current: WorkoutWindow, incoming: readonly WorkoutSessionDoc[], min: number): WorkoutWindow {
  const byId = new Map(current.sessions.map((session) => [session.sessionId, session]));
  const lastByPlan = { ...current.lastByPlan };
  for (const session of incoming) {
    const onPhone = byId.get(session.sessionId);
    if (onPhone && compareStamps(session.updatedAt, onPhone.updatedAt) < 0) continue;
    if (isDeletedMarker(session)) {
      byId.delete(session.sessionId);
      const floorDoc = lastByPlan[session.workoutId];
      if (floorDoc && floorDoc.sessionId === session.sessionId && compareStamps(session.updatedAt, floorDoc.updatedAt) >= 0) {
        // The plan's newest workout is gone. Every workout since `windowStart` is in the window and
        // anything the window left out is older than all of them, so the plan's newest remaining
        // workout in the window is its new newest, with no read. Only a workout since `windowStart`
        // counts: one in this same batch from before it (a late upload) is not the plan's newest,
        // a newer one may sit in a month the phone does not hold. A plan with none there is not
        // looked up, and the lookup finds its next newest (`getLastWorkoutOfPlan` skips markers).
        const next = [...byId.values()]
          .filter((s) => s.workoutId === session.workoutId && (current.windowStart === null || s.startedAt >= current.windowStart))
          .sort(compareSessions)[0];
        if (next) lastByPlan[session.workoutId] = next;
        else delete lastByPlan[session.workoutId];
      }
      continue;
    }
    byId.set(session.sessionId, session);
    const entry = withNewerOf(lastByPlan, session);
    if (entry !== undefined) lastByPlan[session.workoutId] = entry;
  }
  return dropMonthsOutsideWindow([...byId.values()].sort(compareSessions), current.windowStart, min, lastByPlan);
}

/**
 * What a plan's floor entry becomes when `session` arrives, other than a marker.
 * - Not looked up yet (key missing): stays so. One workout is not known to be the plan's
 *   newest, and claiming it would give the plan a wrong date (CLAUDE.md 2.4).
 * - Never done (null): the session is its first.
 * - A doc: the newer by `compareSessions`, so a late upload older than the entry is not the
 *   floor. The same workout again (a note added, a verdict settled) replaces itself by stamp.
 */
function withNewerOf(lastByPlan: WorkoutWindow["lastByPlan"], session: WorkoutSessionDoc): WorkoutSessionDoc | null | undefined {
  if (!hasKey(lastByPlan, session.workoutId)) return undefined;
  const entry = lastByPlan[session.workoutId];
  if (entry === null) return session;
  if (entry.sessionId === session.sessionId) return session;
  return compareSessions(session, entry) < 0 ? session : entry;
}

/**
 * Plan ids from `planIds` whose floor entry is not known yet: the plans the store looks up with
 * one limit-1 query each. A plan with a workout in the window is never here.
 */
export const plansToLookUp = (window: Pick<WorkoutWindow, "lastByPlan">, planIds: readonly string[]): string[] =>
  planIds.filter((planId) => !hasKey(window.lastByPlan, planId));

/**
 * The plan ids the floor covers: every plan the plans store holds that is not deleted, archived
 * ones included (Start lists them with their date). Null while the plans store holds nothing:
 * no lookup then, and `sessions` readers say "last session unknown". Freestyle is not here:
 * it matches no plan id in `buildPlanRows`, never becomes a tile, and no reader shows its date.
 * Rejected: skipping archived plans, which would leave their rows undated for one read each.
 */
export const lookUpPlanIds = (plans: readonly Pick<WorkoutPlan, "id" | "deleted">[] | null): string[] | null =>
  plans === null ? null : plans.filter((plan) => !plan.deleted).map((plan) => plan.id);

/**
 * Looked-up answers put into the floor: plan id to its newest workout, or null for never done.
 * Fills what is missing and never overwrites newer knowledge: a Finish that landed while the
 * query ran already holds a newer entry, and a null never replaces a doc. A deleted marker as
 * the answer leaves the plan not looked up: the lookup skips markers, so this does not arise from
 * it, and a marker here would only be asked again, never a date.
 */
export function withPlanLookups(window: WorkoutWindow, answers: Readonly<Record<string, WorkoutSessionDoc | null>>): WorkoutWindow {
  const lastByPlan = { ...window.lastByPlan };
  for (const [planId, doc] of Object.entries(answers)) {
    if (doc !== null && isDeletedMarker(doc)) continue;
    if (!hasKey(lastByPlan, planId)) lastByPlan[planId] = doc;
    else if (doc !== null) {
      const entry = lastByPlan[planId];
      if (entry === null || compareSessions(doc, entry) < 0) lastByPlan[planId] = doc;
    }
  }
  return { ...window, lastByPlan };
}

/**
 * What `buildPlanRows` and `buildRecentHistory` read: the window's workouts and the floor's,
 * newest first, one copy of each. Only these two old readers get the floor; the History
 * selectors read `window.sessions`, so a floor doc is never in a month or a count.
 */
export function sessionsWithLastOfEachPlan(window: WorkoutWindow): WorkoutSessionDoc[] {
  const inWindow = new Set(window.sessions.map((session) => session.sessionId));
  const floor = Object.values(window.lastByPlan).filter((doc): doc is WorkoutSessionDoc => doc !== null && !inWindow.has(doc.sessionId));
  return [...window.sessions, ...floor].sort(compareSessions);
}

/**
 * `lastSeen` after a check, by the plans' and the old per-plan rules (070's D3
 * and S1), unchanged by the window:
 * - change check: forward only, over every doc it returned, markers included
 *   (`lastSeenAfter`), or a marker would come back on every check.
 * - full reload: the baseline read's stamp, taken *before* the two queries.
 *   Two queries are not one snapshot, so a write landing between them could
 *   carry a stamp older than another answer's newest; anything written after
 *   the baseline has a later stamp, so the next change check returns it.
 */
export function lastSeenAfterCheck(
  kind: "full" | "change",
  lastSeen: SyncStamp | null,
  answer: { baseline: SyncStamp | null; changed: readonly WorkoutSessionDoc[] }
): SyncStamp | null {
  return kind === "full" ? answer.baseline : lastSeenAfter(lastSeen, answer.changed);
}

// ---------------------------------------------------------------------------
// Selectors for the History screens (083 to 086). All read the window only.
// ---------------------------------------------------------------------------

/**
 * Is every workout of this local month already on the phone? True from the window's start on, and
 * for every month when the whole history is in the window. False for a month before it: that is
 * the one `getWorkoutsOfMonth` fetches. A month with no workouts after the start is still "on the
 * phone" (it is complete, and empty).
 */
export const isMonthOnPhone = (window: Pick<WorkoutWindow, "windowStart">, month: string): boolean =>
  window.windowStart === null || localMonthRange(month).from >= window.windowStart;

export type MonthGroup = { month: string; sessions: WorkoutSessionDoc[] };

/** Workouts grouped by local month, newest month first, each newest first. */
export function sessionsByMonth(sessions: readonly WorkoutSessionDoc[]): MonthGroup[] {
  const groups = new Map<string, WorkoutSessionDoc[]>();
  for (const session of [...sessions].sort(compareSessions)) {
    const month = localMonthKey(session.startedAt);
    groups.set(month, [...(groups.get(month) ?? []), session]);
  }
  return [...groups].map(([month, list]) => ({ month, sessions: list }));
}

/** One local month's workouts, newest first; empty for a month not on the phone (no claim either way). */
export const sessionsOfMonth = (sessions: readonly WorkoutSessionDoc[], month: string): WorkoutSessionDoc[] =>
  sessions.filter((session) => localMonthKey(session.startedAt) === month).sort(compareSessions);

/** The newest `n` workouts. */
export const newestSessions = (sessions: readonly WorkoutSessionDoc[], n: number): WorkoutSessionDoc[] =>
  [...sessions].sort(compareSessions).slice(0, n);

export type PlanFilterRow = {
  /** The filter's identity. Never the label: a rename must not split a filter. */
  planId: string;
  label: string;
  /** Workouts of this plan in the window. Not the plan's total. */
  workoutCount: number;
  /** Start time of the plan's newest workout in the window. */
  newestStartedAt: number;
};

/**
 * What a plan filter shows: one row per plan id, the plan done most recently first.
 *
 * Identity is the plan id (`workoutId`; Freestyle has its own constant). The
 * label is the plan's current name, else the newest `workoutName` snapshot of
 * that plan: a plan renamed, deleted or not yet loaded still has a name, and
 * two workouts of one plan saved under two names are still one row. Rejected:
 * keying by `workoutName`, which splits a filter at every rename.
 *
 * `coversWholeHistory` is false when older months exist that are not on the
 * phone: then every `workoutCount` is "of the workouts on the phone" and a
 * screen must not word it as a total (TICKET-087, known gap 2).
 */
export function planFilterRows(
  window: WorkoutWindow,
  plans: readonly Pick<WorkoutPlan, "id" | "name" | "deleted">[]
): { coversWholeHistory: boolean; rows: PlanFilterRow[] } {
  const sessionsByPlan = new Map<string, WorkoutSessionDoc[]>();
  for (const session of [...window.sessions].sort(compareSessions)) {
    sessionsByPlan.set(session.workoutId, [...(sessionsByPlan.get(session.workoutId) ?? []), session]);
  }
  const currentName = new Map(plans.filter((p) => !p.deleted && p.name.trim()).map((p) => [p.id, p.name.trim()]));
  const rows = [...sessionsByPlan].map(([planId, newestFirst]) => ({
    planId,
    label: currentName.get(planId) ?? newestFirst[0].workoutName,
    workoutCount: newestFirst.length,
    newestStartedAt: newestFirst[0].startedAt,
  }));
  rows.sort((a, b) => b.newestStartedAt - a.newestStartedAt || (a.planId < b.planId ? -1 : 1));
  return { coversWholeHistory: window.windowStart === null, rows };
}

// ---------------------------------------------------------------------------
// The saved copy.
// ---------------------------------------------------------------------------

/** What the head key holds. The workouts are in `shards`, one key per UTC start month. */
export type StoredWorkoutsHead = {
  formatVersion: number;
  uid: string;
  /** UTC month keys of the shards written, newest first. Every one must be present on read. */
  shards: string[];
  windowStart: number | null;
  /** Absent in a copy written before the floor: read as `{}`, every plan then looked up at the next check. */
  lastByPlan?: WorkoutWindow["lastByPlan"];
  lastSeen: SyncStamp | null;
  lastFullAt: number | null;
};

/** The window with the check times saved beside it: everything the stored copy holds. */
export type SavedWorkouts = WorkoutWindow & { lastSeen: SyncStamp | null; lastFullAt: number | null };

const MONTH_KEY = /^\d{4}-\d{2}$/;

/**
 * The saved copy as key/value pairs for one `multiSet`, one transaction on
 * Android, so a kill cannot leave a head that names shards the disk does not
 * have. Shards by UTC start month (`utcMonthKey`); the oldest shard holds only
 * what is at or after `windowStart`, so it can be a part-month in UTC terms.
 * Nothing reads completeness from a shard: that is `windowStart`'s, in local months.
 */
export function serializeStoredWorkouts(uid: string, saved: SavedWorkouts): [string, string][] {
  const sessionsByShard = new Map<string, WorkoutSessionDoc[]>();
  for (const session of [...saved.sessions].sort(compareSessions)) {
    const shard = utcMonthKey(session.startedAt);
    sessionsByShard.set(shard, [...(sessionsByShard.get(shard) ?? []), session]);
  }
  const head: StoredWorkoutsHead = {
    formatVersion: WORKOUTS_FORMAT_VERSION,
    uid,
    shards: [...sessionsByShard.keys()],
    windowStart: saved.windowStart,
    lastByPlan: saved.lastByPlan,
    lastSeen: saved.lastSeen,
    lastFullAt: saved.lastFullAt,
  };
  return [
    [WORKOUTS_STORAGE_KEY, JSON.stringify(head)],
    ...[...sessionsByShard].map(([shard, docs]): [string, string] => [workoutsShardKey(shard), JSON.stringify(docs)]),
  ];
}

const parseShard = (raw: string | null | undefined): WorkoutSessionDoc[] | null => {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isSession) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * The saved copy for `uid`, or `saved: null` for "nothing saved", with the reason.
 * Refused whole on any doubt, never in part: a copy missing a shard would show
 * a month as complete with workouts gone, and `lastSeen` would stop the change
 * check from bringing them back. `rows` are the head key's value and the
 * shard keys the head names, read in a second step (`shardKeysNamedBy`).
 */
export function readStoredWorkouts(
  rows: readonly (readonly [string, string | null])[],
  uid: string
): { saved: SavedWorkouts | null; error: string | null } {
  const values = new Map(rows);
  const { body, error } = openEnvelope(values.get(WORKOUTS_STORAGE_KEY) ?? null, uid, WORKOUTS_FORMAT_VERSION);
  if (body === null) return { saved: null, error };
  const { shards, windowStart, lastByPlan = {}, lastSeen, lastFullAt } = body as Partial<StoredWorkoutsHead>;
  if (!Array.isArray(shards) || !shards.every((s) => typeof s === "string" && MONTH_KEY.test(s)))
    return { saved: null, error: "shard list in an unknown shape" };
  if (windowStart === undefined || (windowStart !== null && !Number.isFinite(windowStart)))
    return { saved: null, error: "window start in an unknown shape" };
  if (
    typeof lastByPlan !== "object" ||
    lastByPlan === null ||
    !Object.values(lastByPlan).every((doc) => doc === null || (isSession(doc) && !isDeletedMarker(doc)))
  )
    return { saved: null, error: "last workout of each plan in an unknown shape" };
  if (lastSeen === undefined || (lastSeen !== null && !isStamp(lastSeen)) || (lastFullAt !== null && typeof lastFullAt !== "number"))
    return { saved: null, error: "check times in an unknown shape" };
  const sessions: WorkoutSessionDoc[] = [];
  for (const shard of shards) {
    const docs = parseShard(values.get(workoutsShardKey(shard)));
    if (docs === null) return { saved: null, error: `shard ${shard} missing or in an unknown shape` };
    // A marker is never saved; one here is dropped, not shown.
    sessions.push(...docs.filter((doc) => !isDeletedMarker(doc)));
  }
  return { saved: { sessions: sessions.sort(compareSessions), windowStart, lastByPlan, lastSeen, lastFullAt: lastFullAt ?? null }, error: null };
}

/** The shard keys a head names, for the second read. Empty for a head that does not parse: the copy is refused after. */
export function shardKeysNamedBy(headRaw: string | null): string[] {
  if (headRaw === null) return [];
  try {
    const { shards } = JSON.parse(headRaw) as Partial<StoredWorkoutsHead>;
    return Array.isArray(shards) ? shards.filter((s): s is string => typeof s === "string" && MONTH_KEY.test(s)).map(workoutsShardKey) : [];
  } catch {
    return [];
  }
}
