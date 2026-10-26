// src/scripts/firebase.ts
//
// Firebase for node-run scripts. The app's own init
// (`src/services/firebase/firebase.ts`) reads config through `expo-constants`,
// which does not exist outside the RN runtime, so scripts read the same values
// straight from .env.
import "dotenv/config";
import { initializeApp } from "firebase/app";
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
