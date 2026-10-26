// src/scripts/wipe.ts
//
// The TICKET-042 test-data wipe, without the admin SDK, so a test can run it
// against a fake Firestore. The CLI is src/scripts/wipeTestData.ts.
//
// Deletes exactly these, and nothing else:
//
//   users/{uid}/workouts/**            plans (old exercise ids)
//   users/{uid}/sessions/**
//   users/{uid}/exercise_sessions/**
//   users/{uid}/exercise_stats/**
//   users/{uid}/workout_logs/**        legacy logs, read by nothing, old ids
//   predefined_exercises/*             the old 42-exercise catalog
//
// Never: the users/{uid} doc itself, users/{uid}/info (profile), or any other
// subcollection under a user (settings, tour state).
// Those are listed as "kept" so the dry run shows what survives. `**` means
// recursiveDelete also removes anything nested under a doc in those
// collections: workout_logs/{id}/logs/{id}/exercises/... is. Counts are
// top-level docs only, so nested ones are deleted without being counted.

export const WIPED_USER_COLLECTIONS = ["workouts", "sessions", "exercise_sessions", "exercise_stats", "workout_logs"] as const;
export const PREDEFINED_COLLECTION = "predefined_exercises";

/** The slice of admin Firestore the wipe uses: lists, and recursiveDelete on a collection. */
export type WipeCollectionRef = { path: string; listDocuments(): Promise<{ id: string }[]> };
export interface WipeDb {
  collection(path: string): WipeCollectionRef;
  doc(path: string): { listCollections(): Promise<{ id: string }[]> };
  recursiveDelete(ref: WipeCollectionRef): Promise<void>;
}

/** A real run needs `--confirm`; `--dry-run` anywhere wins, so a pasted mix never deletes. */
export const isConfirmedRun = (argv: readonly string[]) => argv.includes("--confirm") && !argv.includes("--dry-run");

export type UserCounts = { uid: string; counts: Record<string, number>; kept: string[] };
export type WipeCounts = { users: UserCounts[]; predefined: number };

/**
 * Top-level doc counts per collection. `listDocuments` also returns a user id
 * whose users/{uid} doc was never written but has subcollections (see
 * patchMissingUserDocs.ts), which a plain query would skip.
 */
export async function countWipeTargets(db: WipeDb): Promise<WipeCounts> {
  const users: UserCounts[] = [];
  for (const user of await db.collection("users").listDocuments()) {
    const present = (await db.doc(`users/${user.id}`).listCollections()).map((c) => c.id);
    const counts: Record<string, number> = {};
    for (const name of WIPED_USER_COLLECTIONS)
      counts[name] = present.includes(name)
        ? (await db.collection(`users/${user.id}/${name}`).listDocuments()).length
        : 0;
    const kept = present.filter((name) => !(WIPED_USER_COLLECTIONS as readonly string[]).includes(name));
    users.push({ uid: user.id, counts, kept });
  }
  const predefined = (await db.collection(PREDEFINED_COLLECTION).listDocuments()).length;
  return { users, predefined };
}

export const totalDocs = (c: WipeCounts) =>
  c.predefined + c.users.reduce((sum, u) => sum + Object.values(u.counts).reduce((a, b) => a + b, 0), 0);

export function formatCounts(c: WipeCounts): string[] {
  const lines = c.users.map(
    (u) =>
      `  users/${u.uid}  ` +
      WIPED_USER_COLLECTIONS.map((name) => `${name} ${u.counts[name]}`).join(" · ") +
      `  | kept: ${u.kept.length ? u.kept.join(", ") : "nothing else"}`
  );
  return [
    ...lines,
    `  ${PREDEFINED_COLLECTION}  ${c.predefined}`,
    `  total: ${totalDocs(c)} top-level docs across ${c.users.length} users`,
  ];
}

/** Delete the counted collections. Only paths built from the two constants above. */
export async function deleteWipeTargets(db: WipeDb, c: WipeCounts): Promise<void> {
  for (const u of c.users)
    for (const name of WIPED_USER_COLLECTIONS)
      if (u.counts[name] > 0) await db.recursiveDelete(db.collection(`users/${u.uid}/${name}`));
  if (c.predefined > 0) await db.recursiveDelete(db.collection(PREDEFINED_COLLECTION));
}
