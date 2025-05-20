import Constants from "expo-constants";

export const firebaseEnvConfig = {
  apiKey: Constants.expoConfig?.extra?.API_KEY as string,
  authDomain: Constants.expoConfig?.extra?.AUTH_DOMAIN as string,
  projectId: Constants.expoConfig?.extra?.PROJECT_ID as string,
  storageBucket: Constants.expoConfig?.extra?.STORAGE_BUCKET as string,
  messagingSenderId: Constants.expoConfig?.extra?.MESSAGING_SENDER_ID as string,
  appId: Constants.expoConfig?.extra?.API_ID as string,
};
