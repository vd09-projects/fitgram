// TICKET-043: the search-words loader. It refuses the whole doc on any entry
// this build cannot use, like `loadCatalog`.

import { SEARCH_WORDS } from "../catalog/searchWords";
import { loadSearchWords } from "./searchWords";

it("loads the source that the upload sends", () => {
  expect(loadSearchWords(SEARCH_WORDS)).toEqual({ kind: "ok", words: SEARCH_WORDS });
});

it("refuses an entry pointing at a key this build does not know, naming each", () => {
  const load = loadSearchWords({
    ...SEARCH_WORDS,
    muscles: { ...SEARCH_WORDS.muscles, pecs: ["chets"] },
    equipment: { ...SEARCH_WORDS.equipment, hb: ["hover_board"] },
    axes: { ...SEARCH_WORDS.axes, wide: { axis: "grip", value: "wide" } },
  });
  expect(load.kind).toBe("invalid");
  if (load.kind === "invalid") {
    expect(load.errors).toHaveLength(3);
    expect(load.errors.join("\n")).toMatch(/chets[\s\S]*hover_board[\s\S]*wide/);
  }
});
