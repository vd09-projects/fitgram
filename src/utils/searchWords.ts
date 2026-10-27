// src/utils/searchWords.ts
//
// The loader for the search vocabulary (TICKET-043): `exercise_catalog/search_words`
// arrives from Firestore as untyped JSON, so every entry is checked against the
// closed sets in catalogVocabulary.ts before search uses it. Same contract as
// `loadCatalog`: all of it or none of it, never a throw.

import {
  ANGLES,
  ATTACHMENTS,
  EQUIPMENT,
  GRIPS,
  MUSCLE_GROUPS,
  MUSCLES,
} from "../constants/catalogVocabulary";
import type { SearchWords } from "../types/catalog";

const SECTIONS = ["muscleGroups", "muscles", "equipment", "axes"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const has = (table: object, key: unknown): boolean =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key);

function checkList(where: string, value: unknown, table: object, what: string, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0) return errors.push(`${where}: must be a non-empty list`);
  for (const key of value) if (!has(table, key)) errors.push(`${where}: unknown ${what} "${key}"`);
}

function checkAxis(where: string, value: unknown, errors: string[]) {
  if (!isObject(value)) return errors.push(`${where}: must be { axis, value }`);
  const { axis, value: v } = value;
  const ok =
    (axis === "angle" && has(ANGLES, v)) ||
    (axis === "attachment" && has(ATTACHMENTS, v)) ||
    (axis === "grip" && has(GRIPS, v)) ||
    (axis === "unilateral" && v === true);
  if (!ok) errors.push(`${where}: unknown axis value ${JSON.stringify(value)}`);
}

/**
 * Every problem in a search-words doc, one line each; empty means valid. A word
 * pointing at a key this build does not know ("pecs" → "chets", or equipment a
 * newer build added) is refused, so a typo fails here, not as a silent miss.
 */
export function validateSearchWords(words: unknown): string[] {
  if (!isObject(words)) return ["search words: must be an object"];
  const errors: string[] = [];
  for (const section of SECTIONS) {
    const entries = words[section];
    if (!isObject(entries)) {
      errors.push(`search words: ${section} must be an object`);
      continue;
    }
    for (const [word, value] of Object.entries(entries)) {
      const where = `${section}."${word}"`;
      if (!/[a-z0-9]/.test(word.toLowerCase())) errors.push(`${where}: has no letters or digits`);
      if (section === "muscleGroups" && !has(MUSCLE_GROUPS, value)) errors.push(`${where}: unknown muscle group "${value}"`);
      if (section === "muscles") checkList(where, value, MUSCLES, "muscle", errors);
      if (section === "equipment") checkList(where, value, EQUIPMENT, "equipment", errors);
      if (section === "axes") checkAxis(where, value, errors);
    }
  }
  return errors;
}

export type SearchWordsLoad = { kind: "ok"; words: SearchWords } | { kind: "invalid"; errors: string[] };

export function loadSearchWords(words: unknown): SearchWordsLoad {
  let errors: string[];
  try {
    errors = validateSearchWords(words);
  } catch (error) {
    return { kind: "invalid", errors: [`search words: could not be read (${String(error)})`] };
  }
  return errors.length > 0 ? { kind: "invalid", errors } : { kind: "ok", words: words as SearchWords };
}
