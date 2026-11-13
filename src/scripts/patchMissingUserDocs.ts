// src/scripts/patchMissingUserDocs.ts
//
//   npx tsx src/scripts/patchMissingUserDocs.ts --dry-run   # reads, lists what it would write
//   npx tsx src/scripts/patchMissingUserDocs.ts             # writes
//
// Creates `users/{uid}` for every user that has an `info` doc but no root doc.
// Admin SDK (firebaseAdmin.ts): a collection-group read across users is beyond
// the owner-only rules. Never overwrites an existing root doc.
import { getAdminFirestore } from "./firebaseAdmin";

const DRY_RUN = process.argv.includes("--dry-run");

const patchMissingUserDocs = async () => {
  const db = await getAdminFirestore();
  const infoDocsSnapshot = await db.collectionGroup("info").get();
  let missing = 0;

  for (const infoDoc of infoDocsSnapshot.docs) {
    const userId = infoDoc.ref.parent.parent?.id;
    if (!userId) continue;

    const userRootDocRef = db.collection("users").doc(userId);
    const rootDocSnapshot = await userRootDocRef.get();

    if (rootDocSnapshot.exists) {
      console.log(`User root doc already exists for userId: ${userId}`);
      continue;
    }
    missing += 1;
    if (DRY_RUN) {
      console.log(`Would patch user: ${userId}`);
      continue;
    }
    await userRootDocRef.set({ uid: userId, verified: true, createdAt: new Date(), patchedFromInfo: true });
    console.log(`Patched user: ${userId}`);
  }
  console.log(`${DRY_RUN ? "Dry run: would patch" : "Patched"} ${missing} user(s) of ${infoDocsSnapshot.size} info doc(s).`);
};

patchMissingUserDocs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Patch failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
