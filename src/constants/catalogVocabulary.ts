// src/constants/catalogVocabulary.ts
//
// The closed sets the exercise catalog is written in (TICKET-042): muscles,
// equipment, categories, movement patterns and measures. The loader
// (`validateCatalog`) refuses any value not listed here, so a typo in the
// catalog fails a test instead of becoming a muscle nobody can search for.
//
// KEYS ARE STORED VALUES. Equipment keys are part of every version id
// (`bench_press__dumbbell`), which is the history key, so renaming one orphans
// that version's history. Adding a key is always safe. Labels can change freely.
//
// Taken from the research catalog (research/exercise-catalog/catalog_src.py),
// with its short equipment codes ("bb", "db") spelled out, since these now
// appear in ids that stay readable in Firestore. TICKET-046 may add to them.

type MuscleSpec = { label: string; group: MuscleGroupId };

/** What "search chest" resolves to (TICKET-043). */
export const MUSCLE_GROUPS = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  legs: "Legs",
  neck: "Neck",
  cardio: "Cardio",
  full_body: "Full body",
} as const;
export type MuscleGroupId = keyof typeof MUSCLE_GROUPS;

export const MUSCLES = {
  chest: { label: "Chest", group: "chest" },
  upper_chest: { label: "Upper chest", group: "chest" },
  serratus: { label: "Serratus", group: "chest" },
  lats: { label: "Lats", group: "back" },
  upper_back: { label: "Upper back", group: "back" },
  traps: { label: "Traps", group: "back" },
  lower_back: { label: "Lower back", group: "back" },
  front_delts: { label: "Front delts", group: "shoulders" },
  side_delts: { label: "Side delts", group: "shoulders" },
  rear_delts: { label: "Rear delts", group: "shoulders" },
  rotator_cuff: { label: "Rotator cuff", group: "shoulders" },
  biceps: { label: "Biceps", group: "arms" },
  brachialis: { label: "Brachialis", group: "arms" },
  triceps: { label: "Triceps", group: "arms" },
  forearms: { label: "Forearms", group: "arms" },
  abs: { label: "Abs", group: "core" },
  obliques: { label: "Obliques", group: "core" },
  deep_core: { label: "Deep core", group: "core" },
  hip_flexors: { label: "Hip flexors", group: "legs" },
  quads: { label: "Quads", group: "legs" },
  hamstrings: { label: "Hamstrings", group: "legs" },
  glutes: { label: "Glutes", group: "legs" },
  adductors: { label: "Adductors", group: "legs" },
  abductors: { label: "Abductors", group: "legs" },
  calves: { label: "Calves", group: "legs" },
  tibialis: { label: "Tibialis", group: "legs" },
  neck: { label: "Neck", group: "neck" },
  cardio: { label: "Cardio", group: "cardio" },
  full_body: { label: "Full body", group: "full_body" },
} as const satisfies Record<string, MuscleSpec>;
export type MuscleId = keyof typeof MUSCLES;

/**
 * Labels are lower case: the display name capitalises only its first part
 * ("Bench Press · Dumbbell, incline"), so a label reads right in either place.
 *
 * THE RULE (PR #20 review): equipment is what carries the load, or what
 * changes the numbers. Something that is only where the body works is not
 * equipment: a pull-up on a bar, a dip on a station, a bench dip, a wall sit and
 * a box jump are all `bodyweight` (`pull_up__bodyweight`). Rings, a suspension
 * trainer and parallettes stay, because a ring dip is a different number from a
 * bar dip. There is no "none": an implement not listed here (wrist roller,
 * gripper, tib bar) gets its own key when the catalog needs it, rather than an
 * id that says nothing (`tib_bar_raise__none`).
 */
