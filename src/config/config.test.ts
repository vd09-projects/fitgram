// TICKET-074: config values that depend on each other. Each pair is checked
// where the code makes it matter; the reason is on the constant.

import { HISTORY_RECENT_SESSION_COUNT, HISTORY_TREND_SESSION_COUNT } from "./display";
import * as storageKeys from "./storageKeys";
import { STATS_RECENT_SESSION_CAP, STATS_VOLUME_HISTORY_CAP } from "./storedData";

describe("history sheet windows fit inside the stored rollup", () => {
  // `deriveExerciseHistory` shows `recentSessions.slice(0, count)`: past the cap it shows fewer than promised.
  it("shows no more sessions than the rollup stores", () => {
    expect(HISTORY_RECENT_SESSION_COUNT).toBeLessThanOrEqual(STATS_RECENT_SESSION_CAP);
  });

  // `volumeTrendFromStats` windows `volumeHistory`: past the cap it draws fewer bars than promised.
  it("draws no more trend points than the rollup stores", () => {
    expect(HISTORY_TREND_SESSION_COUNT).toBeLessThanOrEqual(STATS_VOLUME_HISTORY_CAP);
  });

  // `unitMismatch` scans only `recentSessions`. A wider trend could show a
  // point from an other-unit session it never scanned (see the constant).
  it("keeps the trend window inside the sessions unitMismatch scans", () => {
    expect(HISTORY_TREND_SESSION_COUNT).toBeLessThanOrEqual(STATS_RECENT_SESSION_CAP);
  });
});

// Two stores on one key would overwrite each other's data, and the reader would
// refuse or misread it. Every `*_KEY` export counts, so a new key is checked by
// being added to the file.
it("gives every AsyncStorage key its own name", () => {
  const keys = Object.entries(storageKeys).filter(([name]) => name.endsWith("_KEY"));
  const values = keys.map(([, value]) => value);
  expect(keys.length).toBeGreaterThan(0);
  expect(new Set(values).size).toBe(values.length);
});
