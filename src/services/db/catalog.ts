// src/services/db/catalog.ts
//
// The reads of the shared exercise catalog (TICKET-042 stage 2). All are
// doc gets by id, so no index is needed. Written only by
// src/scripts/uploadCatalog.ts with admin credentials; the rules refuse every
// client write.
//
//   exercise_catalog/meta          { version, searchWordsVersion, updatedAt, movementCount, versionCount }
//   exercise_catalog/catalog       { version, movements }
//   exercise_catalog/search_words  { version, words }   (TICKET-043, ~1 KB)
//
// One meta read holds both hashes, so checking both docs costs one read.
//
// One catalog doc, not chunks: the catalog is 282 KB as JSON, 27% of the 1 MiB
// doc cap (measured in TICKET-046). Chunks would cost a read each and a check
// that they came from one upload. Split if it passes about 70%.

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const CATALOG_COLLECTION = "exercise_catalog";
export const CATALOG_META_DOC = "meta";
export const CATALOG_DOC = "catalog";
export const SEARCH_WORDS_DOC = "search_words";

export type CatalogMeta = { catalog: string | null; searchWords: string | null };

/**
 * Both hashes from `meta`; each null when that doc has not been uploaded (no
 * meta at all, or a meta from before TICKET-043 with no `searchWordsVersion`).
 * Throws offline or on a refusal.
 */
export async function fetchCatalogMeta(): Promise<CatalogMeta> {
  const snap = await getDoc(doc(db, CATALOG_COLLECTION, CATALOG_META_DOC));
  const data = snap.exists() ? snap.data() : undefined;
  const hash = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  return { catalog: hash(data?.version), searchWords: hash(data?.searchWordsVersion) };
}

/** The catalog doc's raw data, untyped: `decideFetchedCatalog` checks it. Null when absent. */
export async function fetchCatalogDoc(): Promise<unknown> {
  const snap = await getDoc(doc(db, CATALOG_COLLECTION, CATALOG_DOC));
  return snap.exists() ? snap.data() : null;
}

/** The search-words doc's raw data, untyped: `decideFetchedSearchWords` checks it. Null when absent. */
export async function fetchSearchWordsDoc(): Promise<unknown> {
  const snap = await getDoc(doc(db, CATALOG_COLLECTION, SEARCH_WORDS_DOC));
  return snap.exists() ? snap.data() : null;
}
