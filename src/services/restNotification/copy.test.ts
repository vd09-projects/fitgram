import { REST_NOTIF_TEXT_BUDGET } from "../../config/restNotification";
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

  it("does not cut a name that fits", () => {
    expect(buildRestCopy("Squat", 1).text).not.toContain("…");
  });
});
