import { requireOptionalNativeModule } from "expo-modules-core";
type N = { canPost(): boolean; show(e: number, t: string, x: string, v: string): string; clear(): void };
const native = requireOptionalNativeModule<N>("RestNotification");
export default {
  canPost: (): boolean => native?.canPost() ?? false,
  show: (e: number, t: string, x: string, v: string): string => native?.show(e, t, x, v) ?? "no native module",
  clear: (): void => native?.clear(),
};
