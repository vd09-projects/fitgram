// src/scripts/wipeTestData.ts
//
//   npx tsx src/scripts/wipeTestData.ts              # dry run: counts only, deletes nothing
//   npx tsx src/scripts/wipeTestData.ts --confirm    # delete
//
// TICKET-042: removes every tester's plans and history (old exercise ids) and
// the old 42-exercise catalog, before the new catalog is uploaded. Accounts
// and profiles stay. Paths touched, and the ones never touched: see wipe.ts.
//
//   users/{uid}/workouts/**
//   users/{uid}/sessions/**
//   users/{uid}/exercise_sessions/**
//   users/{uid}/exercise_stats/**
//   users/{uid}/workout_logs/**
//   predefined_exercises/*
//
// Admin credentials (firebaseAdmin.ts), even for the dry run: counting other
// users' data is itself beyond the client rules. Read-only without --confirm.
//
// ORDER: run only after the new build (LOCAL_DATA_VERSION 2) is installed and
// opened on every phone. An old build's upload queue would otherwise write old
// ids back into the wiped collections. Then upload the catalog.
import { getAdminFirestore } from "./firebaseAdmin";
import { countWipeTargets, deleteWipeTargets, formatCounts, isConfirmedRun, totalDocs, type WipeDb } from "./wipe";

const CONFIRM = isConfirmedRun(process.argv);

const wipe = async () => {
  const firestore = await getAdminFirestore();
  const db: WipeDb = {
    collection: (path) => firestore.collection(path),
    doc: (path) => firestore.doc(path),
    recursiveDelete: (ref) => firestore.recursiveDelete(firestore.collection(ref.path)),
  };
  const before = await countWipeTargets(db);
  console.log(`wipe test data${CONFIRM ? "" : " (dry run: nothing deleted; pass --confirm to delete)"}`);
  formatCounts(before).forEach((line) => console.log(line));
  if (!CONFIRM) return;

  await deleteWipeTargets(db, before);
  // Recount instead of trusting the deletes: what is left is the proof.
  const after = await countWipeTargets(db);
  console.log("after:");
  formatCounts(after).forEach((line) => console.log(line));
  if (totalDocs(after) > 0) throw new Error(`${totalDocs(after)} docs still present; re-run to finish.`);
  console.log("✅ Wiped.");
};

wipe()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Wipe failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
