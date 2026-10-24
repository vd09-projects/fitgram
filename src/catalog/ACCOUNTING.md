# Catalog accounting (TICKET-046)

Every entry of the research catalog (`research/exercise-catalog/catalog.json`, 878
entries, reference only and git-ignored) and what became of it, so nothing
disappears silently. The Note column carries every grouping call a person made:
overrule one by editing the catalog and this row together.

- **movement**: the entry became a movement with this one version
- **version**: the entry became one version of a movement with several. "merged"
  means a second entry landed on the same version; its name is kept as an alias
- **dropped**: not in the catalog, with the reason. MVP extras (pause, deficit,
  bands or chains on a bar, belt, stance, partial range, straps, tempo) are dropped
  per TICKET-042

`src/catalog/catalog.test.ts` checks both directions against the catalog: every
version id here exists, and every catalog version id appears here (the **Added**
section holds versions with no research entry). It cannot check that every research
entry has a row, since the research is not in git; the drafting script checks that
each stage.

**Stages** (by the entry's first primary muscle; cardio, conditioning, mobility,
stretching, plyometric, strongman and olympic entries all go to stage 5):
1. chest, shoulders, arms · 2. back · 3. legs · 4. core · 5. the rest

## Stage 1: chest, shoulders, arms

259 entries: 61 movements of one version, 191 versions, 7 dropped.

Band versions log Reps only (stage 1 review): the research gave them a weight in kg, which a band does not have; it would set bests and add to kg volume.

