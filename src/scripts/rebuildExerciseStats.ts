// src/scripts/rebuildExerciseStats.ts
//
// Recompute the exercise_stats rollup, and the verdicts stored on `sessions`,
// from the sets in `sessions.lifts`, which are the source of truth (TICKET-081;
// before it, `exercise_sessions`, which is still written beside them until
// TICKET-085 and is not read here).
//
//   npx tsx src/scripts/rebuildExerciseStats.ts <userId> [exerciseId ...] [--confirm]
//
// Admin SDK (firebaseAdmin.ts): the client rules refuse a script. Without
// `--confirm` it is a dry run: it still reads the sessions (so it needs the key)
// but writes nothing, and prints each stats doc and each session it would write.
// Finds what compareHistory.ts reports and writes the fix: a verdict a late
// upload or a replayed save left wrong (081's known gaps (a) and (b)), a verdict
// still pending, a rollup that drifted.
//
// When to run it:
//  - a workout saved with no summary and lost from the phone before its queue
//    retried it (the queue retries a failed rollup, TICKET-077)
//  - a logged set was edited or deleted. An incremental fold can raise a record
//    but never lower one, so an edit downwards needs a rebuild
//  - any time the rollup is suspected of drift
//
// Idempotent: it writes a value derived purely from the sessions it reads. Pass
// exercise ids to limit what a run touches.
//
// Warning: sessions with no readable `lifts` (written before TICKET-081) and sets
// stored before TICKET-055 (a bare map, no `segments`) are not counted, so a
// rebuild lowers bests that came only from them. The sessions left out are
// listed. On the test account the 26 Oct session is in the older format and a
// rebuild drops a 34 kg best to 5 kg (TICKET-077; TICKET-032 decides what to do).

import { FieldValue } from "firebase-admin/firestore";
import { WorkoutSessionDoc } from "../types/workoutSession";
import { rebuildStatsFromSessions } from "../utils/exerciseStats";
import { exerciseSessionsOf, readLifts, repairedSessions } from "../utils/liftRecord";
import { getAdminFirestore } from "./firebaseAdmin";
import { isConfirmedRun } from "./wipe";

const BATCH_LIMIT = 400;
const DRY_RUN = !isConfirmedRun(process.argv);

const rebuild = async (userId: string, onlyExerciseIds: string[]) => {
  const db = await getAdminFirestore();
  const user = db.collection("users").doc(userId);
  const all = (await user.collection("sessions").get()).docs.map((d) => d.data() as WorkoutSessionDoc);
  const sessions = all.filter((s) => readLifts(s.lifts) !== null);
  if (sessions.length < all.length) {
    console.warn(`  NOT COUNTED: ${all.length - sessions.length} session(s) with no readable lifts:`);
    all.filter((s) => !sessions.includes(s)).forEach((s) => console.warn(`    ${s.sessionId}`));
  }

  if (sessions.length === 0) {
    console.log("No sessions with lifts found — nothing to rebuild.");
    return;
  }

  const lifts = exerciseSessionsOf(sessions);
  const exerciseIds =
    onlyExerciseIds.length > 0
      ? onlyExerciseIds
      : [...new Set(lifts.map((s) => s.exerciseId))];

  console.log(
    `Read ${sessions.length} sessions, ${lifts.length} lifts; rebuilding ${exerciseIds.length} exercise(s).`
  );

  // Verdicts first: a lift limited by id keeps the others' as stored.
  const repaired = repairedSessions(sessions, new Set(exerciseIds));
  repaired.forEach((s) => console.log(`  ${DRY_RUN ? "would correct" : "correcting"} verdicts of sessions/${s.sessionId}`));

  let batch = db.batch();
  let pending = 0;
  let written = 0;
  const commitWhenFull = async () => {
    if (++pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  };

  for (const session of repaired) {
    if (DRY_RUN) continue;
    // Merge: a `note` added on the phone stays. The stamp moves, so phones' change checks find it.
    batch.set(user.collection("sessions").doc(session.sessionId), { lifts: session.lifts, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await commitWhenFull();
  }

  for (const exerciseId of exerciseIds) {
    const stats = rebuildStatsFromSessions(exerciseId, lifts);
    if (!stats) {
      console.warn(`  skip ${exerciseId} — no sessions for it`);
      continue;
    }
    // The stamp is what phones' change checks find (TICKET-076).
    written += 1;
    if (DRY_RUN) {
      console.log(`  would write exercise_stats/${exerciseId}`);
      continue;
    }
    batch.set(user.collection("exercise_stats").doc(exerciseId), { ...stats, updatedAt: FieldValue.serverTimestamp() });
    await commitWhenFull();
  }
  if (pending > 0) await batch.commit();

  console.log(
    `${DRY_RUN ? "Dry run: would correct" : "Corrected"} ${repaired.length} session(s) and ${DRY_RUN ? "rebuild" : "rebuilt"} ${written} exercise_stats doc(s).${DRY_RUN ? " Pass --confirm to write." : ""}`
  );
};

const [userId, ...exerciseIds] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!userId) {
  console.error(
    "Usage: npx tsx src/scripts/rebuildExerciseStats.ts <userId> [exerciseId ...] [--confirm]"
  );
  process.exit(1);
}

rebuild(userId, exerciseIds)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Rebuild failed:", error);
    process.exit(1);
  });
