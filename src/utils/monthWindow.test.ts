// TICKET-082 / 087: which months the phone keeps; the rule that measureWindow.ts measures.
import { chooseMonthsToKeep } from "./monthWindow";

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
