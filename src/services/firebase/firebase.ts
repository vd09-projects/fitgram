// src/services/firebase/firebase.ts
import { initializeApp } from "firebase/app";
// @ts-ignore getReactNativePersistence exists at runtime in Firebase v11 but is missing from TS types
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CACHE_SIZE_UNLIMITED,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import { firebaseEnvConfig } from "../../config/envConfig";

// Initialize Firebase
const app = initializeApp(firebaseEnvConfig);

// Export services — use AsyncStorage persistence so sessions survive app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
// export const db = getFirestore(app);
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});
  