import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import RestNotification from "../../modules/rest-notification";
import { REST_NOTIF_MAX_REFUSALS } from "../config/restNotification";
import { REST_NOTIFICATION_KEY } from "../config/storageKeys";
import { RestNotificationState, restNotificationState } from "../services/restNotification/state";
import { resyncRestNotification } from "../services/restNotification/adapter";

/**
 * The lock-screen rest timer's permission, as the app sees it (TICKET-079).
 *
 * Its own store, a preference like `restPreferenceStore`, not `useWorkoutStore`:
 * it outlives every workout. `promptSeen` and `refusals` are the only persisted
 * facts; `state` is read from Android each time, never stored, because
 * the user can change it in system settings behind the app's back.
 *
 * Denied costs nothing: nothing here touches the in-app timer, and the sheet
 * opens at most once on its own (`promptSeen`), so there is no nagging.
 */
interface RestNotificationStore {
  /** `unknown` until the first `refresh` has read Android. */
  state: RestNotificationState | "unknown";
  /** The sheet was answered once ("Turn on" or "Not now"); it never reopens by itself. */
  promptSeen: boolean;
  /**
   * How many times Android's dialog was refused. Android shows it
   * REST_NOTIF_MAX_REFUSALS times at most, and says "never ask again" when it will not show
   * it again, which can come after one refusal if the permission was revoked
   * before (emulator, `adb shell pm revoke`). Both signals count: that result
   * jumps straight to the maximum; a plain refusal adds one.
   */
  refusals: number;
  promptOpen: boolean;
  isLoaded: boolean;
  loadFromStorage: () => Promise<void>;
  /** Re-read Android's answer: at start, and when the app returns from system settings. */
  refresh: () => Promise<void>;
  openPrompt: () => void;
  /** "Not now": final. */
  dismissPrompt: () => void;
  /** "Turn on": mark answered and show Android's own dialog. */
  acceptPrompt: () => Promise<void>;
}

// Below Android 13 there is no runtime permission, so notifications are granted.
const NEEDS_RUNTIME_PERMISSION = Platform.OS === "android" && Number(Platform.Version) >= 33;

async function isGranted(): Promise<boolean> {
  if (!NEEDS_RUNTIME_PERMISSION) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

export const useRestNotificationStore = create<RestNotificationStore>((set, get) => {
  const persist = () => {
    const { promptSeen, refusals } = get();
    AsyncStorage.setItem(REST_NOTIFICATION_KEY, JSON.stringify({ promptSeen, refusals })).catch(() => {});
  };

  return {
    state: "unknown",
    promptSeen: false,
    refusals: 0,
    promptOpen: false,
    isLoaded: false,

    // A missing or unreadable value keeps the defaults: the sheet may show once more, never nag.
    loadFromStorage: async () => {
      try {
        const stored = JSON.parse((await AsyncStorage.getItem(REST_NOTIFICATION_KEY)) ?? "{}");
        set({
          promptSeen: stored?.promptSeen === true,
          refusals: Number.isInteger(stored?.refusals) && stored.refusals > 0 ? stored.refusals : 0,
        });
      } catch {
        // keep the defaults
      }
      set({ isLoaded: true });
      await get().refresh();
    },

    refresh: async () => {
      if (!RestNotification.available) return;
      try {
        const granted = await isGranted();
        // A grant clears the count: the user fixed it in system settings, or allowed it there.
        if (granted && get().refusals > 0) {
          set({ refusals: 0 });
          persist();
        }
        const before = get().state;
        const state = restNotificationState({
          granted,
          enabled: RestNotification.isEnabled(),
          refusedForGood: get().refusals >= REST_NOTIF_MAX_REFUSALS,
        });
        set({ state });
        // Allowed after the rest began (the first-rest dialog, or Android's settings page):
        // nothing was posted for it, so post what is left now. Not from "unknown", which is
        // only the first read at start.
        if (state === "on" && (before === "off" || before === "blocked")) resyncRestNotification();
      } catch (error) {
        console.warn("Could not read the notification permission:", error);
      }
    },

    openPrompt: () => set({ promptOpen: true }),

    dismissPrompt: () => {
      set({ promptOpen: false, promptSeen: true });
      persist();
    },

    acceptPrompt: async () => {
      set({ promptOpen: false, promptSeen: true });
      try {
        if (NEEDS_RUNTIME_PERMISSION) {
          const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) set({ refusals: REST_NOTIF_MAX_REFUSALS });
          else if (result !== PermissionsAndroid.RESULTS.GRANTED) set({ refusals: get().refusals + 1 });
        }
      } catch (error) {
        console.warn("Notification permission request failed:", error);
      }
      persist();
      await get().refresh();
    },
  };
});

/**
 * Re-read Android's answer every time the app returns to the foreground, on every
 * screen. The user can only change the permission or the app's switch in system
 * settings, which means leaving the app, so this is the one moment `state` can
 * have gone stale. It used to live in the settings row, which left the first-rest
 * sheet and the row reading an old value whenever Profile was not open. Call once
 * at app start; returns the unsubscribe.
 */
export function watchRestNotificationForeground(): () => void {
  const subscription = AppState.addEventListener("change", (next) => {
    if (next === "active") useRestNotificationStore.getState().refresh();
  });
  return () => subscription.remove();
}
