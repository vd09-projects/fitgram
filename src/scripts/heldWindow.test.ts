// TICKET-087: the held-window rule that measureWindow.ts measures.
import { selectHeldMonths } from "./heldWindow";

const months = (counts: Record<string, number>) => new Map(Object.entries(counts));

describe("selectHeldMonths", () => {
  it("stops at the month that reaches the minimum, newest months first", () => {
    const w = selectHeldMonths(months({ "2026-09": 60, "2026-10": 60, "2026-11": 60 }), 120);
    expect(w).toEqual({ held: ["2026-11", "2026-10"], heldCount: 120, older: ["2026-09"] });
  });

  it("takes a whole month more when the minimum falls inside it, never a part-month", () => {
    const w = selectHeldMonths(months({ "2026-09": 60, "2026-10": 60, "2026-11": 60 }), 121);
    expect(w.held).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(w.heldCount).toBe(180);
  });

  it("holds everything, with nothing older, when the history is shorter than the minimum", () => {
    const w = selectHeldMonths(months({ "2026-10": 5, "2026-11": 7 }), 180);
    expect(w).toEqual({ held: ["2026-11", "2026-10"], heldCount: 12, older: [] });
  });

  it("holds nothing from an empty history", () => {
    expect(selectHeldMonths(months({}), 180)).toEqual({ held: [], heldCount: 0, older: [] });
  });

  it("sorts months across a year boundary as dates, whatever order they were added in", () => {
    const w = selectHeldMonths(months({ "2026-01": 10, "2025-12": 10, "2025-11": 10 }), 15);
    expect(w.held).toEqual(["2026-01", "2025-12"]);
    expect(w.older).toEqual(["2025-11"]);
  });
});
