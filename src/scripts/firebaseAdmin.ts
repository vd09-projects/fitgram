// src/scripts/firebaseAdmin.ts
//
// Admin Firestore for the scripts that write shared or other users' data
// (uploadCatalog, wipeTestData). The admin SDK bypasses the rules,
// which is why `exercise_catalog` can say `allow write: if false` for every
// client, and why one script can wipe every tester's `users/{uid}/...`, which no
// signed-in user can under owner-only rules.
//
// Credentials: a service-account key KEPT OUTSIDE THIS REPO, named by
//
//   export GOOGLE_APPLICATION_CREDENTIALS=~/.config/fitgram/service-account.json
//
// Refused: no variable, a missing file, a key inside the repo (one `git add .`
// from being committed), and a key for a project other than FS_DB_PROJECT_ID.
// `firebase-admin` is a devDependency, imported only from src/scripts/, so it
// never reaches the app bundle. Initialised only on a real write, so
// `--dry-run` needs no key.
import "dotenv/config";
import { existsSync, readFileSync, realpathSync } from "fs";
import path from "path";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const REPO_ROOT = path.resolve(__dirname, "../..");

export async function getAdminFirestore(): Promise<Firestore> {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FS_DB_PROJECT_ID;
  if (!keyPath) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to the service-account key (outside the repo).");
  if (!projectId) throw new Error("Missing FS_DB_PROJECT_ID in .env.");
  if (!existsSync(keyPath)) throw new Error(`No key file at ${keyPath}.`);

  const relative = path.relative(realpathSync(REPO_ROOT), realpathSync(keyPath));
  if (!relative.startsWith("..") && !path.isAbsolute(relative))
    throw new Error(`The key is inside the repo (${relative}). Move it outside, e.g. ~/.config/fitgram/.`);

  const keyProject = JSON.parse(readFileSync(keyPath, "utf8")).project_id;
  if (keyProject !== projectId)
    throw new Error(`Key is for project "${keyProject}", .env says "${projectId}". Refusing to write.`);

  initializeApp({ credential: applicationDefault(), projectId });
  console.log(`Admin credentials for project ${projectId}.`);
  return getFirestore();
}
