// src/catalog/index.ts
//
// The exercise catalog's source (TICKET-046), in TICKET-042's shape.
//
// DO NOT IMPORT THIS FROM APP CODE. The app reads the catalog from Firestore
// (`exercise_catalog`, cached on the phone; TICKET-042 stage 2), so a fix
// ships with an upload, not a build. This is what that upload sends, and what
// the tests check. An import from a screen or hook would bundle the whole
// catalog and silently bypass the Firestore copy.
//
// One file per stage of TICKET-046, joined here.

import type { Movement } from "../types/catalog";
import { BACK } from "./movements/back";
import { CHEST_SHOULDERS_ARMS } from "./movements/chestShouldersArms";

export const CATALOG: Movement[] = [...CHEST_SHOULDERS_ARMS, ...BACK];
