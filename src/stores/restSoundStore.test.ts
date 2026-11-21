import AsyncStorage from "@react-native-async-storage/async-storage";
import { resetStores } from "../test/renderScreen";
import { DEFAULT_REST_SOUND } from "../config/restNotification";
import { REST_SOUND_KEY } from "../config/storageKeys";
import { useRestSoundStore } from "./restSoundStore";

const load = () => useRestSoundStore.getState().loadFromStorage();
const sound = () => useRestSoundStore.getState().restSound;

beforeEach(() => resetStores());

describe("restSoundStore", () => {
  it("loads a stored sound and keeps the default for a missing or unknown one", async () => {
    await load();
    expect(sound()).toBe(DEFAULT_REST_SOUND);

    await AsyncStorage.setItem(REST_SOUND_KEY, "alarm");
    await load();
    expect(sound()).toBe("alarm");

    // A name from a build with more sounds, or a corrupt value, is not a choice.
    resetStores();
    await AsyncStorage.setItem(REST_SOUND_KEY, "foghorn");
    await load();
    expect(sound()).toBe(DEFAULT_REST_SOUND);
  });

  it("persists a chosen sound and refuses an unknown one", async () => {
    await useRestSoundStore.getState().setRestSound("ringtone");
    expect(await AsyncStorage.getItem(REST_SOUND_KEY)).toBe("ringtone");

    await useRestSoundStore.getState().setRestSound("foghorn" as never);
    expect(sound()).toBe("ringtone");
    expect(await AsyncStorage.getItem(REST_SOUND_KEY)).toBe("ringtone");
  });
});
