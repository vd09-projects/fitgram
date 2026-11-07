// TICKET-074: config values that depend on each other. Each pair is checked
// where the code makes it matter; the reason is on the constant.

import { HISTORY_RECENT_SESSION_COUNT, HISTORY_TREND_SESSION_COUNT } from "./display";
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
