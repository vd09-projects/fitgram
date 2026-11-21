import { REST_SOUND_LABELS, SOUND_ROW_NEEDS_ANDROID, SOUND_ROW_NEEDS_ON } from "../../config/restNotification";
import { soundRowLine } from "./soundRow";

// TICKET-098: the sound needs the lock-screen row's permission, so the row opens only while that is On.
describe("soundRowLine", () => {
  it("shows the chosen sound's name and opens when the lock-screen row is On", () => {
    expect(soundRowLine("on", "alarm")).toEqual({ text: REST_SOUND_LABELS.alarm.name, enabled: true });
  });

  it("names the step above it, and does not open, when Off or Blocked", () => {
    expect(soundRowLine("off", "alarm")).toEqual({ text: SOUND_ROW_NEEDS_ON, enabled: false });
    expect(soundRowLine("blocked", "alarm")).toEqual({ text: SOUND_ROW_NEEDS_ANDROID, enabled: false });
  });
});
