// src/scripts/rebuildExerciseStats.ts
//
// Recompute the exercise_stats rollup from exercise_sessions, which is the
// source of truth.
//
//   npx tsx src/scripts/rebuildExerciseStats.ts <userId> [exerciseId ...] [--dry-run]
//
// Admin SDK (firebaseAdmin.ts): the client rules refuse a script. `--dry-run`
// still reads the sessions (so it needs the key) but writes nothing: it prints
// each stats doc it would write.
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
// Warning: sets stored before TICKET-055 (a bare map, no `segments`) do not decode
// today, so a rebuild does not count them. On the test account the 26 Oct session
// is in that format, and a rebuild drops a 34 kg best to 5 kg (found in TICKET-077;
// TICKET-032 decides what to do). Running this on such an account lowers real bests.

import { FieldValue } from "firebase-admin/firestore";
import { ExerciseSessionDoc } from "../types/workoutSession";
import { rebuildStatsFromSessions } from "../utils/exerciseStats";
import { getAdminFirestore } from "./firebaseAdmin";

const BATCH_LIMIT = 400;
const DRY_RUN = process.argv.includes("--dry-run");

const rebuild = async (userId: string, onlyExerciseIds: string[]) => {
  const db = await getAdminFirestore();
  const sessionsSnap = await db.collection("users").doc(userId).collection("exercise_sessions").get();
  const sessions = sessionsSnap.docs.map((d) => d.data() as ExerciseSessionDoc);

  if (sessions.length === 0) {
    console.log("No exercise_sessions found — nothing to rebuild.");
    return;
  }

  const exerciseIds =
    onlyExerciseIds.length > 0
      ? onlyExerciseIds
      : [...new Set(sessions.map((s) => s.exerciseId))];

  console.log(
    `Read ${sessions.length} sessions; rebuilding ${exerciseIds.length} exercise(s).`
  );

  let batch = db.batch();
  let pending = 0;
  let written = 0;

  for (const exerciseId of exerciseIds) {
    const stats = rebuildStatsFromSessions(exerciseId, sessions);
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
    batch.set(db.collection("users").doc(userId).collection("exercise_stats").doc(exerciseId), { ...stats, updatedAt: FieldValue.serverTimestamp() });
    pending += 1;
    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  console.log(`${DRY_RUN ? "Dry run: would rebuild" : "Rebuilt"} ${written} exercise_stats doc(s).`);
};

const [userId, ...exerciseIds] = process.argv.slice(2).filter((a) => a !== "--dry-run");
if (!userId) {
  console.error(
    "Usage: npx tsx src/scripts/rebuildExerciseStats.ts <userId> [exerciseId ...] [--dry-run]"
  );
  process.exit(1);
}

rebuild(userId, exerciseIds)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Rebuild failed:", error);
    process.exit(1);
  });
