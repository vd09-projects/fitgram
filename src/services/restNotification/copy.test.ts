import { DEFAULT_REST_SOUND, REST_NOTIF_TEXT_BUDGET } from "../../config/restNotification";
import { buildRestCopy } from "./copy";

describe("buildRestCopy", () => {
  it("fills the exercise and the set into both lines", () => {
    const copy = buildRestCopy("Bench Press", 3);
    expect(copy.text).toContain("Bench Press");
    expect(copy.text).toContain("3");
    expect(copy.textDone).toContain("Bench Press");
  });

  it("cuts a long exercise with an ellipsis and keeps the set number", () => {
    const copy = buildRestCopy("Incline Dumbbell Bulgarian Split Squat", 12);
    for (const line of [copy.text, copy.textDone]) {
      expect(line.length).toBeLessThanOrEqual(REST_NOTIF_TEXT_BUDGET);
      expect(line).toContain("…");
      expect(line).toContain("12");
    }
  });

  it("drops an empty name and its separator, so no line reads 'Next:  · set 2'", () => {
    const copy = buildRestCopy("", 2);
    expect(copy.text).not.toMatch(/·|\s{2}/);
    expect(copy.text).toContain("2");
    expect(copy.textDone).not.toMatch(/^\s|·/);
  });

  // TICKET-097: the countdown channel is silent and the end-of-rest one is not, so the native side needs both names.
  it("names both channels, and they differ", () => {
    const copy = buildRestCopy("Squat", 1);
    expect(copy.channelName).not.toBe("");
    expect(copy.doneChannelName).not.toBe("");
    expect(copy.doneChannelName).not.toBe(copy.channelName);
  });

  // TICKET-098: the chosen sound travels with the copy; without a choice it is the default's.
  it("carries the chosen sound, and the default when none is given", () => {
    expect(buildRestCopy("Squat", 1, "alarm").sound).toBe("alarm");
    expect(buildRestCopy("Squat", 1).sound).toBe(DEFAULT_REST_SOUND);
  });

  it("does not cut a name that fits", () => {
    expect(buildRestCopy("Squat", 1).text).not.toContain("…");
  });
});
