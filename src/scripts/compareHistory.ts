// src/scripts/compareHistory.ts
//
// Check a user's stored workouts against their own sets (TICKET-081 stage 3).
//
//   npx tsx src/scripts/compareHistory.ts <userId>
//
// Read-only: it has no write mode, so there is no flag to forget. Admin SDK
// (firebaseAdmin.ts), so it needs the key. Prints what disagrees; exits 1 when
// anything does, so it can gate a check. What each check means:
// historyCompare.ts. The repair for every difference is
// `rebuildExerciseStats.ts` (rollups and verdicts, from the sets).
import { tables } from "../constants/tables";
import type { ExerciseSessionDoc, ExerciseStatsDoc, WorkoutSessionDoc } from "../types/workoutSession";
import { getAdminFirestore } from "./firebaseAdmin";
import { compareHistory, totalMismatches } from "./historyCompare";

const USERS = tables.users.collection;
const SESSIONS = tables.users.fields.sessions.collection;
const EXERCISE_SESSIONS = tables.users.fields.exercise_sessions.collection;
const EXERCISE_STATS = tables.users.fields.exercise_stats.collection;

const compare = async (userId: string): Promise<number> => {
  const firestore = await getAdminFirestore();
  const user = firestore.collection(USERS).doc(userId);
  const [sessions, exerciseSessions, stats] = await Promise.all([
    user.collection(SESSIONS).get(),
    user.collection(EXERCISE_SESSIONS).get(),
    user.collection(EXERCISE_STATS).get(),
  ]);
  console.log(`Read ${sessions.size} sessions, ${exerciseSessions.size} exercise_sessions, ${stats.size} exercise_stats.`);

  const report = compareHistory(
    sessions.docs.map((d) => d.data() as WorkoutSessionDoc),
    exerciseSessions.docs.map((d) => d.data() as ExerciseSessionDoc),
    stats.docs.map((d) => d.data() as ExerciseStatsDoc)
  );
  console.log(`${report.sessions} sessions, ${report.lifts} lifts checked.`);
  if (report.unreadable.length > 0) {
    console.log(`Not checked, lifts missing or unreadable (the old shape): ${report.unreadable.length}`);
    report.unreadable.forEach((id) => console.log(`  ${id}`));
  }
  const pending = report.verdictMismatches.filter((m) => m.stored.reason === "pending").length;
  console.log(`Verdicts that differ from the sets: ${report.verdictMismatches.length} (${pending} still pending)`);
  report.verdictMismatches.forEach((m) =>
    console.log(`  ${m.sessionId} ${m.liftId}: stored ${m.stored.verdict ?? m.stored.reason}, sets give ${m.expected.verdict ?? m.expected.reason}`)
  );
  const lists: [string, string[]][] = [
    ["exerciseIds that are not the lifts' ids", report.exerciseIdsMismatches],
    ["exercise_sessions missing or different", report.exerciseSessionsDiffer],
    ["exercise_sessions no lift stands for", report.exerciseSessionsOrphan],
    ["exercise_stats not what the sets rebuild", report.statsDiffer],
  ];
  for (const [label, ids] of lists) {
    console.log(`${label}: ${ids.length}`);
    ids.forEach((id) => console.log(`  ${id}`));
  }
  const total = totalMismatches(report);
  if (total === 0) console.log("0 mismatches.");
  else if (report.unreadable.length > 0) {
    // The rebuild cannot fix these: it reads sets from `lifts`, and there are none to read.
    console.log(`${total} to look at. ${report.unreadable.length} session(s) in the old shape cannot be checked or rebuilt: wipe and re-import them (no migration).`);
  } else console.log(`${total} mismatches. Repair: rebuildExerciseStats.ts.`);
  return total === 0 ? 0 : 1;
};

const [userId] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!userId) {
  console.error("Usage: npx tsx src/scripts/compareHistory.ts <userId>");
  process.exit(2);
}
compare(userId)
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Compare failed:", error instanceof Error ? error.message : error);
    process.exit(2);
  });
