import { act, fireEvent, screen } from "@testing-library/react-native";
import RestNotification from "../../modules/rest-notification";
import { renderScreen } from "../test/renderScreen";
import { useRestNotificationStore } from "../stores/restNotificationStore";
import RestSettingsCard from "./RestSettingsCard";

// The global setup reports the native module as absent; the card's hide rule needs it both ways.
jest.mock("../../modules/rest-notification", () => ({
  __esModule: true,
  default: { available: true, isEnabled: jest.fn(), previewSound: jest.fn(), stopPreview: jest.fn() },
}));

const native = RestNotification as unknown as { available: boolean };
const store = useRestNotificationStore;
// `refresh` would read Android; these tests choose the state themselves.
const showing = (state: "on" | "off" | "blocked" | "unknown") =>
  store.setState({ state, refresh: jest.fn().mockResolvedValue(undefined) });

afterEach(() => {
  native.available = true;
});

describe("RestSettingsCard", () => {
  it("holds the permission row and the sound row in one card", () => {
    showing("on");
    renderScreen(RestSettingsCard);
    expect(screen.getByTestId("rest-notification-row")).toBeOnTheScreen();
    expect(screen.getByTestId("rest-sound-row")).toBeOnTheScreen();
  });

  it("shows nothing before Android has been read, or where there is no native module", () => {
    showing("unknown");
    renderScreen(RestSettingsCard);
    expect(screen.queryByTestId("rest-sound-row")).toBeNull();

    act(() => showing("on"));
    native.available = false;
    renderScreen(RestSettingsCard);
    expect(screen.queryByTestId("rest-sound-row")).toBeNull();
  });

  it("closes the choices when the permission goes and does not reopen them when it returns", () => {
    showing("on");
    renderScreen(RestSettingsCard);
    fireEvent.press(screen.getByRole("button", { name: /^Rest-over sound/ }));
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    act(() => showing("off"));
    expect(screen.queryByRole("radio")).toBeNull();

    act(() => showing("on"));
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
