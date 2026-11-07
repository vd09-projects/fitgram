// src/scripts/importHistory.ts
//
// Load a user's past workouts from a hand-transcribed file into their history.
//
//   npx tsx src/scripts/importHistory.ts <file.json>             # dry run: offline, writes nothing
//   npx tsx src/scripts/importHistory.ts <file.json> --inspect   # reads the user's data, writes nothing
//   npx tsx src/scripts/importHistory.ts <file.json> --confirm   # write
//
// The file and its grammar: historyImport.ts. Docs are built by the app's own
// `buildSessionDocs`, so an imported session is indistinguishable from one
// logged on the phone.
//
// Writes, under users/{uid} (uid looked up from the file's email):
//   workouts/{planId}                         one per plan, overwritten, with
//                                             `updatedAt` = the server's time
//                                             (TICKET-070 D3) and `version` =
//                                             the next one (TICKET-073)
//   sessions/{sessionId}                      one per session
//   exercise_sessions/{sessionId}__{exercise} one per exercise per session
//   exercise_stats/{exerciseId}               REBUILT from every exercise_session
//                                             the user has, imported or not
//
// Ids are deterministic (plan id + start time), so a re-run overwrites the same
// docs instead of duplicating them. Refuses when the user already has a session
// on an import date that the import did not write: that is either a real
// workout or an earlier import under other ids, and both need a person.
//
// Admin credentials (firebaseAdmin.ts) for --inspect and --confirm.
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { tables } from "../constants/tables";
import type { ExerciseSessionDoc, WorkoutSessionDoc } from "../types/workoutSession";
import { buildExerciseSessionId, rebuildStatsFromSessions } from "../utils/exerciseStats";
import { NO_VERSION, nextVersion, toPlanVersion, versionOf } from "../utils/planVersion";
import { getAdminFirestore } from "./firebaseAdmin";
import { buildImport, type ImportFile } from "./historyImport";
import { isConfirmedRun } from "./wipe";

const USERS = tables.users.collection;
const WORKOUTS = tables.users.fields.workouts.collection;
const SESSIONS = tables.users.fields.sessions.collection;
const EXERCISE_SESSIONS = tables.users.fields.exercise_sessions.collection;
const EXERCISE_STATS = tables.users.fields.exercise_stats.collection;

const BATCH_LIMIT = 400;

const [path] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const CONFIRM = isConfirmedRun(process.argv);
const INSPECT = CONFIRM || process.argv.includes("--inspect");

const day = (ms: number) => new Date(ms).toDateString();

const run = async () => {
  if (!path) throw new Error("Usage: npx tsx src/scripts/importHistory.ts <file.json> [--inspect | --confirm]");
  const file = JSON.parse(readFileSync(path, "utf8")) as ImportFile;
  const built = buildImport(file);

  const exerciseIds = new Set(built.sessions.flatMap((s) => s.exerciseSessions.map((e) => e.exerciseId)));
  console.log(`${file.email}: ${built.plans.length} plans, ${built.sessions.length} sessions, ${exerciseIds.size} exercises`);
  for (const plan of built.plans) console.log(`  plan ${plan.id} "${plan.name}": ${plan.exercises.length} exercises`);
  for (const { session, exerciseSessions } of built.sessions) {
    const sets = exerciseSessions.reduce((sum, e) => sum + e.sets.length, 0);
    const volume = session.volume?.totals.map((t) => `${t.value} ${t.unit ?? ""}`.trim()).join(" · ") || "unavailable";
    console.log(`  ${day(session.startedAt)}  ${session.workoutName}: ${exerciseSessions.length} exercises, ${sets} sets, volume ${volume}`);
  }
  if (!INSPECT) {
    console.log("Dry run: nothing read or written. --inspect reads the user's data; --confirm writes.");
    return;
  }

  const firestore = await getAdminFirestore();
  const uid = (await getAuth().getUserByEmail(file.email)).uid;
  const user = firestore.collection(USERS).doc(uid);
  console.log(`uid ${uid}`);

  const [plansSnap, sessionsSnap] = await Promise.all([user.collection(WORKOUTS).get(), user.collection(SESSIONS).get()]);
  console.log(`Existing: ${plansSnap.size} plans, ${sessionsSnap.size} sessions`);
  for (const plan of plansSnap.docs) console.log(`  plan ${plan.id} "${plan.get("name")}"`);

  const ours = new Set(built.sessions.map((s) => s.session.sessionId));
  const importDays = new Set(built.sessions.map((s) => day(s.session.startedAt)));
  const clashes = sessionsSnap.docs
    .map((d) => d.data() as WorkoutSessionDoc)
    .filter((s) => !ours.has(s.sessionId) && importDays.has(day(s.startedAt)));
  for (const s of clashes) console.log(`  CLASH ${day(s.startedAt)}: existing session ${s.sessionId} "${s.workoutName}"`);

  if (!CONFIRM) {
    console.log("Inspect only: nothing written.");
    return;
  }
  if (clashes.length > 0) throw new Error(`${clashes.length} existing session(s) on import dates. Resolve them first; nothing written.`);

  let batch = firestore.batch();
  let pending = 0;
  const queue = async (write: (b: FirebaseFirestore.WriteBatch) => void) => {
    write(batch);
    if (++pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = firestore.batch();
      pending = 0;
    }
  };

  // TICKET-070 D3: stamped by the server, so phones' change checks return the
  // overwritten plans; an unstamped write would show only on a full reload.
  // TICKET-073: as the next version after the existing one (`nextVersion`,
  // none: rev 1), as a Save would write. Admin credentials skip
  // firestore.rules, but an overwrite without `version` would leave the plan
  // with none, and every phone's next Save of it would be refused once. A new
  // version id, so a phone's Save made on the old version is refused. Read in
  // the listing above, so a phone saving between that read and this write is
  // overwritten (last write wins, as before 073): run it with the phones idle.
  const existing = new Map(plansSnap.docs.map((d) => [d.id, versionOf({ version: toPlanVersion(d.get("version")) })]));
  for (const plan of built.plans) {
    const version = nextVersion(existing.get(plan.id) ?? NO_VERSION, randomUUID());
    console.log(`  plan ${plan.id}: rev ${version.rev}`);
    await queue((b) =>
      b.set(user.collection(WORKOUTS).doc(plan.id), { ...plan, version, updatedAt: FieldValue.serverTimestamp() })
    );
  }
  for (const { session, exerciseSessions } of built.sessions) {
    // Written settled: the rollup is rebuilt below, in this same run.
    await queue((b) => b.set(user.collection(SESSIONS).doc(session.sessionId), { ...session, rollupPending: false }));
    for (const e of exerciseSessions) {
      await queue((b) => b.set(user.collection(EXERCISE_SESSIONS).doc(buildExerciseSessionId(e.sessionId, e.exerciseId)), e));
    }
  }
  if (pending > 0) await batch.commit();
  console.log("Wrote plans, sessions and exercise_sessions.");

  // Rebuilt from everything the user has, so sessions logged on the phone
  // before the import keep their place in records and trends.
  const all = (await user.collection(EXERCISE_SESSIONS).get()).docs.map((d) => d.data() as ExerciseSessionDoc);
  const statsBatch = firestore.batch();
  for (const exerciseId of exerciseIds) {
    const stats = rebuildStatsFromSessions(exerciseId, all);
    if (stats) statsBatch.set(user.collection(EXERCISE_STATS).doc(exerciseId), stats);
  }
  await statsBatch.commit();
  console.log(`Rebuilt ${exerciseIds.size} exercise_stats docs from ${all.length} exercise_sessions.`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Import failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
