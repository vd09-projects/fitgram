// TEMPORARY (TICKET-079 spike reference). Delete this folder when the build lands; the build
// starts from this module, in modules/rest-notification/.
import { requireOptionalNativeModule } from "expo-modules-core";

type RestNotificationNative = {
  canPost(): boolean;
  show(endAtMs: number, title: string): boolean;
  clear(): void;
};

// requireNativeModule throws at import where the native module does not exist (iOS, web, Expo
// Go), which would crash the app at startup. The optional form returns null, so a missing
// module reads as "nothing posted" (false), never as a plausible success (CLAUDE.md 2.4).
const native = requireOptionalNativeModule<RestNotificationNative>("RestNotification");

export default {
  canPost: (): boolean => native?.canPost() ?? false,
  show: (endAtMs: number, title: string): boolean => native?.show(endAtMs, title) ?? false,
  clear: (): void => native?.clear(),
};
