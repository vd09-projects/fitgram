// src/scripts/addExerciseToUserWorkout.ts
//
//   npx tsx src/scripts/addExerciseToUserWorkout.ts <userId> [--dry-run]
//
// Writes the plan `PLAN_ID` for one user. Admin SDK (firebaseAdmin.ts), so the
// owner-only rules do not apply; that is also why it writes `version` and
// `updatedAt` itself (TICKET-073): without a version an overwrite leaves the
// plan with none, and every phone's next Save of it is refused once. The version
// is the existing one's next (none: rev 1), as importHistory.ts does. Run it with
// the phones idle: a Save made between the read and the write is overwritten.
// `--dry-run` reads the existing plan and prints the version it would write.
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NO_VERSION, nextVersion, toPlanVersion, versionOf } from "../utils/planVersion";
import { getAdminFirestore } from "./firebaseAdmin";

const DRY_RUN = process.argv.includes("--dry-run");
const PLAN_ID = "wp_4";

const exercises = [
  { id: "Hip_Thrust_(Barbell)", name: "Hip Thrust (Barbell)", fields: ["SET", "KG", "REPS"] },
  { id: "Leg_Extension_(Machine)", name: "Leg Extension (Machine)", fields: ["SET", "KG", "REPS"] },
  { id: "Good_Morning_(Barbell)", name: "Good Morning (Barbell)", fields: ["SET", "KG", "REPS"] },
  { id: "Standing_Calf_Raise", name: "Standing Calf Raise", fields: ["SET", "KG", "REPS"] },
];

async function run() {
  const userId = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!userId) throw new Error("Usage: npx tsx src/scripts/addExerciseToUserWorkout.ts <userId> [--dry-run]");

  const db = await getAdminFirestore();
  const ref = db.collection("users").doc(userId).collection("workouts").doc(PLAN_ID);
  const existing = await ref.get();
  const base = existing.exists ? versionOf({ version: toPlanVersion(existing.get("version")) }) : NO_VERSION;
  const version = nextVersion(base, randomUUID());

  if (DRY_RUN) {
    console.log(`Dry run: would write ${PLAN_ID} for ${userId} at rev ${version.rev} (${existing.exists ? "overwrite" : "new"}).`);
    return;
  }
  await ref.set({ id: PLAN_ID, name: "Workout Plan 4", exercises, version, updatedAt: FieldValue.serverTimestamp() });
  console.log(`Workout ${PLAN_ID} written at rev ${version.rev}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
