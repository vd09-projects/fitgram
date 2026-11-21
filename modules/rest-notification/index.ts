import { requireOptionalNativeModule } from "expo-modules-core";

/** Every string the notification shows, passed in from src/config/restNotification.ts. */
export type RestCopy = {
  channelName: string;
  doneChannelName: string;
  subText: string;
  title: string;
  text: string;
  titleDone: string;
  textDone: string;
  /** One of `REST_SOUNDS` (src/config/restNotification.ts); Kotlin falls back to the default for any other. */
  sound: string;
};

type Native = {
  isEnabled(): boolean;
  show(endAtMs: number, copy: RestCopy): boolean;
  showDone(copy: RestCopy): boolean;
  clear(): boolean;
  previewSound(sound: string): boolean;
  stopPreview(): boolean;
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
  /** Play one of the sounds once, for the settings screen. Stops any preview already playing. */
  previewSound: (sound: string): boolean => native?.previewSound(sound) ?? false,
  stopPreview: (): boolean => native?.stopPreview() ?? false,
};
