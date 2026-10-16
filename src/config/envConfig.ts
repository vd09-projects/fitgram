import Constants from "expo-constants";

export const firebaseEnvConfig = {
  apiKey: Constants.expoConfig?.extra?.API_KEY as string,
  authDomain: Constants.expoConfig?.extra?.AUTH_DOMAIN as string,
  projectId: Constants.expoConfig?.extra?.PROJECT_ID as string,
  storageBucket: Constants.expoConfig?.extra?.STORAGE_BUCKET as string,
  messagingSenderId: Constants.expoConfig?.extra?.MESSAGING_SENDER_ID as string,
  appId: Constants.expoConfig?.extra?.API_ID as string,
};

export const googleWebClientId = Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID as string;

/**
 * Show the temporary debug screens (History Debug, Pending Uploads) and their
 * tiles on the Workout tab. Set `SHOW_DEBUG_SCREENS=true` in `.env` for a local
 * run, or as an EAS environment variable for a build.
 *
 * Off unless exactly "true": a build that forgets the variable ships without the
 * debug screens, which is the safe direction. Read at bundle time, so restart
 * Metro (`npm start` clears the cache) after changing it.
 */
export const showDebugScreens = Constants.expoConfig?.extra?.SHOW_DEBUG_SCREENS === "true";
