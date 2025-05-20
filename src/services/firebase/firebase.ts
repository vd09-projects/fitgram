// src/services/firebase/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  CACHE_SIZE_UNLIMITED,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import { firebaseEnvConfig } from "../../config/envConfig";

// Initialize Firebase
const app = initializeApp(firebaseEnvConfig);

// Export services
export const auth = getAuth(app);
// export const db = getFirestore(app);
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});
  