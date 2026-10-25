// TICKET-042 stage 2: which reads a meta check leads to, and when a fetched
// catalog may replace the cache.

import { CATALOG_ROW as ROW } from "../test/fixtures";
import { decideFetchedCatalog, planCatalogSync, readCachedCatalog } from "./catalogSync";

describe("planCatalogSync", () => {
  it.each([
    ["empty cache", "fetch", null, "h1"],
    ["same hash", "keep", { version: "h1" }, "h1"],
    ["new hash", "fetch", { version: "h1" }, "h2"],
    ["nothing uploaded, cache kept", "keep", { version: "h1" }, null],
    ["nothing uploaded, no cache", "keep", null, null],
  ] as const)("%s → %s", (_label, expected, cached, meta) => {
    expect(planCatalogSync(cached, meta)).toBe(expected);
  });
});

describe("decideFetchedCatalog", () => {
  it("applies a valid catalog under the doc's own hash", () => {
    const decision = decideFetchedCatalog({ version: "h2", movements: [ROW] });
    expect(decision.kind).toBe("apply");
    if (decision.kind === "apply") {
      expect(decision.catalog.version).toBe("h2");
      expect(decision.catalog.index.has("row__barbell")).toBe(true);
    }
  });

  it("refuses a catalog this build's vocabulary does not know, and one with no hash", () => {
    const unknownEquipment = { ...ROW, versions: [{ ...ROW.versions[0], equipment: "hover_board" }] };
    const refused = decideFetchedCatalog({ version: "h2", movements: [unknownEquipment] });
    expect(refused.kind).toBe("refuse");
    if (refused.kind === "refuse") expect(refused.errors.join()).toMatch(/hover_board/);

    expect(decideFetchedCatalog({ movements: [ROW] }).kind).toBe("refuse");
  });
});

it("treats an unreadable cache as absent, so the next check fetches", () => {
  expect(readCachedCatalog("{not json").catalog).toBeNull();
  expect(readCachedCatalog(JSON.stringify({ version: "h1", movements: [ROW] })).catalog?.version).toBe("h1");
});
