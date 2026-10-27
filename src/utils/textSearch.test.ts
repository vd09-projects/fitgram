// TICKET-043: the contract of the text layer, for any search built on it.
// Its own small word lists, not the exercise catalog.

import { buildTextDictionary, correctWord, inOrder, matchWithSplitWords, stemmed, wordsAt } from "./textSearch";

describe("correctWord", () => {
  const dictionary = buildTextDictionary(["bench", "press", "squat", "quad", "incline", "dumbbell", "dumbbells", "row"]);

  test("edits by length: 1–3 letters none, 4–5 one, 6+ two; a swap is one edit", () => {
    expect(correctWord(dictionary, "rwo")).toBeNull();
    expect(correctWord(dictionary, "bech")).toEqual({ candidates: ["bench"], distance: 1 });
    expect(correctWord(dictionary, "bnech")).toEqual({ candidates: ["bench"], distance: 1 });
    expect(correctWord(dictionary, "incliend")).toEqual({ candidates: ["incline"], distance: 2 });
    expect(correctWord(dictionary, "bxxch")).toBeNull(); // 2 edits, 5 letters
  });

  test("closest candidates only, all of them; a word that matches is never corrected; mid-typing counts", () => {
    expect(correctWord(dictionary, "squad")).toEqual({ candidates: ["squat", "quad"], distance: 1 });
    expect(correctWord(dictionary, "dumbell")).toEqual({ candidates: ["dumbbell"], distance: 1 }); // not "dumbbells", 2 edits
    expect(correctWord(dictionary, "pres")).toBeNull(); // a prefix of "press"
    expect(correctWord(dictionary, "dumbe")).toEqual({ candidates: ["dumbbell", "dumbbells"], distance: 1 });
  });
});

test("wordsAt: prefixes and joined words from a word boundary, never inside a word", () => {
  const name = stemmed("Lat Pulldown");
  expect(wordsAt(["pull"], name)).toBe(1);
  expect(wordsAt(["latpulldown"], name)).toBe(0);
  expect(wordsAt(["latpulldown"], name, false)).toBe(-1); // one word only
  expect(wordsAt(["rdl"], stemmed("Hurdle Hop"))).toBe(-1);
});

test("matchWithSplitWords retries adjacent pairs joined, only when the words fail", () => {
  const name = stemmed("Triceps Pushdown");
  const match = (terms: readonly string[]) => (terms.every((t) => wordsAt([t], name, false) >= 0) ? terms : null);
  const join = (a: string, b: string) => a + b;
  expect(matchWithSplitWords(["push", "down"], match, join)).toEqual(["pushdown"]);
  expect(matchWithSplitWords(["tricep", "push"], match, join)).toEqual(["tricep", "push"]);
  // Both readings match "Pulldown Pull Down": the words as typed win.
  const both = stemmed("Pulldown Pull Down");
  const matchBoth = (terms: readonly string[]) => (terms.every((t) => wordsAt([t], both, false) >= 0) ? terms : null);
  expect(matchWithSplitWords(["pull", "down"], matchBoth, join)).toEqual(["pull", "down"]);
  expect(inOrder([0, 2, 4])).toBe(true);
  expect(inOrder([2, 1, 0])).toBe(false);
});