export const EQUIPMENT = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  kettlebell: "kettlebell",
  cable: "cable",
  machine: "machine",
  // An assisted machine is its own equipment, not a machine: "Pull-Up · Machine"
  // would not say the numbers are assistance (lower is progress). Keeps the id
  // format free of an "assisted" axis.
  assisted_machine: "assisted machine",
  plate_loaded_machine: "plate-loaded machine",
  smith_machine: "Smith machine",
  ez_bar: "EZ bar",
  trap_bar: "trap bar",
  safety_squat_bar: "safety squat bar",
  specialty_bar: "specialty bar",
  landmine: "landmine",
  bodyweight: "bodyweight",
  band: "band",
  medicine_ball: "medicine ball",
  stability_ball: "stability ball",
  suspension_trainer: "suspension trainer",
  sled: "sled",
  rings: "rings",
  parallettes: "parallettes",
  weight_plate: "weight plate",
  sandbag: "sandbag",
  battle_rope: "battle rope",
  jump_rope: "jump rope",
  ab_wheel: "ab wheel",
  foam_roller: "foam roller",
  cardio_machine: "cardio machine",
  ghd: "GHD",
  yoke: "yoke",
  log: "log",
  atlas_stone: "atlas stone",
  tire: "tire",
  sledgehammer: "sledgehammer",
  weight_vest: "weight vest",
  mace: "mace",
  gada: "gada",
} as const;
export type EquipmentId = keyof typeof EQUIPMENT;

export const CATEGORIES = {
  strength: "Strength",
  calisthenics: "Calisthenics",
  powerlifting: "Powerlifting",
  olympic: "Olympic",
  strongman: "Strongman",
  plyometric: "Plyometric",
  cardio: "Cardio",
  conditioning: "Conditioning",
  mobility: "Mobility",
  stretching: "Stretching",
  rehab: "Rehab",
} as const;
export type CategoryId = keyof typeof CATEGORIES;

export const PATTERNS = {
  horizontal_push: "Horizontal push",
  vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull",
  vertical_pull: "Vertical pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  carry: "Carry",
  isolation_upper: "Isolation, upper",
  isolation_lower: "Isolation, lower",
  core_flexion: "Core flexion",
  core_rotation: "Core rotation",
  anti_extension: "Anti-extension",
  anti_rotation: "Anti-rotation",
  anti_lateral_flexion: "Anti-lateral flexion",
  hip_extension: "Hip extension",
  jump: "Jump",
  throw: "Throw",
  olympic_lift: "Olympic lift",
  locomotion: "Locomotion",
  cyclical_cardio: "Cyclical cardio",
  stretch: "Stretch",
  mobility: "Mobility",
  full_body: "Full body",
} as const;
export type PatternId = keyof typeof PATTERNS;

/**
 * What a version measures: the research catalog's 11 templates. A label only
 * for now; the version's own `fields` are what a plan copies. TICKET-035 gives
 * each measure its "which way is better".
 *
 * `assisted` is the one whose fields need care: assistance with role `weight`
 * would read less assistance (progress) as a regression and add it to volume,
 * so its field uses role `other` until TICKET-035's `better` exists.
 */
export const MEASURES = {
  weight_reps: "Weight × reps",
  bodyweight_reps: "Bodyweight reps",
  weighted_bodyweight_reps: "Added weight × reps",
  assisted: "Assistance × reps",
  reps: "Reps only",
  hold: "Hold for time",
  duration: "Duration",
  distance_time: "Distance + time",
  weight_distance: "Weight × distance",
  weight_time: "Weight × time",
  jump_distance: "Jump or throw distance",
} as const;
export type MeasureId = keyof typeof MEASURES;

/** Version axes. Absent on a version means the default, which ids and names omit. */
export const ANGLES = { incline: "incline", decline: "decline" } as const;
export const ATTACHMENTS = {
  rope: "rope",
  straight_bar: "straight bar",
  v_bar: "V-bar",
  d_handle: "D-handle",
} as const;
export const GRIPS = { close: "close grip", reverse: "reverse grip", neutral: "neutral grip" } as const;

export type AngleId = keyof typeof ANGLES;
export type AttachmentId = keyof typeof ATTACHMENTS;
export type GripId = keyof typeof GRIPS;

/** What "one side" is called on a movement: Single-Arm Row is "one arm", Single-Leg RDL "one leg". */
export const ONE_SIDE_LABELS = { arm: "one arm", leg: "one leg" } as const;
export type OneSideLabelId = keyof typeof ONE_SIDE_LABELS;
