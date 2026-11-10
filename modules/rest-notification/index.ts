import { requireOptionalNativeModule } from "expo-modules-core";

/** Every string the notification shows, passed in from src/config/restNotification.ts. */
export type RestCopy = {
  channelName: string;
  subText: string;
  title: string;
  text: string;
  titleDone: string;
  textDone: string;
};

type Native = {
  isEnabled(): boolean;
  show(endAtMs: number, copy: RestCopy): boolean;
  showDone(copy: RestCopy): boolean;
  clear(): boolean;
};

// Null where the native module is not built in: iOS, web, Expo Go, jest. Each call then reports
// "not posted" instead of throwing.
const native = requireOptionalNativeModule<Native>("RestNotification");

/** `false` from any call means nothing was posted or cleared; callers carry on without it. */
export default {
  /** Whether this build has the native module at all: Android, and not Expo Go. */
  available: native !== null,
  isEnabled: (): boolean => native?.isEnabled() ?? false,
  show: (endAtMs: number, copy: RestCopy): boolean => native?.show(endAtMs, copy) ?? false,
  showDone: (copy: RestCopy): boolean => native?.showDone(copy) ?? false,
  clear: (): boolean => native?.clear() ?? false,
};
