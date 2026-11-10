// TEMPORARY (TICKET-079 spike). See RestNotificationModule.kt for removal.
import { requireNativeModule } from "expo-modules-core";

type RestNotificationNative = {
  canPost(): boolean;
  show(endAtMs: number, title: string): boolean;
  clear(): void;
};

export default requireNativeModule<RestNotificationNative>("RestNotification");
