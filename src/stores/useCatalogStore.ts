import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCatalogDoc, fetchCatalogMeta, fetchSearchWordsDoc } from "../services/db/catalog";
import { useAuthStore } from "./authStore";
import {
  decideFetchedCatalog,
  decideFetchedSearchWords,
  planCatalogSync,
  readCachedCatalog,
  readCachedSearchWords,
  type LoadedCatalog,
  type LoadedSearchWords,
} from "../utils/catalogSync";
import { CATALOG_CACHE_KEY, SEARCH_WORDS_CACHE_KEY } from "../config/storageKeys";

/**
 * The exercise catalog on the phone (TICKET-042 stage 2).
 *
 * Firestore holds it (`exercise_catalog`); the phone keeps the last good copy in
 * AsyncStorage and loads it into memory at app start, so every name site works
 * offline. One `meta` read decides whether to fetch the catalog doc again: at
 * app start once a user is signed in (the rules need one), when Manage Workout
 * opens, and once per app run when a name site meets an id the catalog lacks.
 *
 * The search words (TICKET-043) ride on the same meta read and the same rules,
 * as a second doc with its own hash and cache: each doc is fetched only when
 * its own hash changed, and a refusal of one never blocks the other.
 *
 * Rejected: shipping it in the bundle (`expo-updates` is not installed, so
 * every catalog fix would be a new build for every tester; TICKET-042).
 */

// CATALOG_CACHE_KEY, SEARCH_WORDS_CACHE_KEY: value and reason in src/config/storageKeys.ts.

interface CatalogStore {
  catalog: LoadedCatalog | null;
  cacheLoaded: boolean;
  /** The hash of the last fetched catalog that `loadCatalog` refused. The cache was not touched. */
  refusedCatalogVersion: string | null;
  /** Null until loaded, or when none was ever uploaded: search then knows the labels only. */
  searchWords: LoadedSearchWords | null;
  /** As `refusedCatalogVersion`, for the search-words doc. */
  refusedSearchWordsVersion: string | null;
  /** Set once the unknown-id meta check has run in this app run (Q5: never again until restart). */
  unknownIdChecked: boolean;

  loadFromCache: () => Promise<void>;
  sync: () => Promise<void>;
  checkUnknownId: () => Promise<void>;
}

/** Shared by concurrent callers, so a start-up check and a screen focus issue one meta read. */
let cacheLoad: Promise<void> | null = null;
let syncInFlight: Promise<void> | null = null;

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  catalog: null,
  cacheLoaded: false,
  refusedCatalogVersion: null,
  searchWords: null,
  refusedSearchWordsVersion: null,
  unknownIdChecked: false,

  loadFromCache: () => {
    if (get().cacheLoaded) return Promise.resolve();
    if (cacheLoad) return cacheLoad;
    cacheLoad = (async () => {
      try {
        const { catalog, errors } = readCachedCatalog(await AsyncStorage.getItem(CATALOG_CACHE_KEY));
        if (errors.length > 0) console.error("Catalog cache refused; will refetch:", errors);
        const words = readCachedSearchWords(await AsyncStorage.getItem(SEARCH_WORDS_CACHE_KEY));
        if (words.errors.length > 0) console.error("Search words cache refused; will refetch:", words.errors);
        // Replaces outright (TICKET-078): `sync` is the only other writer and
        // awaits this first.
        set({ catalog, searchWords: words.searchWords, cacheLoaded: true });
      } catch (error) {
        console.error("Catalog cache unreadable:", error);
        set({ cacheLoaded: true });
      } finally {
        cacheLoad = null;
      }
    })();
    return cacheLoad;
  },

  /**
   * One meta read; then the catalog doc and the search-words doc each only on a
   * new hash or an empty cache. Never throws.
   */
  sync: () => {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      try {
        await get().loadFromCache();
        const meta = await fetchCatalogMeta();
        await syncCatalogDoc(meta.catalog);
        await syncSearchWordsDoc(meta.searchWords);
      } catch (error) {
        // Offline or refused by the rules: the caches stay as they were.
        console.log("Catalog check failed; using the cached catalog:", error);
      } finally {
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  },

  /**
   * A name site met an id the catalog lacks (a plan from a phone with a newer
   * catalog). Runs one sync per app run, never more: an id still unknown after
   * it is unknown on the server too, and the snapshot fallback shows. Call it
   * from an effect, never from render.
   */
  checkUnknownId: async () => {
    if (get().unknownIdChecked) return;
    set({ unknownIdChecked: true });
    await get().sync();
  },
}));

const getState = () => useCatalogStore.getState();
const setState = useCatalogStore.setState;

/** The catalog doc, if its hash changed. A refusal keeps the cache and returns. */
async function syncCatalogDoc(metaVersion: string | null): Promise<void> {
  if (planCatalogSync(getState().catalog, metaVersion) === "keep") return;
  // Already refused in this app run: this build cannot load it, so do not
  // re-download 282 KB on every Manage Workout visit, or log it again.
  // `refusedCatalogVersion` is memory only, so the next app run tries once
  // more; a reinstall may have brought the vocabulary.
  if (metaVersion === getState().refusedCatalogVersion) return;

  const decision = decideFetchedCatalog(await fetchCatalogDoc());
  if (decision.kind === "refuse") {
    // LOUD on purpose: a catalog using equipment or a muscle this build
    // lacks is refused whole (the build-first order, TICKET-042). Without
    // this line it reads as "the update did not show".
    console.error(
      `CATALOG REFUSED (hash ${metaVersion}); keeping ${getState().catalog?.version ?? "no catalog"}. ` +
        `Install a build that knows its vocabulary. Errors:`,
      decision.errors
    );
    setState({ refusedCatalogVersion: metaVersion });
    return;
  }

  const { version, movements } = decision.catalog;
  await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ version, movements }));
  setState({ catalog: decision.catalog });
}

/** The search words, by the same rules as the catalog doc, under their own hash. */
async function syncSearchWordsDoc(metaVersion: string | null): Promise<void> {
  if (planCatalogSync(getState().searchWords, metaVersion) === "keep") return;
  if (metaVersion === getState().refusedSearchWordsVersion) return;

  const decision = decideFetchedSearchWords(await fetchSearchWordsDoc());
  if (decision.kind === "refuse") {
    console.error(
      `SEARCH WORDS REFUSED (hash ${metaVersion}); keeping ${getState().searchWords?.version ?? "labels only"}. Errors:`,
      decision.errors
    );
    setState({ refusedSearchWordsVersion: metaVersion });
    return;
  }

  await AsyncStorage.setItem(SEARCH_WORDS_CACHE_KEY, JSON.stringify(decision.searchWords));
  setState({ searchWords: decision.searchWords });
}

let stopSignInWatch: (() => void) | null = null;

/**
 * Load the cache now, and run the start-up check once a user is signed in
 * (now, or when auth restores the session). Again on an account change, which
 * costs one meta read. Called once at app start.
 */
export function startCatalog(): void {
  const store = useCatalogStore.getState();
  store.loadFromCache();
  if (useAuthStore.getState().user) store.sync();
  if (stopSignInWatch) return;
  stopSignInWatch = useAuthStore.subscribe((state, previous) => {
    const uid = state.user?.uid;
    if (uid && uid !== previous.user?.uid) useCatalogStore.getState().sync();
  });
}
