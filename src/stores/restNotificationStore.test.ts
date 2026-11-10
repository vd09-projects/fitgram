import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import RestNotification from "../../modules/rest-notification";
import { REST_NOTIF_MAX_REFUSALS } from "../config/restNotification";
import { REST_NOTIFICATION_KEY } from "../config/storageKeys";
import { resyncRestNotification } from "../services/restNotification/adapter";

// The global setup reports the native module as absent; these tests are about what the store
// does when it is there, so this file swaps in a present one.
jest.mock("../../modules/rest-notification", () => ({
  __esModule: true,
  default: { available: true, isEnabled: jest.fn(), show: jest.fn(), showDone: jest.fn(), clear: jest.fn() },
}));
jest.mock("../services/restNotification/adapter", () => ({ resyncRestNotification: jest.fn() }));

type StoreModule = typeof import("./restNotificationStore");
let mod: StoreModule;
let initial: ReturnType<StoreModule["useRestNotificationStore"]["getState"]>;

// The store reads the platform once, at import, so the import waits until the platform is Android 13+.
beforeAll(() => {
  Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true });
  Object.defineProperty(Platform, "Version", { get: () => 34, configurable: true });
  mod = require("./restNotificationStore");
  initial = mod.useRestNotificationStore.getState();
});

const store = () => mod.useRestNotificationStore;
const allowed = (granted: boolean, enabled = granted) => {
  jest.spyOn(PermissionsAndroid, "check").mockResolvedValue(granted);
  (RestNotification.isEnabled as jest.Mock).mockReturnValue(enabled);
};
const answerDialog = (result: string) => jest.spyOn(PermissionsAndroid, "request").mockResolvedValue(result as never);

beforeEach(async () => {
  jest.restoreAllMocks();
  (resyncRestNotification as jest.Mock).mockClear();
  await AsyncStorage.clear();
  store().setState(initial, true);
});

describe("acceptPrompt", () => {
  it("counts each refusal and reads Blocked once the maximum is reached", async () => {
    allowed(false);
    answerDialog(PermissionsAndroid.RESULTS.DENIED);

    await store().getState().acceptPrompt();
    expect(store().getState().refusals).toBe(1);
    expect(store().getState().state).toBe("off");

    for (let i = 1; i < REST_NOTIF_MAX_REFUSALS; i++) await store().getState().acceptPrompt();
    expect(store().getState().refusals).toBe(REST_NOTIF_MAX_REFUSALS);
    expect(store().getState().state).toBe("blocked");
  });

  it("treats never-ask-again as the maximum straight away", async () => {
    allowed(false);
    answerDialog(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    await store().getState().acceptPrompt();

    expect(store().getState().refusals).toBe(REST_NOTIF_MAX_REFUSALS);
    expect(store().getState().state).toBe("blocked");
  });
});

describe("refresh", () => {
  it("clears the refusal count when the permission is found granted", async () => {
    store().setState({ refusals: REST_NOTIF_MAX_REFUSALS, state: "blocked" });
    allowed(true);

    await store().getState().refresh();

    expect(store().getState().refusals).toBe(0);
    expect(store().getState().state).toBe("on");
  });

  it("posts the running rest when the permission arrives after it began, and not on the first read", async () => {
    allowed(true);
    await store().getState().refresh();
    expect(resyncRestNotification).not.toHaveBeenCalled(); // unknown -> on: just the first read

    store().setState({ state: "blocked" });
    await store().getState().refresh();
    expect(resyncRestNotification).toHaveBeenCalledTimes(1);

    await store().getState().refresh();
    expect(resyncRestNotification).toHaveBeenCalledTimes(1); // on -> on: nothing new to post
  });
});

describe("loadFromStorage", () => {
  it("keeps the defaults when the stored value is unreadable or out of range", async () => {
    allowed(false);
    await AsyncStorage.setItem(REST_NOTIFICATION_KEY, "{not json");
    await store().getState().loadFromStorage();
    expect(store().getState()).toMatchObject({ promptSeen: false, refusals: 0, isLoaded: true });

    await AsyncStorage.setItem(REST_NOTIFICATION_KEY, JSON.stringify({ promptSeen: "yes", refusals: -3 }));
    await store().getState().loadFromStorage();
    expect(store().getState()).toMatchObject({ promptSeen: false, refusals: 0 });
  });
});

describe("watchRestNotificationForeground", () => {
  it("re-reads Android when the app comes back to the foreground, and only then", () => {
    let onChange: (state: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      onChange = handler as (state: string) => void;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const refresh = jest.fn().mockResolvedValue(undefined);
    store().setState({ refresh });

    const stop = mod.watchRestNotificationForeground();
    onChange("background");
    onChange("inactive");
    expect(refresh).not.toHaveBeenCalled();

    onChange("active");
    expect(refresh).toHaveBeenCalledTimes(1);

    stop();
    expect(remove).toHaveBeenCalled();
  });
});
