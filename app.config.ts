// app.config.ts
import "dotenv/config";
import { ExpoConfig, ConfigContext } from "@expo/config";

const NAME = "Fitgram";
const SLUG = "fitgram";
const VERSION = "1.0.1";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: NAME,
    slug: SLUG,
    version: VERSION,
    icon: "./assets/icon.png",
    android: {
      package: "com.vd09.fitgram",
      versionCode: 11,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon-3.png",
        // backgroundColor: "#FFFFFF",
      },
    },
    extra: {
      ...config.extra,
      API_KEY: process.env.FS_DB_API_KEY,
      AUTH_DOMAIN: process.env.FS_DB_AUTH_DOMAIN,
      PROJECT_ID: process.env.FS_DB_PROJECT_ID,
      STORAGE_BUCKET: process.env.FS_DB_STORAGE_BUCKET,
      MESSAGING_SENDER_ID: process.env.FS_DB_MESSAGING_SENDER_ID,
      API_ID: process.env.FS_DB_API_ID,
    },
  };
};
