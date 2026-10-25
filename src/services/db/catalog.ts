// src/services/db/catalog.ts
//
// The two reads of the shared exercise catalog (TICKET-042 stage 2). Both are
// doc gets by id, so no index is needed. Written only by
// src/scripts/uploadCatalog.ts with admin credentials; the rules refuse every
// client write.
//
//   exercise_catalog/meta     { version, updatedAt, movementCount, versionCount }
//   exercise_catalog/catalog  { version, movements }
//
// One catalog doc, not chunks: the catalog is 282 KB as JSON, 27% of the 1 MiB
// doc cap (measured in TICKET-046). Chunks would cost a read each and a check
// that they came from one upload. Split if it passes about 70%.

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const CATALOG_COLLECTION = "exercise_catalog";
export const CATALOG_META_DOC = "meta";
export const CATALOG_DOC = "catalog";

/**
 * TEMPORARY — remove with CatalogDebugScreen. Firestore reads issued by this
 * module since the app started, so the "refetched only when its version
 * changes" claim can be counted on a device.
 */
export const catalogReadCounter = { meta: 0, catalog: 0 };

/** `meta.version`, or null when no catalog has been uploaded. Throws offline or on a refusal. */
export async function fetchCatalogMetaVersion(): Promise<string | null> {
  catalogReadCounter.meta += 1; // TEMPORARY
  const snap = await getDoc(doc(db, CATALOG_COLLECTION, CATALOG_META_DOC));
  if (!snap.exists()) return null;
  const version = snap.data()?.version;
  return typeof version === "string" && version !== "" ? version : null;
}

/** The catalog doc's raw data, untyped: `decideFetchedCatalog` checks it. Null when absent. */
export async function fetchCatalogDoc(): Promise<unknown> {
  catalogReadCounter.catalog += 1; // TEMPORARY
  const snap = await getDoc(doc(db, CATALOG_COLLECTION, CATALOG_DOC));
  return snap.exists() ? snap.data() : null;
}
