// src/utils/catalogSync.ts
//
// The decisions behind the phone's catalog cache (TICKET-042 stage 2), as pure
// functions: whether a meta read means a catalog read, and whether a fetched
// catalog replaces the cache. `useCatalogStore` does the I/O around them.

import { loadCatalog, type CatalogIndex } from "./catalog";
import { loadSearchWords } from "./searchWords";
import type { Movement, SearchWords } from "../types/catalog";

/** What the phone keeps in AsyncStorage: the catalog and the hash it was uploaded under. */
export type CachedCatalog = { version: string; movements: readonly Movement[] };

/** A cache that passed `loadCatalog`, ready for name sites. */
export type LoadedCatalog = CachedCatalog & { index: CatalogIndex };

/**
 * After reading `meta`: fetch the catalog doc, or keep what is cached.
 *
 * - no meta on the server (nothing uploaded yet): keep the cache, fetch nothing
 * - no cache, or a different hash: fetch
 * - same hash: keep. A content hash, not a date: re-uploading the same content
 *   refetches nothing, and phone clocks do not matter
 */
export function planCatalogSync(
  cached: { version: string } | null,
  metaVersion: string | null
): "fetch" | "keep" {
  if (metaVersion === null) return "keep";
  if (cached === null) return "fetch";
  return cached.version === metaVersion ? "keep" : "fetch";
}

export type FetchedCatalogDecision =
  | { kind: "apply"; catalog: LoadedCatalog }
  | { kind: "refuse"; errors: string[] };

/**
 * A fetched catalog doc replaces the cache only if it loads whole. Refused:
 * a doc with no `version` string, and anything `loadCatalog` refuses (an older
 * build meeting a newer vocabulary, a malformed upload). The caller keeps the
 * previous cache on a refusal; it never applies part of one.
 *
 * The version kept is the catalog doc's own, not meta's: an upload landing
 * between the meta read and this one leaves the cache labelled with what it
 * holds, which costs at most one extra fetch next time.
 */
export function decideFetchedCatalog(doc: unknown): FetchedCatalogDecision {
  if (typeof doc !== "object" || doc === null) return { kind: "refuse", errors: ["catalog doc: missing"] };
  const { version, movements } = doc as { version?: unknown; movements?: unknown };
  if (typeof version !== "string" || version === "")
    return { kind: "refuse", errors: ["catalog doc: no version hash"] };
  if (!Array.isArray(movements)) return { kind: "refuse", errors: ["catalog doc: movements is not a list"] };

  const load = loadCatalog(movements as Movement[]);
  if (load.kind === "invalid") return { kind: "refuse", errors: load.errors };
  return { kind: "apply", catalog: { version, movements: load.movements, index: load.index } };
}

/**
 * The search words (TICKET-043), as the phone keeps them: their own doc,
 * `exercise_catalog/search_words`, under their own hash (`meta.searchWordsVersion`),
 * so a new slang word downloads about 1 KB, not the 282 KB catalog. Rejected:
 * a field in the catalog doc, which made every slang change a full re-download
 * and let one bad word block a catalog update (user, 2026-10-27).
 */
export type LoadedSearchWords = { version: string; words: SearchWords };

/** As `decideFetchedCatalog`, for the search-words doc: whole or refused. */
export function decideFetchedSearchWords(
  doc: unknown
): { kind: "apply"; searchWords: LoadedSearchWords } | { kind: "refuse"; errors: string[] } {
  if (typeof doc !== "object" || doc === null) return { kind: "refuse", errors: ["search words doc: missing"] };
  const { version, words } = doc as { version?: unknown; words?: unknown };
  if (typeof version !== "string" || version === "")
    return { kind: "refuse", errors: ["search words doc: no version hash"] };
  const load = loadSearchWords(words);
  if (load.kind === "invalid") return { kind: "refuse", errors: load.errors };
  return { kind: "apply", searchWords: { version, words: load.words } };
}

/** JSON from AsyncStorage through a doc's own decision. Unreadable or refused = absent. */
function readCached<T>(
  raw: string | null,
  decide: (doc: unknown) => { kind: "apply"; value: T } | { kind: "refuse"; errors: string[] }
): { value: T | null; errors: string[] } {
  if (raw === null) return { value: null, errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { value: null, errors: [`cache: unreadable JSON (${String(error)})`] };
  }
  const decision = decide(parsed);
  return decision.kind === "apply" ? { value: decision.value, errors: [] } : { value: null, errors: decision.errors };
}

/**
 * The cache read back from AsyncStorage, or null. A cache that no longer loads
 * (written by a build whose vocabulary this one lacks, or a corrupt write) is
 * treated as absent, so the next meta check fetches a fresh copy.
 */
export function readCachedCatalog(raw: string | null): { catalog: LoadedCatalog | null; errors: string[] } {
  const { value, errors } = readCached(raw, (doc) => {
    const d = decideFetchedCatalog(doc);
    return d.kind === "apply" ? { kind: "apply", value: d.catalog } : d;
  });
  return { catalog: value, errors };
}

/** As `readCachedCatalog`, for the search words. */
export function readCachedSearchWords(raw: string | null): { searchWords: LoadedSearchWords | null; errors: string[] } {
  const { value, errors } = readCached(raw, (doc) => {
    const d = decideFetchedSearchWords(doc);
    return d.kind === "apply" ? { kind: "apply", value: d.searchWords } : d;
  });
  return { searchWords: value, errors };
}