| Research entry | Outcome | Version id | Note |
|---|---|---|---|
| 21s (Barbell Curl) | dropped |  | partial range (MVP extra) |
| Active Hang | movement | `active_hang__bodyweight` |  |
| Alternating Dumbbell Curl | version | `bicep_curl__dumbbell` | merged: alternating is not one side: merged into the dumbbell version |
| Alternating Dumbbell Front Raise | version | `front_raise__dumbbell` | merged: alternating arms is not one side (same load per arm): merged |
| Archer Push-Up | movement | `archer_push_up__bodyweight__one_side` |  |
| Arnold Press | movement | `arnold_press__dumbbell` |  |
| Assisted Dip (Machine) | version | `dip__assisted_machine` | assisted: assisted_machine, role other. No chest-first muscle override: a triceps-dip variant |
| Band Bench Press | version | `bench_press__band` |  |
| Band Bicep Curl | version | `bicep_curl__band` |  |
| Band External Rotation | version | `external_rotation__band__one_side` |  |
| Band Face Pull | version | `face_pull__band` |  |
| Band Fly | version | `chest_fly__band` |  |
| Band Front Raise | version | `front_raise__band` |  |
| Band Lateral Raise | version | `lateral_raise__band` |  |
| Band Overhead Press | version | `overhead_press__band` |  |
| Band Pull-Apart | movement | `band_pull_apart__band` |  |
| Band Rear Delt Fly | version | `rear_delt_fly__band` |  |
| Band Triceps Pushdown | version | `triceps_pushdown__band` |  |
| Banded Chest Fly | version | `chest_fly__band` | merged: the band is the load: merged into Band Fly |
| Banded Hammer Curl | version | `hammer_curl__band` | the band is the load: band version |
| Banded Push-Up | version | `push_up__band` | the band is the load: band version |
| Banded Triceps Overhead Extension | version | `overhead_triceps_extension__band` | the band is the load: band version |
| Barbell Bench Press | version | `bench_press__barbell` |  |
| Barbell Bicep Curl | version | `bicep_curl__barbell` |  |
| Barbell Decline Bench Press | version | `bench_press__barbell__decline` |  |
| Barbell Front Raise | version | `front_raise__barbell` |  |
| Barbell Hold (Static) | movement | `barbell_hold__barbell` |  |
| Barbell Incline Bench Press | version | `bench_press__barbell__incline` |  |
| Barbell Preacher Curl | version | `preacher_curl__barbell` |  |
| Barbell Pullover | version | `pullover__barbell` |  |
| Barbell Reverse Curl | version | `reverse_curl__barbell` |  |
| Barbell Skull Crusher | version | `skull_crusher__barbell` |  |
| Bayesian Curl | movement | `bayesian_curl__cable__one_side` |  |
| Behind-the-Back Wrist Curl | movement | `behind_the_back_wrist_curl__barbell` |  |
| Behind-the-Neck Press | version | `behind_the_neck_press__barbell` |  |
| Bench Dip | movement | `bench_dip__bodyweight` |  |
| Board Press | dropped |  | partial range (MVP extra) |
| Bodyweight Triceps Extension | movement | `bodyweight_triceps_extension__bodyweight` |  |
| Bradford Press | movement | `bradford_press__barbell` |  |
| Cable Bicep Curl | version | `bicep_curl__cable` |  |
| Cable Crossover Press | version | `chest_press__cable` | merged: merged into the cable version: the same standing cable press |
| Cable External Rotation | version | `external_rotation__cable__one_side` |  |
| Cable Fly (Lying, Bench) | version | `chest_fly__cable` | lying cable fly is the cable version of the bench fly (Incline Cable Fly is its incline) |
| Cable Fly (Mid) | version | `cable_crossover__cable` | standing mid cable fly is its own movement, apart from the bench fly (collision fly__cable) |
| Cable Front Raise | version | `front_raise__cable` |  |
| Cable Front Raise (Single-Arm) | version | `front_raise__cable__one_side` |  |
| Cable Internal Rotation | movement | `internal_rotation__cable__one_side` |  |
| Cable Kickback (Triceps) | version | `triceps_kickback__cable__one_side` |  |
| Cable Lateral Raise | version | `lateral_raise__cable` |  |
| Cable Preacher Curl | version | `preacher_curl__cable` |  |
| Cable Rear Delt Fly | version | `rear_delt_fly__cable` |  |
| Cable Rear Delt Fly (Crossover) | version | `rear_delt_fly__cable` | merged: merged (collision rear_delt_fly__cable) |
| Cable Rear Delt Row | version | `rear_delt_row__cable` |  |
| Cable Reverse Curl | version | `reverse_curl__cable` |  |
| Cable Shoulder Press | version | `shoulder_press__cable` |  |
| Cable Skull Crusher | version | `skull_crusher__cable` |  |
| Cable Triceps Extension (Cross-Body) | movement | `cross_body_triceps_extension__cable` |  |
| Cable Upright Row | version | `upright_row__cable` |  |
| Cable Wrist Curl | version | `wrist_curl__cable` |  |
| Cable Y-Raise | version | `y_raise__cable` |  |
| Cheat Curl | movement | `cheat_curl__barbell` | kept: cheating is not in the MVP's extras list |
| Chest Dip | version | `chest_dip__bodyweight` |  |
| Chest-Supported Rear Delt Fly | version | `rear_delt_fly__dumbbell__incline` | chest on an incline bench: the dumbbell incline version |
| Chin-Up Hold (Bicep) | movement | `chin_up_hold__bodyweight` |  |
| Close-Grip Bench Press | version | `bench_press__barbell__close_grip` |  |
| Close-Grip Push-Up on Bench | version | `push_up__bodyweight__incline__close_grip` | hands on a bench is incline: incline close-grip version |
| Concentration Curl | movement | `concentration_curl__dumbbell__one_side` |  |
| Cross-Body Hammer Curl | version | `hammer_curl__dumbbell__one_side` | cross-body is a path, not a load change: the one-arm dumbbell version |
| Cuban Press | movement | `cuban_press__dumbbell` |  |
| Dead Hang | movement | `dead_hang__bodyweight` |  |
| Decline Dumbbell Fly | version | `chest_fly__dumbbell__decline` |  |
| Decline Push-Up | version | `push_up__bodyweight__decline` |  |
| Decline Skull Crusher | version | `skull_crusher__ez_bar__decline` |  |
| Deficit Push-Up | dropped |  | deficit (MVP extra) |
| Diamond Push-Up | version | `push_up__bodyweight__close_grip` | diamond is a close grip: close-grip version, triceps first |
| Drag Curl | movement | `drag_curl__barbell` |  |
| Dumbbell Bench Press | version | `bench_press__dumbbell` |  |
| Dumbbell Bicep Curl | version | `bicep_curl__dumbbell` |  |
| Dumbbell Curl to Press | movement | `curl_to_press__dumbbell` |  |
| Dumbbell Decline Bench Press | version | `bench_press__dumbbell__decline` |  |
| Dumbbell External Rotation (Side-Lying) | version | `external_rotation__dumbbell__one_side` | side-lying is the only dumbbell form: the dumbbell version |
| Dumbbell Floor Press | version | `floor_press__dumbbell` |  |
| Dumbbell Fly | version | `chest_fly__dumbbell` |  |
| Dumbbell Front Raise | version | `front_raise__dumbbell` |  |
| Dumbbell Incline Bench Press | version | `bench_press__dumbbell__incline` |  |
| Dumbbell Kickback | version | `triceps_kickback__dumbbell__one_side` |  |
| Dumbbell Lateral Raise | version | `lateral_raise__dumbbell` |  |
| Dumbbell Overhead Triceps Extension | version | `overhead_triceps_extension__dumbbell` |  |
| Dumbbell Preacher Curl | version | `preacher_curl__dumbbell__one_side` |  |
| Dumbbell Pullover | version | `pullover__dumbbell` |  |
| Dumbbell Rear Delt Fly | version | `rear_delt_fly__dumbbell` |  |
| Dumbbell Rear Delt Row | version | `rear_delt_row__dumbbell` |  |
| Dumbbell Reverse Curl | version | `reverse_curl__dumbbell` |  |
| Dumbbell Reverse Wrist Curl | version | `reverse_wrist_curl__dumbbell` |  |
| Dumbbell Shoulder Press | version | `shoulder_press__dumbbell` |  |
| Dumbbell Skull Crusher | version | `skull_crusher__dumbbell` |  |
| Dumbbell Squeeze Press | version | `squeeze_press__dumbbell` |  |
| Dumbbell Upright Row | version | `upright_row__dumbbell` |  |
| Dumbbell Wrist Curl | version | `wrist_curl__dumbbell__one_side` |  |
| Dumbbell Y-Raise | version | `y_raise__dumbbell` |  |
| EZ-Bar Bicep Curl | version | `bicep_curl__ez_bar` |  |
| EZ-Bar Close-Grip Bench Press | version | `bench_press__ez_bar__close_grip` |  |
| EZ-Bar Overhead Triceps Extension | version | `overhead_triceps_extension__ez_bar` |  |
| EZ-Bar Spider Curl | version | `spider_curl__ez_bar` |  |
| EZ-Bar Upright Row | version | `upright_row__ez_bar` |  |
| Face Pull | version | `face_pull__cable__rope` | the cable face pull is done with a rope: cable, rope |
| Fat Grip Dumbbell Hold | movement | `fat_grip_hold__dumbbell` |  |
| Finger Curl | movement | `finger_curl__barbell` |  |
| Floor Press | version | `floor_press__barbell` |  |
| Gada Swing | movement | `gada_swing__gada__one_side` |  |
| Gripper | movement | `gripper__gripper` | new equipment key gripper |
| Hammer Curl | version | `hammer_curl__dumbbell` | kept its own movement, not a neutral-grip Bicep Curl: a named exercise in the user's notes |
| Hammer Strength Chest Press | version | `chest_press__plate_loaded_machine` | merged: merged into the plate-loaded version (collision chest_press__plate_loaded_machine) |
| Hammer Strength Decline Press | version | `bench_press__plate_loaded_machine__decline` | merged: Hammer Strength: merged into the plate-loaded decline version |
| Hammer Strength Incline Press | version | `bench_press__plate_loaded_machine__incline` | merged: Hammer Strength is a plate-loaded machine: merged into the plate-loaded incline version |
| Hammer Strength Shoulder Press | version | `shoulder_press__plate_loaded_machine` | Hammer Strength: the plate-loaded version |
| Hand-Release Push-Up | movement | `hand_release_push_up__bodyweight` |  |
| Handstand Push-Up | movement | `handstand_push_up__bodyweight` |  |
| High Cable Curl | movement | `high_cable_curl__cable` |  |
| High-to-Low Cable Fly | movement | `high_to_low_cable_fly__cable` |  |
| Hindu Push-Up | movement | `hindu_push_up__bodyweight` |  |
| Incline Cable Fly | version | `chest_fly__cable__incline` |  |
| Incline Dumbbell Curl | version | `bicep_curl__dumbbell__incline` | incline is an angle of Bicep Curl |
| Incline Dumbbell Fly | version | `chest_fly__dumbbell__incline` |  |
| Incline Dumbbell Squeeze Press | version | `squeeze_press__dumbbell__incline` |  |
| Incline Hammer Curl | version | `hammer_curl__dumbbell__incline` |  |
| Incline Machine Chest Press | version | `chest_press__machine__incline` |  |
| Incline Push-Up | version | `push_up__bodyweight__incline` |  |
| Incline Skull Crusher | version | `skull_crusher__ez_bar__incline` |  |
| JM Press | version | `jm_press__barbell` |  |
| Kettlebell Bench Press | version | `bench_press__kettlebell` |  |
| Kettlebell Bent Press | movement | `bent_press__kettlebell` |  |
| Kettlebell Bicep Curl | version | `bicep_curl__kettlebell` |  |
| Kettlebell Bottoms-Up Press | movement | `bottoms_up_press__kettlebell__one_side` |  |
| Kettlebell Floor Press | version | `floor_press__kettlebell` |  |
| Kettlebell Front Raise | version | `front_raise__kettlebell` |  |
| Kettlebell Halo | version | `halo__kettlebell` |  |
| Kettlebell Incline Bench Press | version | `bench_press__kettlebell__incline` |  |
| Kettlebell Lateral Raise | version | `lateral_raise__kettlebell` |  |
| Kettlebell Overhead Press | version | `overhead_press__kettlebell__one_side` | one arm, as the research has it |
| Kettlebell Sots Press | movement | `sots_press__kettlebell` |  |
| Knee Push-Up | movement | `knee_push_up__bodyweight` | knees down changes the numbers: own movement |
| Kneeling High-to-Low Cable Fly | version | `high_to_low_cable_fly__cable` | merged: kneeling vs standing does not change the numbers: merged |
| Landmine Lateral Raise | version | `lateral_raise__landmine` |  |
| Landmine Press | version | `landmine_press__landmine` |  |
| Landmine Press (Chest) | version | `landmine_press__landmine` | merged: merged into Landmine Press (collision press__landmine): same press, chest-biased cue |
| Landmine Shoulder Press (Kneeling) | version | `landmine_press__landmine` | merged: kneeling vs standing does not change the numbers: merged |
| Larsen Press | dropped |  | stance (MVP extra): a bench press with the feet up |
| Lean-Away Lateral Raise | version | `lateral_raise__dumbbell__one_side` | one-arm dumbbell version of Lateral Raise |
| Low-Incline Dumbbell Press | version | `bench_press__dumbbell__incline` | merged: low incline is incline: merged into the dumbbell incline version |
| Low-to-High Cable Fly | movement | `low_to_high_cable_fly__cable` |  |
| Lu Raise | movement | `lu_raise__dumbbell` |  |
| Lying Cable Curl | movement | `lying_cable_curl__cable` |  |
| Lying Incline Lateral Raise | version | `lateral_raise__dumbbell__incline` | lying on an incline bench: the dumbbell incline version |
| Mace 10-to-2 | movement | `mace_10_to_2__mace` |  |
| Machine Bench Press | version | `bench_press__machine` |  |
| Machine Bicep Curl | version | `bicep_curl__machine` |  |
| Machine Chest Press | version | `chest_press__machine` | seated machine chest press stays apart from Bench Press, as in the user's notes ("Chest press" vs "Bench press") |
| Machine Decline Bench Press | version | `bench_press__machine__decline` |  |
| Machine Dip | version | `dip__machine` | one Dip movement with Triceps Dip (stage 1 review) |
| Machine Incline Bench Press | version | `bench_press__machine__incline` |  |
| Machine Lateral Raise | version | `lateral_raise__machine` |  |
| Machine Lateral Raise (Seated) | version | `lateral_raise__machine` | merged: merged (collision lateral_raise__machine): the machine is seated either way |
| Machine Rear Delt Row | version | `rear_delt_row__machine` |  |
| Machine Shoulder Press | version | `shoulder_press__machine` |  |
| Medicine Ball Push-Up | version | `push_up__medicine_ball` |  |
| Neutral-Grip Dumbbell Bench Press | version | `bench_press__dumbbell__neutral_grip` |  |
| One-Arm Push-Up | version | `push_up__bodyweight__one_side` | one-arm version of Push-Up |
| Overhead Cable Triceps Extension | version | `overhead_triceps_extension__cable` |  |
| Overhead Plate Halo | version | `halo__weight_plate` | plate version of Halo |
| Overhead Press | version | `overhead_press__barbell` | standing presses are Overhead Press; seated ones are Shoulder Press (back support changes the numbers) |
| Parallette Push-Up | version | `push_up__parallettes` | parallettes are an equipment version |
| Pause Bench Press | dropped |  | pause (MVP extra) |
| Pec Deck (Machine Fly) | movement | `pec_deck__machine` |  |
| Pike Push-Up | movement | `pike_push_up__bodyweight` |  |
| Pin Press (Bench) | dropped |  | partial range (MVP extra) |
| Plate Front Raise | version | `front_raise__weight_plate` |  |
| Plate Lateral Raise | version | `lateral_raise__weight_plate` |  |
| Plate Pinch | movement | `plate_pinch__weight_plate` |  |
| Plate Press-Out | movement | `plate_press_out__weight_plate` |  |
| Plate-Loaded Machine Bench Press | version | `bench_press__plate_loaded_machine` |  |
| Plate-Loaded Machine Chest Press | version | `chest_press__plate_loaded_machine` |  |
| Plate-Loaded Machine Decline Bench Press | version | `bench_press__plate_loaded_machine__decline` |  |
| Plate-Loaded Machine Incline Bench Press | version | `bench_press__plate_loaded_machine__incline` |  |
| Preacher Curl | version | `preacher_curl__ez_bar` |  |
| Preacher Curl Machine (Plate-Loaded) | version | `preacher_curl__plate_loaded_machine` |  |
| Preacher Hammer Curl | movement | `preacher_hammer_curl__dumbbell` |  |
| Pronation/Supination (Dumbbell) | movement | `pronation_supination__dumbbell__one_side` |  |
| Pseudo Planche Push-Up | movement | `pseudo_planche_push_up__bodyweight` |  |
| Push-Up | version | `push_up__bodyweight` |  |
| Radial Deviation | movement | `radial_deviation__dumbbell__one_side` |  |
| Reverse Curl | version | `reverse_curl__ez_bar` | kept its own movement, not a reverse-grip Bicep Curl, like Hammer Curl |
| Reverse Pec Deck | movement | `reverse_pec_deck__machine` | own movement, like Pec Deck |
| Reverse Wrist Curl | version | `reverse_wrist_curl__barbell` |  |
| Reverse-Grip Bench Press | version | `bench_press__barbell__reverse_grip` |  |
| Reverse-Grip Triceps Pushdown | version | `triceps_pushdown__cable__reverse_grip` |  |
| Ring Dip | version | `dip__rings` | no chest-first muscle override: a triceps-dip variant |
| Ring Push-Up | version | `push_up__rings` |  |
| Rope Front Raise | version | `front_raise__cable__rope` |  |
| Rope Hammer Curl | version | `hammer_curl__cable__rope` | cable rope version |
| Scapular Push-Up | movement | `scapular_push_up__bodyweight` |  |
| Seated Barbell Overhead Press | version | `shoulder_press__barbell` | seated: the barbell version of Shoulder Press |
| Seated Cable Fly | movement | `seated_cable_fly__cable` | seated (back supported) changes the numbers: own movement |
| Seated Dip Machine (Plate-Loaded) | version | `dip__plate_loaded_machine` | plate-loaded version of Dip |
| Seated Dumbbell Curl | version | `bicep_curl__dumbbell` | merged: seated vs standing does not change a curl's numbers: merged |
| Seated Dumbbell Hammer Curl | version | `hammer_curl__dumbbell` | merged: seated: merged |
| Seated Dumbbell Lateral Raise | version | `lateral_raise__dumbbell` | merged: seated vs standing does not change a raise's numbers: merged |
| Single-Arm Cable Chest Press | version | `chest_press__cable__one_side` |  |
| Single-Arm Cable Curl | version | `bicep_curl__cable__one_side` |  |
| Single-Arm Cable Fly | version | `cable_crossover__cable__one_side` | standing single-arm cable fly: one-arm version of Cable Crossover |
| Single-Arm Cable Lateral Raise | version | `lateral_raise__cable__one_side` |  |
| Single-Arm Cable Pushdown | version | `triceps_pushdown__cable__one_side` | one-arm version of Triceps Pushdown |
| Single-Arm Dumbbell Bench Press | version | `bench_press__dumbbell__one_side` |  |
| Single-Arm Dumbbell Overhead Extension | version | `overhead_triceps_extension__dumbbell__one_side` |  |
| Single-Arm Dumbbell Shoulder Press | version | `shoulder_press__dumbbell__one_side` |  |
| Single-Arm Landmine Press | version | `landmine_press__landmine__one_side` |  |
| Single-Arm Machine Chest Press | version | `chest_press__machine__one_side` |  |
| Single-Arm Overhead Cable Extension | version | `overhead_triceps_extension__cable__one_side` |  |
| Skull Crusher | version | `skull_crusher__ez_bar` |  |
| Smith Machine Behind-the-Neck Press | version | `behind_the_neck_press__smith_machine` |  |
| Smith Machine Bench Press | version | `bench_press__smith_machine` |  |
| Smith Machine Close-Grip Bench Press | version | `bench_press__smith_machine__close_grip` |  |
| Smith Machine Decline Bench Press | version | `bench_press__smith_machine__decline` |  |
| Smith Machine Incline Bench Press | version | `bench_press__smith_machine__incline` |  |
| Smith Machine Incline Close-Grip Press | version | `bench_press__smith_machine__incline__close_grip` | a grip and angle version of Bench Press |
| Smith Machine JM Press | version | `jm_press__smith_machine` |  |
| Smith Machine Shoulder Press | version | `shoulder_press__smith_machine` |  |
| Smith Machine Upright Row | version | `upright_row__smith_machine` |  |
| Specialty Bar Bench Press (Swiss/Football Bar) | version | `bench_press__specialty_bar` | specialty bar is an equipment version (042's 19th) |
| Spider Curl | version | `spider_curl__dumbbell` |  |
| Spiderman Push-Up | movement | `spiderman_push_up__bodyweight` |  |
| Spoto Press | dropped |  | pause (MVP extra): a bench press paused above the chest |
| Staggered Push-Up | movement | `staggered_push_up__bodyweight__one_side` |  |
| Standing Cable Chest Press | version | `chest_press__cable` | standing is the only cable chest press position: the cable version |
| Standing Dumbbell Shoulder Press | version | `overhead_press__dumbbell` | standing: the dumbbell version of Overhead Press |
| Suspension Bicep Curl | version | `bicep_curl__suspension_trainer` |  |
| Suspension Push-Up | version | `push_up__suspension_trainer` |  |
| Svend Press | movement | `svend_press__weight_plate` |  |
| T Push-Up | movement | `t_push_up__bodyweight` |  |
| Tate Press | movement | `tate_press__dumbbell` |  |
| Towel Hang | movement | `towel_hang__bodyweight` |  |
| Triceps Dip | version | `dip__bodyweight` | the bodyweight version of Dip (stage 1 review): machine, plate-loaded, assisted and ring dips are triceps-dip variants, so an assisted dip's progress sits next to the real one. Chest Dip stays apart (the forward lean changes the numbers) |
| Triceps Extension Machine | movement | `triceps_extension_machine__machine` |  |
| Triceps Pushdown (Rope) | version | `triceps_pushdown__cable__rope` |  |
| Triceps Pushdown (Straight Bar) | version | `triceps_pushdown__cable__straight_bar` |  |
| Triceps Pushdown (V-Bar) | version | `triceps_pushdown__cable__v_bar` |  |
| Typewriter Push-Up | movement | `typewriter_push_up__bodyweight` |  |
| Upright Row | version | `upright_row__barbell` |  |
| Vertical Chest Press Machine | version | `chest_press__machine` | merged: merged into the machine version: same seated press |
| Viking Press | movement | `viking_press__plate_loaded_machine` |  |
| Waiter Curl | movement | `waiter_curl__dumbbell` |  |
| Wall Push-Up | movement | `wall_push_up__bodyweight` | own movement: far lighter than an incline push-up |
| Weighted Chest Dip | version | `chest_dip__added_weight` | weighted: the added_weight version |
| Weighted Push-Up | version | `push_up__added_weight` | weighted: the added_weight version |
| Wide Push-Up | version | `push_up__bodyweight` | merged: no wide grip key: merged into the normal push-up |
| Wrist Curl | version | `wrist_curl__barbell` |  |
| Wrist Roller | movement | `wrist_roller__wrist_roller` | new equipment key wrist_roller |
| Z Press | movement | `z_press__barbell` |  |
| Zottman Curl | movement | `zottman_curl__dumbbell` |  |

## Coverage check (free-exercise-db)

Beyond the user's notes, each stage is checked against
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (876 entries,
public domain; fetched 2026-10-25, not kept in the repo): its strength and
powerlifting entries whose first primary muscle is in the stage. A name that no
movement, version or alias matches is sorted by a person into covered under
another name, built in a later stage, an MVP extra, added (obvious gym staples
only, user 2026-10-25), or skipped as niche.

**Stage 1** (chest, shoulders, biceps, triceps, forearms): 313 reference entries.
177 match by name, 62 are covered under another name ("Side Lateral Raise",
"Lying Triceps Press" = Skull Crusher, the palms-up/down wrist curls), 17 are in
the research for a later stage (kettlebell jerks, snatches, cleans, Turkish
get-ups), 9 are MVP extras (chains, pin, partials, bands for speed). **Added: 0.
Skipped as niche: 48:** Alternating Deltoid Raise; Anti-Gravity Press; Around The Worlds; Barbell Curls Lying Against An Incline; Barbell Guillotine Bench Press; Barbell Incline Shoulder Raise; Body-Up; Bottoms-Up Clean From The Hang Position; Cable Iron Cross; Car Drivers; Clock Push-Up; Dumbbell Incline Shoulder Raise; Dumbbell Scaption; Flexor Incline Dumbbell Curls; Front Raise And Pullover; Hammer Grip Incline DB Bench Press; Incline Dumbbell Bench With Palms Facing In; Incline Dumbbell Flyes - With A Twist; Iron Cross; Isometric Wipers; Kettlebell Halo with Overhead Extension; Kettlebell Pirate Ships; Kettlebell Seesaw Press; Landmine Linear Jammer; Leg-Over Floor Press; Lying Supine Dumbbell Curl; Neck Press; One Arm Pronated Dumbbell Triceps Extension; One Arm Supinated Dumbbell Triceps Extension; One-Arm Kettlebell Military Press To The Side; One-Arm Kettlebell Para Press; Plyo Kettlebell Pushups; Push Up to Side Plank; Push-Ups With Feet On An Exercise Ball; Reverse Flyes With External Rotation; See-Saw Press (Alternating Side Press); Side Laterals to Front Raise; Single-Arm Linear Jammer; Sled Overhead Backward Walk; Sled Overhead Triceps Extension; Sled Reverse Flye; Smith Incline Shoulder Raise; Standing Palm-In One-Arm Dumbbell Press; Standing Palms-In Dumbbell Press; Standing Towel Triceps Extension; Straight Raises on Incline Bench; Wrist Rotations with Straight Bar; Zottman Preacher Curl.
Borderline, skipped: the neutral-grip incline dumbbell press (2 names). It would
be bench_press__dumbbell__incline__neutral_grip; adding it later is safe.

## Added (no research entry)

| Version id | Why |
|---|---|
| `dip__added_weight` | weighted triceps dip (stage 1 review): every bodyweight dip gets its weighted version; the research had only Weighted Chest Dip |
