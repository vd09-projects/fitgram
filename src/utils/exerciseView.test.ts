import { DEFAULT_EXERCISE_VIEW, isChangedView, olderPageUseful, sessionsLabel, showsGraph, showsList } from "./exerciseView";
import { EXERCISE_GRAPH_SESSIONS } from "../config/display";

describe("the view options", () => {
  it("starts with the average weight, graph and list, the graph's session count, and both Details on, and is changed by any one setting", () => {
    expect(DEFAULT_EXERCISE_VIEW).toEqual({ measure: "average", show: "both", sessions: EXERCISE_GRAPH_SESSIONS, effort: true, marks: true });
    expect(isChangedView(DEFAULT_EXERCISE_VIEW)).toBe(false);
    for (const change of [{ measure: "total" }, { show: "list" }, { sessions: null }, { sessions: 5 }, { effort: false }, { marks: false }] as const) {
      expect(isChangedView({ ...DEFAULT_EXERCISE_VIEW, ...change })).toBe(true);
    }
  });

  it("offers older sessions only when they would be shown, and says which of graph and list a setting draws", () => {
    expect(olderPageUseful(10, 4)).toBe(true);
    expect(olderPageUseful(10, 10)).toBe(false); // ten shown already: an older page would change nothing on screen
    expect(olderPageUseful(null, 400)).toBe(true);
    expect([showsGraph("both"), showsGraph("graph"), showsGraph("list")]).toEqual([true, true, false]);
    expect([showsList("both"), showsList("graph"), showsList("list")]).toEqual([true, false, true]);
    expect([sessionsLabel(5), sessionsLabel(null)]).toEqual(["Last 5", "All"]);
  });
});
