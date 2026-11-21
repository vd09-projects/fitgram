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

  it("stops a preview when the choices close or the row goes away, and calls nothing while none are open", () => {
    const { unmount } = renderScreen(On);
    const stop = RestNotification.stopPreview as jest.Mock;
    const row = screen.getByRole("button", { name: /^Rest-over sound/ });

    fireEvent.press(row);
    expect(stop).not.toHaveBeenCalled();

    fireEvent.press(row);
    expect(stop).toHaveBeenCalledTimes(1);

    fireEvent.press(row);
    stop.mockClear();
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("choosing a sound ends a preview that is still playing", async () => {
    renderScreen(On);
    fireEvent.press(screen.getByRole("button", { name: /^Rest-over sound/ }));
    fireEvent.press(screen.getByRole("button", { name: `Play ${names.ringtone.name}` }));
    (RestNotification.stopPreview as jest.Mock).mockClear();

    await act(async () => {
      fireEvent.press(screen.getByRole("radio", { name: names.alarm.name }));
    });
    expect(RestNotification.stopPreview).toHaveBeenCalledTimes(1);
  });

  it("is dimmed, names the step above it, and does not open when the lock-screen row is Off", () => {
    renderScreen(Off);
    expect(screen.getByText(SOUND_ROW_NEEDS_ON)).toBeOnTheScreen();

    const row = screen.getByRole("button", { name: /^Rest-over sound/ });
    expect(row).toHaveStyle({ opacity: 0.45 });
    fireEvent.press(row);
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
