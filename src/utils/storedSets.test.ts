// TICKET-055: a stored set is read without trusting it. A set that is not
// `{ segments, effort }` says so; it never reads as a plausible set.

import { decodeStoredSet } from "./storedSets";

const FIRST = { Weight: "20", Reps: "5" };
const SPLIT = { Weight: "17.5", Reps: "3" };

describe("decodeStoredSet", () => {
  it("reads a set as written, and an unknown mark as unmarked", () => {
    expect(decodeStoredSet({ segments: [FIRST, SPLIT], effort: "hard" })).toEqual({
      segments: [FIRST, SPLIT],
      segmentsIncomplete: false,
      effort: "hard",
    });
    expect(decodeStoredSet({ segments: [FIRST], effort: "meh" }).effort).toBeNull();
  });

  it("keeps a readable first segment but flags the set when a later one is not a segment", () => {
    expect(decodeStoredSet({ segments: [FIRST, [SPLIT]], effort: null })).toEqual({
      segments: [FIRST],
      segmentsIncomplete: true,
      effort: null,
    });
  });

  it("reads a doc from before TICKET-055 (a bare map of values) as unreadable, not as a set", () => {
    expect(decodeStoredSet(FIRST)).toEqual({ segments: [{}], segmentsIncomplete: true, effort: null });
  });
});
