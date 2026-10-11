// src/scripts/firebase.ts
//
// Firebase for node-run scripts. The app's own init
// (`src/services/firebase/firebase.ts`) reads config through `expo-constants`,
// which does not exist outside the RN runtime, so scripts read the same values
// straight from .env.
import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FS_DB_API_KEY,
  authDomain: process.env.FS_DB_AUTH_DOMAIN,
  projectId: process.env.FS_DB_PROJECT_ID,
  storageBucket: process.env.FS_DB_STORAGE_BUCKET,
  messagingSenderId: process.env.FS_DB_MESSAGING_SENDER_ID,
  appId: process.env.FS_DB_API_ID,
};

if (!firebaseConfig.projectId) {
  throw new Error(
    "Missing FS_DB_PROJECT_ID. Scripts read Firebase config from .env."
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Sign in before writing.
 *
 * Scripts run unauthenticated by default, so `request.auth` is null and any rule
 * requiring a signed-in user rejects the write with PERMISSION_DENIED. Reads
 * credentials from the environment — never hardcode them, and never log them.
 *
 *   FS_SEED_EMAIL=you@example.com FS_SEED_PASSWORD=... npx tsx <script>
 *
 * Returns false when no credentials are set, so a script can continue
 * unauthenticated where the rules permit it.
 */
export const signInForScripts = async (): Promise<boolean> => {
  const email = process.env.FS_SEED_EMAIL;
  const password = process.env.FS_SEED_PASSWORD;
  if (!email || !password) return false;

  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}.`);
  return true;
};
