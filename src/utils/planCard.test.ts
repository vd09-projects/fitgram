import { planCardHeader } from "./planCard";
import { partsToString } from "./startWorkout";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const NOW = at(20, 8);

const header = (lastDoneAt: number | null, lastEndedAt: number | null, exerciseCount = 6, sessionsKnown = true) => {
  const h = planCardHeader({ exerciseCount, lastDoneAt, lastEndedAt }, sessionsKnown, NOW);
  return {
    big: partsToString(h.big),
    caption: h.caption,
    meta: partsToString(h.meta),
    compact: partsToString(h.compact),
  };
};

describe("planCardHeader", () => {
  it("counts calendar days, then weeks from day 14, with the session's minutes", () => {
    expect(header(at(11, 18), at(11, 18, 50))).toEqual({
      big: "9",
      caption: "days since last",
      meta: "6 exercises · about 50 min last time",
      compact: "9 days since last · 6 exercises",
    });
    // 23:00 the night before is one day, not zero.
    expect(header(at(19, 23), at(19, 23, 40)).caption).toBe("day since last");
    expect(header(at(7, 9), null).big).toBe("13");
    expect(header(at(6, 9), null)).toMatchObject({ big: "2", caption: "weeks since last" });
  });

  it("reads today as a word, not 0", () => {
    expect(header(at(20, 6), at(20, 7), 1)).toEqual({
      big: "today",
      caption: "last done",
      meta: "1 exercise · about 60 min last time",
      compact: "last done today · 1 exercise",
    });
  });

  it("shows a dash, never new or 0, when there is no session, and says whether it looked", () => {
    expect(header(null, null)).toMatchObject({ big: "—", caption: "no recent session", meta: "6 exercises" });
    expect(header(null, null, 6, false)).toMatchObject({ big: "—", caption: "last session unknown" });
  });

  it("drops the minutes rather than show a wrong one", () => {
    expect(header(at(11, 18), at(11, 17)).meta).toBe("6 exercises");
    expect(header(at(11, 18), at(11, 18)).meta).toBe("6 exercises");
    expect(header(at(11, 18), at(11, 18) + 20_000).meta).toBe("6 exercises · under 1 min last time");
  });
});
