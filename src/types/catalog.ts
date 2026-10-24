// src/types/catalog.ts
//
// The exercise catalog, movement first (TICKET-042). A movement is how the
// catalog is *shown* (Bench Press, once, in search); a version is what is
// *logged* (`bench_press__dumbbell__incline`). History joins on the version id,
// because 40 kg on dumbbells and 40 kg on a barbell are different numbers.

import type {
  AngleId,
  AttachmentId,
  CategoryId,
  EquipmentId,
  GripId,
  MeasureId,
  MuscleId,
  OneSideLabelId,
  PatternId,
} from "../constants/catalogVocabulary";
import type { ExerciseField } from "./workoutType";

export interface Movement {
  /** "bench_press". The first part of each of its version ids. */
  id: string;
  /** "Bench Press". Display only: renaming it never changes an id. */
  name: string;
  /** Ordered: the first is the main target, and search ranks by it. */
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  category: CategoryId;
  pattern?: PatternId;
  mechanic: "compound" | "isolation";
  /** "bench", "flat bench". */
  aliases: string[];
  /**
   * What a one-side version is called in its name, "one arm" or "one leg".
   * Required when any version is unilateral; the id says `__one_side` for both.
   */
  oneSide?: OneSideLabelId;
  /** One entry for a movement with no options. */
  versions: MovementVersion[];
}

/**
 * One combination of the version axes. Every axis left out is its default:
 * flat, no attachment, normal grip, both sides. Ids and names omit defaults,
 * so a new axis added later leaves every existing id unchanged.
 */
export interface MovementVersion {
  /**
   * THE HISTORY KEY, A STORED CONTRACT. Written in the catalog as a literal,
   * never derived at runtime; `buildVersionId` only checks it. Never changes
   * once shipped, even when a name does. Pinned by `exerciseCatalog.test.ts`.
   */
  id: string;
  equipment: EquipmentId;
  /** Absent = flat. "flat" is not a value, so a flat version has one spelling. */
  angle?: AngleId;
  attachment?: AttachmentId;
  /** Absent = normal grip. */
  grip?: GripId;
  /** One arm or one leg. */
  unilateral: boolean;
  measure: MeasureId;
  /** What a plan copies when this version is added. Names carry no unit. */
  fields: ExerciseField[];
  /** "db bench". */
  aliases: string[];
  /** Only where the version changes the target: incline puts upper chest first. */
  primaryMuscles?: MuscleId[];
}
