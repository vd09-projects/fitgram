// src/scripts/docSize.ts
//
// Two sizes of one doc, for the TICKET-087 measurements. Pure.
//
// - `jsonBytes`: UTF-8 length of `JSON.stringify`, which is what AsyncStorage
//   holds for the phone's copy of the doc.
// - `firestoreBytes`: Firestore's documented stored-size rule (name + 32, each
//   field name + value): string = UTF-8 + 1, number and timestamp = 8, boolean
//   and null = 1, array = sum of values, map = sum of (key + 1 + value). This is
//   the size Firestore's 1 MiB doc limit counts, so it is the one to compare
//   against that limit. It is the documented rule applied by hand, not a number
//   Firestore reported, so treat it as an estimate good to a few percent.
//
// Both run on plain data (a Timestamp is read through its `toMillis`), so the
// fixture generator and the real-account reader share one meter.

const utf8 = (value: string) => Buffer.byteLength(value, "utf8");

const isTimestamp = (value: unknown): value is { toMillis: () => number } =>
  typeof value === "object" && value !== null && typeof (value as { toMillis?: unknown }).toMillis === "function";

function valueBytes(value: unknown): number {
  if (value === null || value === undefined || typeof value === "boolean") return 1;
  if (typeof value === "number" || isTimestamp(value)) return 8;
  if (typeof value === "string") return utf8(value) + 1;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + valueBytes(item), 0);
  return Object.entries(value as Record<string, unknown>).reduce(
    (sum, [key, item]) => sum + utf8(key) + 1 + valueBytes(item),
    0
  );
}

/** `path` is the full doc path, e.g. `users/{uid}/sessions/{id}`; segments count as strings. */
export function firestoreBytes(path: string, data: Record<string, unknown>): number {
  const nameBytes = path.split("/").reduce((sum, segment) => sum + utf8(segment) + 1, 0) + 16;
  return nameBytes + 32 + valueBytes(data);
}

export function jsonBytes(value: unknown): number {
  return utf8(JSON.stringify(value));
}

/** Median and max of a list, for the size tables. Empty list: nulls, never 0. */
export function summarise(values: number[]): { n: number; median: number | null; max: number | null } {
  if (values.length === 0) return { n: 0, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { n: sorted.length, median, max: sorted[sorted.length - 1] };
}
