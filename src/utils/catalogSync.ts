// src/utils/catalogSync.ts
//
// The decisions behind the phone's catalog cache (TICKET-042 stage 2), as pure
// functions: whether a meta read means a catalog read, and whether a fetched
// catalog replaces the cache. `useCatalogStore` does the I/O around them.

import { loadCatalog, type CatalogIndex } from "./catalog";
import type { Movement } from "../types/catalog";

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
 * The cache read back from AsyncStorage, or null. A cache that no longer loads
 * (written by a build whose vocabulary this one lacks, or a corrupt write) is
 * treated as absent, so the next meta check fetches a fresh copy.
 */
export function readCachedCatalog(raw: string | null): { catalog: LoadedCatalog | null; errors: string[] } {
  if (raw === null) return { catalog: null, errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { catalog: null, errors: [`cache: unreadable JSON (${String(error)})`] };
  }
  const decision = decideFetchedCatalog(parsed);
  return decision.kind === "apply"
    ? { catalog: decision.catalog, errors: [] }
    : { catalog: null, errors: decision.errors };
}
