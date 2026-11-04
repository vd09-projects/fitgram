import { savedSummary } from "./sessionDuration";

const MIN = 60_000;

describe("savedSummary", () => {
  it("names the workout with its minutes, rounded", () => {
    expect(savedSummary("Shoulders & Core", 0, 52 * MIN + 20_000)).toBe("Shoulders & Core · 52 min");
  });

  it("says under 1 min rather than 0 min", () => {
    expect(savedSummary("Push", 0, 20_000)).toBe("Push · under 1 min");
  });

  it("drops the minutes when the clock moved back", () => {
    expect(savedSummary("Push", 10 * MIN, 5 * MIN)).toBe("Push");
  });
});
