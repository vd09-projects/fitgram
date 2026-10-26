// TICKET-042 stage 2, CLAUDE.md 3.1: "refetched only when its version changes",
// counted as Firestore doc reads at the SDK boundary (`getDoc`), with a fake
// server in place of Firestore. Nothing here reaches the network.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { useAuthStore } from "./authStore";
import { CATALOG_CACHE_KEY, startCatalog, useCatalogStore } from "./useCatalogStore";
import { CATALOG_ROW as ROW } from "../test/fixtures";
import { SEARCH_WORDS } from "../catalog/searchWords";

const server: Record<string, unknown> = {};

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  getDoc: jest.fn(async (path: string) => ({
    exists: () => server[path] !== undefined,
    data: () => server[path],
  })),
}));

const reads = () => (getDoc as jest.Mock).mock.calls.map(([path]) => path);
const upload = (version: string, movements: unknown[] = [ROW]) => {
  server["exercise_catalog/meta"] = { ...(server["exercise_catalog/meta"] as object), version };
  server["exercise_catalog/catalog"] = { version, movements };
};
const uploadWords = (version: string, words: unknown = SEARCH_WORDS) => {
  server["exercise_catalog/meta"] = { ...(server["exercise_catalog/meta"] as object), searchWordsVersion: version };
  server["exercise_catalog/search_words"] = { version, words };
};
const cacheOnPhone = (version: string) =>
  AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ version, movements: [ROW] }));
const cachedVersion = async () => JSON.parse((await AsyncStorage.getItem(CATALOG_CACHE_KEY)) ?? "null")?.version;
const sync = () => useCatalogStore.getState().sync();

beforeEach(async () => {
  useCatalogStore.setState(useCatalogStore.getInitialState(), true);
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  await AsyncStorage.clear();
  for (const key of Object.keys(server)) delete server[key];
  (getDoc as jest.Mock).mockClear();
});

describe("reads per check", () => {
  it("app start, unchanged hash: 1 read, the cache is used", async () => {
    await cacheOnPhone("h1");
    upload("h1");
    await sync();
    expect(reads()).toEqual(["exercise_catalog/meta"]);
    expect(useCatalogStore.getState().source).toBe("cache");
  });

  it("app start, changed hash: 2 reads, the cache is replaced", async () => {
    await cacheOnPhone("h1");
    upload("h2");
    await sync();
    expect(reads()).toEqual(["exercise_catalog/meta", "exercise_catalog/catalog"]);
    expect(await cachedVersion()).toBe("h2");
  });

  it("app start, empty cache: 2 reads; then opening Manage Workout: 1 more", async () => {
    upload("h1");
    await sync();
    expect(reads()).toHaveLength(2);
    expect(useCatalogStore.getState().source).toBe("network");

    await sync(); // AddExerciseScreen's focus effect
    expect(reads()).toEqual(["exercise_catalog/meta", "exercise_catalog/catalog", "exercise_catalog/meta"]);
  });

  it("an unknown id checks meta once per app run, never again", async () => {
    await cacheOnPhone("h1");
    upload("h1");
    await useCatalogStore.getState().checkUnknownId();
    await useCatalogStore.getState().checkUnknownId();
    expect(reads()).toEqual(["exercise_catalog/meta"]);
  });
});

it("a refused catalog keeps the old cache and says so loudly", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  await cacheOnPhone("h1");
  upload("h2", [{ ...ROW, versions: [{ ...ROW.versions[0], equipment: "hover_board" }] }]);
  await sync();

  expect(useCatalogStore.getState().catalog?.version).toBe("h1");
  expect(await cachedVersion()).toBe("h1");
  expect(useCatalogStore.getState().lastRefusal?.version).toBe("h2");
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/^CATALOG REFUSED/), expect.anything());

  // The same hash again in this app run: meta only, no second download or log.
  await sync();
  expect(reads()).toEqual(["exercise_catalog/meta", "exercise_catalog/catalog", "exercise_catalog/meta"]);
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});

it("sign-out keeps the catalog, in memory and on disk", async () => {
  upload("h1");
  startCatalog();
  useAuthStore.getState().setUser({ uid: "u1" } as User);
  await sync(); // joins the check the sign-in started
  expect(await cachedVersion()).toBe("h1");

  useAuthStore.getState().setUser(null);
  expect(useCatalogStore.getState().catalog?.version).toBe("h1");
  expect(await cachedVersion()).toBe("h1");
});

describe("search words: their own doc and hash (TICKET-043)", () => {
  it("a new slang word fetches only the search words, never the catalog again", async () => {
    upload("h1");
    uploadWords("w1");
    await sync();
    expect(reads()).toEqual(["exercise_catalog/meta", "exercise_catalog/catalog", "exercise_catalog/search_words"]);

    uploadWords("w2", { ...SEARCH_WORDS, muscles: { ...SEARCH_WORDS.muscles, guns: ["biceps"] } });
    await sync();
    expect(reads().slice(3)).toEqual(["exercise_catalog/meta", "exercise_catalog/search_words"]);
    expect(useCatalogStore.getState().searchWords?.words.muscles.guns).toEqual(["biceps"]);

    await sync(); // nothing changed: meta only
    expect(reads().slice(5)).toEqual(["exercise_catalog/meta"]);
  });

  it("refused search words keep the old ones and do not block a catalog update", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    upload("h1");
    uploadWords("w1");
    await sync();

    upload("h2");
    uploadWords("w2", { ...SEARCH_WORDS, muscles: { pecs: ["chets"] } });
    await sync();

    expect(useCatalogStore.getState().searchWords?.version).toBe("w1");
    expect(useCatalogStore.getState().catalog?.version).toBe("h2");
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^SEARCH WORDS REFUSED/), expect.anything());
    error.mockRestore();
  });
});
