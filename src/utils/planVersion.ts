// src/utils/planVersion.ts
//
// A plan's version (TICKET-073): the one place that reads, builds and
// compares `WorkoutPlan.version`. firestore.rules checks the same field; keep
// the two in step.
//
// WHY IT EXISTS. Two devices can edit one plan, and either may be offline.
// A Save must be refused if it was not made on the version the server holds,
// or it silently erases the other device's edit. Firestore cannot do this for
// us: its built-in compare-and-set (a transaction) needs the server at the
// moment of the write, so every offline Save would fail. So each plan carries
// a version, and the rule accepts a write only if it names the stored version
// as its base. This is optimistic concurrency, a compare-and-set we do by hand.
//
//   version: { rev: 4, id: "a1b2c3", base: "x9y8z7" }
//
// - `id`: this version's identity, fresh on every Save (`newVersionId`, made
//   on the device, so it works offline). The safety check.
// - `base`: the `id` of the version this Save was made on; null for a plan
//   saved before versions existed. The rule refuses a write whose `base` is
//   not the stored `id`. A second Save queued offline names the first as its
//   base, so if the server refuses the first, it refuses the second too
//   (PR #50 review, B1: with a counter alone, the second got through).
// - `rev`: a counter, + 1 per accepted Save (the rule enforces it). Not the
//   safety check: it orders two copies of a plan on the phone (D10,
//   `compareVersions`). `updatedAt` cannot: the server sets it, and the phone
//   does not learn it for its own Save until a later check returns it, so
//   until then the Save would be unordered against an older copy from a slow
//   check. `rev` is known the moment the phone writes it.
//
// `updatedAt` stays a separate field: it answers "what changed since I last
// looked" for the change query (TICKET-070), not "which version is this".
//
// IF THIS GOES. Moving to a database with built-in document versions (for
// example CouchDB's `_rev`, which is a counter and an id in one) replaces
// this file, the plans rule in firestore.rules and the `version` field; the
// callers only use the functions below.

import type { PlanVersion, WorkoutPlan } from "../types/workoutType";

/**
 * The version a draft or a Save is based on: its `rev` and `id`. A plan saved
 * before versions existed has none: rev 0, id null, as firestore.rules reads
 * a missing `version`. 0 is a real place in the order, the one before the
 * first Save, not a stand-in for "unknown" (CLAUDE.md 2.4).
 */
export type VersionBase = { rev: number; id: string | null };

export const NO_VERSION: VersionBase = { rev: 0, id: null };

/** A plan as a Save writes it: always with a version. */
export type VersionedPlan = WorkoutPlan & { version: PlanVersion };

export const versionOf = (plan: Pick<WorkoutPlan, "version">): VersionBase =>
  plan.version ? { rev: plan.version.rev, id: plan.version.id } : NO_VERSION;

export const versionRev = (plan: Pick<WorkoutPlan, "version">): number => versionOf(plan).rev;

/** The version a Save of a draft based on `base` writes, as the new version `id`. */
export const nextVersion = (base: VersionBase, id: string): PlanVersion => ({ rev: base.rev + 1, id, base: base.id });

/**
 * Which of two copies of a plan is newer (D10): > 0 when `a` is. The server
 * accepts each `rev` once per plan, so the higher one is the later Save,
 * stamped or not. 0: the same Save, or an edit made outside the app, which
 * keeps the version; the caller decides those (`replaces`, by `updatedAt`).
 */
export const compareVersions = (a: Pick<WorkoutPlan, "version">, b: Pick<WorkoutPlan, "version">): number =>
  versionRev(a) - versionRev(b);

export const sameVersion = (a: VersionBase, b: VersionBase): boolean => a.rev === b.rev && a.id === b.id;

/**
 * A `version` as read from Firestore or the stored copy, or undefined for
 * "none". Anything else is none too (only a hand edit could write it), so
 * the phone counts it as no version: the rule then refuses every Save of that
 * plan until it is fixed in the console, and `planFromDoc` warns.
 */
export function toPlanVersion(value: unknown): PlanVersion | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { rev, id, base } = value as Partial<PlanVersion>;
  const valid =
    Number.isInteger(rev) &&
    (rev as number) >= 1 &&
    typeof id === "string" &&
    id !== "" &&
    (base === null || typeof base === "string");
  return valid ? { rev: rev as number, id: id as string, base: base as string | null } : undefined;
}
