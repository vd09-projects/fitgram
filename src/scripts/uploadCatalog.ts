// src/scripts/uploadCatalog.ts
//
//   npx tsx src/scripts/uploadCatalog.ts --dry-run   # print, write nothing, no credentials
//   npx tsx src/scripts/uploadCatalog.ts             # write exercise_catalog (admin key)
//
// Uploads TICKET-046's catalog (`src/catalog`) and TICKET-043's search words
// (`src/catalog/searchWords.ts`) to `exercise_catalog` as three docs, written in
// one batch so a phone never reads a meta without the docs it names:
//
//   meta          { version, searchWordsVersion, updatedAt, movementCount, versionCount }
//   catalog       { version, movements }
//   search_words  { version, words }
//
// Each `version` is a SHA-256 of that doc's content. Phones refetch a doc only
// when its own hash changes: a new slang word re-downloads ~1 KB, not the
// catalog, and re-uploading unchanged content costs them nothing.
//
// BUILD FIRST: a catalog using an equipment, muscle or measure key the phones'
// build does not know is refused whole by that build (TICKET-042). Upload only
// after a build with `catalogVocabulary.ts` as of this catalog is installed.
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { CATALOG } from "../catalog";
import { SEARCH_WORDS } from "../catalog/searchWords";
import { loadCatalog } from "../utils/catalog";
import { loadSearchWords } from "../utils/searchWords";
import { getAdminFirestore } from "./firebaseAdmin";

const DRY_RUN = process.argv.includes("--dry-run");
const COLLECTION = "exercise_catalog"; // services/db/catalog.ts: CATALOG_COLLECTION
const ONE_MIB = 1024 * 1024;

/** Firestore refuses an array directly inside an array. Returns the paths that have one. */
function nestedArrays(value: unknown, at = "movements"): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, i) =>
      Array.isArray(item) ? [`${at}[${i}]`] : nestedArrays(item, `${at}[${i}]`)
    );
  if (typeof value === "object" && value !== null)
    return Object.entries(value).flatMap(([key, item]) => nestedArrays(item, `${at}.${key}`));
  return [];
}

const uploadCatalog = async () => {
  // Through JSON first: drops `undefined` optional fields, which Firestore
  // rejects, and is exactly what the hash and the size are measured on.
  const json = JSON.stringify(CATALOG);
  const movements = JSON.parse(json);
  const version = createHash("sha256").update(json).digest("hex");

  const load = loadCatalog(movements);
  if (load.kind === "invalid") throw new Error(`Catalog refused by loadCatalog:\n  ${load.errors.join("\n  ")}`);
  const nested = nestedArrays(movements);
  if (nested.length > 0) throw new Error(`Arrays inside arrays (Firestore refuses): ${nested.slice(0, 5).join(", ")}`);

  const wordsJson = JSON.stringify(SEARCH_WORDS);
  const words = JSON.parse(wordsJson);
  const searchWordsVersion = createHash("sha256").update(wordsJson).digest("hex");
  const wordsLoad = loadSearchWords(words);
  if (wordsLoad.kind === "invalid")
    throw new Error(`Search words refused by loadSearchWords:\n  ${wordsLoad.errors.join("\n  ")}`);
  const searchWordsDoc = { version: searchWordsVersion, words };

  const movementCount = movements.length;
  const versionCount = load.index.size;
  const catalogDoc = { version, movements };
  const metaDoc = { version, searchWordsVersion, movementCount, versionCount };

  // JSON length approximates Firestore's own size count (field names plus
  // string bytes); not Firestore's exact figure.
  const catalogBytes = Buffer.byteLength(JSON.stringify(catalogDoc));
  const metaBytes = Buffer.byteLength(JSON.stringify(metaDoc)) + 8; // + updatedAt timestamp
  console.log(`exercise catalog${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`  version (sha256): ${version}`);
  console.log(`  movements: ${movementCount}, versions: ${versionCount}, loadCatalog: ok`);
  console.log(`  ${COLLECTION}/meta     ~${metaBytes} bytes`);
  console.log(
    `  ${COLLECTION}/catalog  ~${catalogBytes} bytes (${((catalogBytes / ONE_MIB) * 100).toFixed(1)}% of the 1 MiB doc cap)`
  );
  const counts = Object.entries(SEARCH_WORDS).map(([section, entries]) => `${section} ${Object.keys(entries).length}`);
  console.log(`  search words version (sha256): ${searchWordsVersion}`);
  console.log(
    `  ${COLLECTION}/search_words  ~${Buffer.byteLength(JSON.stringify(searchWordsDoc))} bytes (${counts.join(", ")}), loadSearchWords: ok`
  );

  if (catalogBytes > 0.9 * ONE_MIB) throw new Error("Catalog doc is over 90% of the 1 MiB cap: split it into chunks first.");

  if (DRY_RUN) {
    console.log("Dry run: nothing written.");
    return;
  }

  const db = await getAdminFirestore();
  const existing = await db.collection(COLLECTION).doc("meta").get();
  const live = existing.exists ? existing.data() : undefined;
  const catalogChanged = live?.version !== version;
  const wordsChanged = live?.searchWordsVersion !== searchWordsVersion;
  if (!catalogChanged && !wordsChanged) {
    console.log("Already uploaded with these hashes: nothing to write, phones refetch nothing.");
    return;
  }

  // Only the doc whose hash changed is written; meta always, with both hashes.
  const batch = db.batch();
  if (catalogChanged) batch.set(db.collection(COLLECTION).doc("catalog"), catalogDoc);
  if (wordsChanged) batch.set(db.collection(COLLECTION).doc("search_words"), searchWordsDoc);
  batch.set(db.collection(COLLECTION).doc("meta"), { ...metaDoc, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  console.log(
    `✅ Uploaded ${COLLECTION}: catalog ${catalogChanged ? "written" : "unchanged"}, ` +
      `search words ${wordsChanged ? "written" : "unchanged"} (was ${live?.version ?? "empty"} / ${live?.searchWordsVersion ?? "none"}).`
  );
};

uploadCatalog()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Catalog upload failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
