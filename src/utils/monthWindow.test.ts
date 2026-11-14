// TICKET-082 / 087: which months the phone keeps; the rule that measureWindow.ts measures.
import { chooseMonthsToKeep, localMonthRange } from "./monthWindow";

const months = (counts: Record<string, number>) => new Map(Object.entries(counts));

describe("chooseMonthsToKeep", () => {
  it("stops at the month that reaches the minimum, newest months first", () => {
    const w = chooseMonthsToKeep(months({ "2026-09": 60, "2026-10": 60, "2026-11": 60 }), 120);
    expect(w).toEqual({ keptMonths: ["2026-11", "2026-10"], keptCount: 120, olderMonths: ["2026-09"] });
  });

  it("takes a whole month more when the minimum falls inside it, never a part-month", () => {
    const w = chooseMonthsToKeep(months({ "2026-09": 60, "2026-10": 60, "2026-11": 60 }), 121);
    expect(w.keptMonths).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(w.keptCount).toBe(180);
  });

  it("holds everything, with nothing older, when the history is shorter than the minimum", () => {
    const w = chooseMonthsToKeep(months({ "2026-10": 5, "2026-11": 7 }), 180);
    expect(w).toEqual({ keptMonths: ["2026-11", "2026-10"], keptCount: 12, olderMonths: [] });
  });

  it("holds nothing from an empty history", () => {
    expect(chooseMonthsToKeep(months({}), 180)).toEqual({ keptMonths: [], keptCount: 0, olderMonths: [] });
  });

  it("sorts months across a year boundary as dates, whatever order they were added in", () => {
    const w = chooseMonthsToKeep(months({ "2026-01": 10, "2025-12": 10, "2025-11": 10 }), 15);
    expect(w.keptMonths).toEqual(["2026-01", "2025-12"]);
    expect(w.olderMonths).toEqual(["2025-11"]);
  });
});

describe("localMonthRange", () => {
  // The suite runs in Los Angeles (src/test/globalSetup.js), where the clock goes back on 1 Nov 2026.
  it("is the local calendar month, so a month with a clock change is not 30 days long", () => {
    const { from, to } = localMonthRange("2026-11");
    expect(from).toBe(new Date(2026, 10, 1).getTime());
    expect(to).toBe(new Date(2026, 11, 1).getTime());
    expect(to - from).toBe(30 * 86_400_000 + 3_600_000); // the repeated hour
  });

  it("December ends at the first instant of January, and the months do not overlap", () => {
    expect(localMonthRange("2026-12").to).toBe(new Date(2027, 0, 1).getTime());
    expect(localMonthRange("2026-10").to).toBe(localMonthRange("2026-11").from);
  });

  it("refuses a key that is not a month, never a range that reads as an empty month", () => {
    for (const bad of ["2026-13", "2026-00", "2026-1", "Nov 2026", ""]) expect(() => localMonthRange(bad)).toThrow("Not a month key");
  });
});
