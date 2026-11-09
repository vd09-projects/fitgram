// src/utils/syncCore.ts
//
// The shared sync core's pure half (TICKET-075, TICKET-072 D9): what every
// "held on the phone, checked against the server" store decides the same way.
// Server stamps, where a change check starts, how `lastSeen` moves, the skip
// window, when a full reload is due, and the stored copy's envelope. The I/O
// half is `stores/syncRunner.ts`.
//
// Users: the plans (`planSync.ts`, TICKET-070), the recent workouts
// (TICKET-075), the exercise summaries (TICKET-076). What differs per store
// stays with it: how an answer merges (plans by `rev`, workouts by `startedAt`,
// summaries by stamp), and what the stored body holds.

/**
 * A Firestore server timestamp as the phone holds it: plain numbers, so it
 * survives JSON at full precision (a Timestamp instance would not), and
 * never milliseconds, which would drop the nanoseconds a `>` query needs.
 */
export type SyncStamp = { seconds: number; nanoseconds: number };

export const isStamp = (value: unknown): value is SyncStamp => {
  if (typeof value !== "object" || value === null) return false;
  const { seconds, nanoseconds } = value as Partial<SyncStamp>;
  return Number.isInteger(seconds) && Number.isInteger(nanoseconds);
};

/**
 * A doc's `updatedAt` as read from Firestore, or undefined for "no stamp".
 * A Firestore Timestamp has `seconds` and `nanoseconds`; anything else (a doc
 * written before its store stamped, or a console edit that left a string) is
 * no stamp, never a made-up one: such a doc is seen only by full reads.
 */
export function toStamp(value: unknown): SyncStamp | undefined {
  return isStamp(value) ? { seconds: value.seconds, nanoseconds: value.nanoseconds } : undefined;
}

/**
 * Orders two stamps. No stamp is older than any stamp: an unstamped doc was
 * written before its store stamped, or put in by this phone before its
 * stamp was known, so any stamped copy of it is the newer one.
 */
export function compareStamps(a: SyncStamp | null | undefined, b: SyncStamp | null | undefined): number {
  if (!a || !b) return (a ? 1 : 0) - (b ? 1 : 0);
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

/**
 * Where a change check starts: `updatedAt > this`. With no `lastSeen` (no
 * stamped doc has come back yet) it is the Unix epoch, chosen and named, not
 * a 0 that slipped in (CLAUDE.md 2.4): every server stamp is after it, so the
 * check returns every stamped doc. Rejected: a full read instead, which costs
 * one read per doc on every check until the first stamped write.
 */
export const NO_STAMP_SEEN: SyncStamp = { seconds: 0, nanoseconds: 0 };
export const changeCheckAfter = (lastSeen: SyncStamp | null): SyncStamp => lastSeen ?? NO_STAMP_SEEN;

/**
 * `lastSeen` after a change check: the newest stamp held before or returned
 * now, every returned doc counted (a plans `deleted` marker too: leaving it
 * out would return it on every check). Never moves back, and never past what
 * the server sent. A full reload decides its own (`lastSeenAfterFullReload`
 * in planSync.ts; the workouts store takes its baseline read).
 */
export function lastSeenAfter<T extends { updatedAt?: SyncStamp }>(lastSeen: SyncStamp | null, incoming: readonly T[]): SyncStamp | null {
  return incoming.reduce<SyncStamp | null>(
    (newest, doc) => (doc.updatedAt && compareStamps(doc.updatedAt, newest) > 0 ? doc.updatedAt : newest),
    lastSeen
  );
}

/**
 * Is the next check a full reload? Asked for (Try again, the debug page),
 * or nothing stored (the first load, or a stored copy discarded:
 * "nothing stored", not "app launch", or every cold start would read
 * everything).
 *
 * Never on a timer (TICKET-076): every app write is stamped, so a change check
 * finds it. All a timer caught was wipe scripts and hand edits, at up to
 * `WORKOUTS_PER_PLAN` reads per plan (workouts) or one per plan (plans) per
 * reload. `lastFullAt` stays in the stored copies for the debug page only.
 * After a wipe or a console edit, sign out and in, or use the debug page's
 * full reload.
 */
export function fullReloadDue(input: { requested: boolean; hasStored: boolean }): boolean {
  return input.requested || !input.hasStored;
}

/**
 * Whether a trigger skips its check: one succeeded less than `skipMs` ago.
 * Only a success counts (TICKET-070 D11): after a failure the next screen
 * tries again. Try again and Reload pass `force`.
 */
export function withinSkipWindow(lastOkAt: number | null, now: number, skipMs: number, force = false): boolean {
  if (force || lastOkAt === null) return false;
  return now - lastOkAt < skipMs;
}

/**
 * The stored copy's envelope: whose data, in which format. The body's own
 * fields sit beside these two.
 */
export type StoredEnvelope = { formatVersion: number; uid: string };

/**
 * The stored body for `uid`, or null for "nothing stored" (TICKET-070 D11).
 * Absent, unreadable JSON, another format version or another user's copy:
 * all null, with the reason. The caller then checks the body's own shape and
 * refuses it whole on any doubt, never a partial copy. Another user's copy
 * can only be here if a sign-out clear was missed (the app was killed mid
 * sign-out); it is never shown.
 */
export function openEnvelope(
  raw: string | null,
  uid: string,
  formatVersion: number
): { body: Record<string, unknown> | null; error: string | null } {
  if (raw === null) return { body: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { body: null, error: `unreadable JSON (${String(error)})` };
  }
  const stored = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Partial<StoredEnvelope> &
    Record<string, unknown>;
  if (stored.formatVersion !== formatVersion)
    return { body: null, error: `format version ${String(stored.formatVersion)}, this build reads ${formatVersion}` };
  if (stored.uid !== uid) return { body: null, error: "stored for another user" };
  return { body: stored, error: null };
}
