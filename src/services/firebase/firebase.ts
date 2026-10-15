// src/services/firebase/firebase.ts
import { initializeApp } from "firebase/app";
// @ts-ignore getReactNativePersistence exists at runtime in Firebase v11 but is missing from TS types
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { firebaseEnvConfig } from "../../config/envConfig";

// Initialize Firebase
const app = initializeApp(firebaseEnvConfig);

// Export services — use AsyncStorage persistence so sessions survive app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
// Memory cache, stated explicitly (TICKET-028). This replaces
// `cacheSizeBytes: CACHE_SIZE_UNLIMITED`, which looked like it turned on offline
// persistence and did nothing: that setting only ever applied to the persistent
// cache, and none was configured. The persistent cache is not an option here —
// `persistentLocalCache` is backed by IndexedDB, which React Native does not
// have. So Firestore's queued writes die with the app, and finished workouts that
// have not uploaded are kept by our own queue instead (`pendingUploads` in
// useWorkoutStore).
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  