import React from "react";
import { act, fireEvent, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RestNotification from "../../modules/rest-notification";
import { REST_SOUND_LABELS, SOUND_ROW_NEEDS_ON } from "../config/restNotification";
import { REST_SOUND_KEY } from "../config/storageKeys";
import { renderScreen } from "../test/renderScreen";
import { useRestSoundStore } from "../stores/restSoundStore";
import RestSoundRow from "./RestSoundRow";

// The global setup reports the native module as absent; the preview calls are the point here.
jest.mock("../../modules/rest-notification", () => ({
  __esModule: true,
  default: { available: true, previewSound: jest.fn(), stopPreview: jest.fn() },
}));

const On = () => <RestSoundRow state="on" />;
const Off = () => <RestSoundRow state="off" />;
const names = REST_SOUND_LABELS;

beforeEach(() => jest.clearAllMocks());

describe("RestSoundRow", () => {
  it("shows the chosen sound and opens the three choices in place", () => {
    renderScreen(On);
    expect(screen.getByText(names.notification.name)).toBeOnTheScreen();
    expect(screen.queryByRole("radio")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: /^Rest-over sound/ }));
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("choosing a sound saves it, and playing one does not choose it", async () => {
    renderScreen(On);
    fireEvent.press(screen.getByRole("button", { name: /^Rest-over sound/ }));

    // Choosing awaits storage, so a play that also chose would only show after the act settles.
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: `Play ${names.ringtone.name}` }));
    });
    expect(RestNotification.previewSound).toHaveBeenCalledWith("ringtone");
    expect(useRestSoundStore.getState().restSound).toBe("notification");
    expect(await AsyncStorage.getItem(REST_SOUND_KEY)).toBeNull();

    // Saving awaits storage before the store changes.
    await act(async () => {
      fireEvent.press(screen.getByRole("radio", { name: names.alarm.name }));
    });
    expect(useRestSoundStore.getState().restSound).toBe("alarm");
    expect(await AsyncStorage.getItem(REST_SOUND_KEY)).toBe("alarm");
  });

  it("closing the choices stops a preview", () => {
    renderScreen(On);
    const row = screen.getByRole("button", { name: /^Rest-over sound/ });
    fireEvent.press(row);
    (RestNotification.stopPreview as jest.Mock).mockClear();

    fireEvent.press(row);
    expect(RestNotification.stopPreview).toHaveBeenCalled();
  });

  it("is dimmed, names the step above it, and does not open when the lock-screen row is Off", () => {
    renderScreen(Off);
    expect(screen.getByText(SOUND_ROW_NEEDS_ON)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: /^Rest-over sound/ }));
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
