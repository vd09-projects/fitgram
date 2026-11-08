import type { ExerciseStatsDoc } from "../types/workoutSession";
import {
  mergeSummaries,
  readStoredSummaries,
  serializeStoredSummaries,
  storedSummariesKeys,
  summariesLastSeenAfter,
  summariesRunFor,
  summaryEntry,
  type HeldSummaries,
} from "./exerciseSummariesSync";
import { EXERCISE_SUMMARIES_STORAGE_KEY, exerciseSummariesShardKey } from "../config/storageKeys";

const stamp = (seconds: number) => ({ seconds, nanoseconds: 0 });
const summary = (exerciseId: string, seconds?: number, lastPerformedAt = 100) =>
  ({
    exerciseId,
    exerciseName: exerciseId,
    lastPerformedAt,
    fields: [],
    recentSessions: [],
    bestByReps: {},
    volumeHistory: [],
    ...(seconds === undefined ? {} : { updatedAt: stamp(seconds) }),
  }) as ExerciseStatsDoc;

describe("mergeSummaries", () => {
  it("a stamped copy beats an unstamped one and a newer stamp beats an older, whichever arrives", () => {
    const unstamped = summary("bench", undefined, 300);
    const older = summary("squat", 5, 300);
    const merged = mergeSummaries({ bench: unstamped, squat: older }, [summary("bench", 1, 100), summary("squat", 4, 900), summary("row", 2)]);
    expect(merged.bench.updatedAt).toEqual(stamp(1));
    expect(merged.squat).toBe(older); // an older stamp never replaces, even with a later workout in it
    expect(Object.keys(merged).sort()).toEqual(["bench", "row", "squat"]);
  });
});

describe("summariesLastSeenAfter", () => {
  it("a change check only moves forward; a full load takes the answer's newest, even if older", () => {
    const docs = [summary("a", 3), summary("b", 7), summary("c")];
    expect(summariesLastSeenAfter("change", stamp(9), docs)).toEqual(stamp(9));
    expect(summariesLastSeenAfter("change", stamp(5), docs)).toEqual(stamp(7));
    expect(summariesLastSeenAfter("full", stamp(9), docs)).toEqual(stamp(7));
    expect(summariesLastSeenAfter("full", stamp(9), [summary("old")])).toBeNull();
  });
});

describe("summariesRunFor", () => {
  it("a first load when nothing is held, a check when something is, nothing inside the skip", () => {
    expect(summariesRunFor({ byId: null, lastSeen: null }, false, false)?.kind).toBe("full");
    expect(summariesRunFor({ byId: {}, lastSeen: stamp(1) }, false, false)).toEqual({ kind: "change", seenAtStart: stamp(1) });
    expect(summariesRunFor({ byId: {}, lastSeen: null }, true, false)).toBeNull();
  });
});

describe("summaryEntry", () => {
  const base = { exerciseId: "bench", stats: undefined, checking: false, waitOver: false, lastResult: null, lastError: null } as const;

  it('"never done" needs a successful answer: unknown while unloaded, loading or after a failure', () => {
    expect(summaryEntry({ ...base, lastResult: "ok" }).status).toBe("ready");
    expect(summaryEntry(base).status).toBe("idle");
    expect(summaryEntry({ ...base, checking: true }).status).toBe("loading");
    expect(summaryEntry({ ...base, lastResult: "failed", lastError: "offline" })).toMatchObject({ status: "error", error: "offline" });
    expect(summaryEntry({ ...base, checking: true, waitOver: true }).status).toBe("error");
  });

  it("a held summary stays ready through a failed check, and says the check failed", () => {
    const stats = summary("bench", 1);
    expect(summaryEntry({ ...base, stats, lastResult: "failed", lastError: "offline" })).toEqual({ exerciseId: "bench", status: "ready", stats, error: "offline" });
  });
});

describe("the stored copy", () => {
  const SHARDS = 4;
  const held: HeldSummaries = {
    byId: Object.fromEntries(["bench", "squat", "row", "curl", "press", "dip"].map((id, i) => [id, summary(id, i)])),
    lastSeen: stamp(5),
    lastFullAt: 1_000,
  };
  const rows = () => serializeStoredSummaries("u1", SHARDS, held);
  const without = (key: string) => rows().filter(([k]) => k !== key);
  const replaced = (key: string, value: string) => rows().map(([k, v]): [string, string] => [k, k === key ? value : v]);

  it("round trips across its keys, every doc split out of the head", () => {
    const pairs = rows();
    expect(pairs.map(([key]) => key)).toEqual(storedSummariesKeys(SHARDS));
    expect(pairs[0][1]).not.toContain("bench");
    expect(pairs.slice(1).filter(([, value]) => value !== "[]").length).toBeGreaterThan(1);
    expect(readStoredSummaries(pairs, "u1", SHARDS)).toEqual({ held, error: null });
  });

  it("refuses the whole copy on any doubt, never part of it", () => {
    const refused = (input: readonly (readonly [string, string | null])[], uid = "u1", shards = SHARDS) =>
      expect(readStoredSummaries(input, uid, shards).held).toBeNull();
    refused(without(exerciseSummariesShardKey(2)));
    refused(replaced(exerciseSummariesShardKey(1), "not json"));
    refused(replaced(exerciseSummariesShardKey(1), JSON.stringify([{ exerciseId: "bench" }])));
    refused(replaced(EXERCISE_SUMMARIES_STORAGE_KEY, JSON.stringify({ formatVersion: 1, uid: "u1", shards: SHARDS, lastSeen: "x", lastFullAt: null })));
    refused(rows(), "someone-else");
    refused(rows(), "u1", 2); // fewer: every key it reads exists, the rest of the docs do not
    expect(readStoredSummaries(storedSummariesKeys(SHARDS).map((key) => [key, null]), "u1", SHARDS)).toEqual({ held: null, error: null });
  });
});
