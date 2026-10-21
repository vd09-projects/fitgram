import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_REST_MS } from "../utils/restTimer";
import { resetStores } from "../test/renderScreen";
import { useRestPreferenceStore } from "./restPreferenceStore";

const KEY = "rest_duration_ms";
const load = () => useRestPreferenceStore.getState().loadFromStorage();
const duration = () => useRestPreferenceStore.getState().restDurationMs;

beforeEach(() => resetStores());

describe("restPreferenceStore", () => {
  it("loads a stored duration and keeps the default for a missing or corrupt one", async () => {
    await load();
    expect(duration()).toBe(DEFAULT_REST_MS);

    await AsyncStorage.setItem(KEY, "120000");
    await load();
    expect(duration()).toBe(120_000);

    resetStores();
    await AsyncStorage.setItem(KEY, "-5");
    await load();
    expect(duration()).toBe(DEFAULT_REST_MS);
  });

  it("persists a set duration and refuses one out of range", async () => {
    await useRestPreferenceStore.getState().setRestDurationMs(45_000);
    expect(await AsyncStorage.getItem(KEY)).toBe("45000");

    await useRestPreferenceStore.getState().setRestDurationMs(0);
    expect(duration()).toBe(45_000);
  });
});
