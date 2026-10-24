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

## Stage 2: back

90 entries: 27 movements of one version, 63 versions (4 of them added to Pullover,
which lives in the stage 1 file), 0 dropped.

| Research entry | Outcome | Version id | Note |
|---|---|---|---|
| Archer Pull-Up | movement | `archer_pull_up__bodyweight__one_side` |  |
| Assisted Pull-Up (Machine) | version | `pull_up__assisted_machine` | assisted: assisted_machine, role other |
| Back Extension | version | `back_extension__bodyweight` | the user's "Hyperextension" |
| Back Extension Machine | version | `back_extension__machine` |  |
| Band Bent-Over Row | version | `bent_over_row__band` |  |
| Band Lat Pulldown | version | `lat_pulldown__band` |  |
| Band-Assisted Pull-Up | version | `pull_up__band` | the band assists: band version, reps only |
| Banded Lat Pulldown (Kneeling) | version | `lat_pulldown__band` | merged: the band is the load: merged into Band Lat Pulldown |
| Banded Row | version | `seated_row__band` | the band is the load: band version (user, 2026-10-25) |
| Barbell Bent-Over Row | version | `bent_over_row__barbell` |  |
| Barbell Shrug | version | `shrug__barbell` |  |
| Behind-the-Back Barbell Shrug | movement | `behind_the_back_shrug__barbell` | own movement: the bar path changes the numbers |
| Behind-the-Neck Lat Pulldown | movement | `behind_the_neck_lat_pulldown__cable` | own movement: the path changes the numbers |
| Cable Lat Prayer | movement | `lat_prayer__cable` |  |
| Cable Pullover (Lying) | version | `pullover__cable` | added to Pullover (stage 1 file): the cable version, lats first |
| Cable Row to Neck (Face-Height Row) | movement | `face_height_row__cable` | own movement: kept apart from Face Pull (bar or handle, not rope; upper back first) |
| Cable Shoulder Shrug-In | movement | `shrug_in__cable` |  |
| Cable Shrug | version | `shrug__cable` |  |
| Chest-Supported Dumbbell Row | version | `chest_supported_row__dumbbell` |  |
| Chest-Supported Machine Row | version | `chest_supported_row__plate_loaded_machine` |  |
| Chin Tuck | movement | `chin_tuck__bodyweight` |  |
| Chin-Up | version | `chin_up__bodyweight` | kept its own movement, not a reverse-grip Pull-Up: a named exercise, like Hammer Curl |
| Close-Grip Lat Pulldown | version | `lat_pulldown__cable__close_grip` |  |
| Commando Pull-Up | movement | `commando_pull_up__bodyweight` |  |
| Dumbbell Bent-Over Row | version | `bent_over_row__dumbbell` |  |
| Dumbbell Pullover (Decline) | version | `pullover__dumbbell__decline` | added to Pullover (stage 1 file): the decline dumbbell version |
| Dumbbell Seal Row | version | `seal_row__dumbbell` |  |
| Dumbbell Shrug | version | `shrug__dumbbell` |  |
| Gorilla Row | movement | `gorilla_row__kettlebell` |  |
| Hammer Strength High Row | movement | `high_row__plate_loaded_machine` | own movement: pulls down from above, unlike the seated rows |
| Hammer Strength Low Row | version | `seated_row__plate_loaded_machine` | merged: merged into the plate-loaded version |
| Hammer Strength Pulldown | version | `lat_pulldown__plate_loaded_machine` | merged: Hammer Strength is a plate-loaded machine: merged into the plate-loaded version |
| Hammer Strength Row | version | `seated_row__plate_loaded_machine` | the plate-loaded version. A version is the machine type, not the brand: gyms' plate-loaded rows share it |
| Helms Row | version | `chest_supported_row__dumbbell` | merged: a Helms row is a chest-supported dumbbell row: merged |
| Inverted Row | version | `inverted_row__bodyweight` |  |
| Kettlebell Bent-Over Row | version | `bent_over_row__kettlebell` |  |
| Kettlebell High Pull | movement | `high_pull__kettlebell` |  |
| Kettlebell Row (Single-Arm) | version | `bent_over_row__kettlebell__one_side` | the one-arm kettlebell version |
| Kettlebell Shrug | version | `shrug__kettlebell` |  |
| Kneeling Single-Arm Lat Pulldown | version | `lat_pulldown__cable__one_side` | merged: kneeling vs seated does not change the numbers: merged into the one-arm version |
| Kroc Row | movement | `kroc_row__dumbbell__one_side` |  |
| L-Sit Pull-Up | movement | `l_sit_pull_up__bodyweight` |  |
| Lat Pulldown (Cable, Wide Grip) | version | `lat_pulldown__cable` | wide is the normal lat pulldown grip: no wide key (user, 2026-10-25) |
| Machine Lat Pulldown | version | `lat_pulldown__machine` |  |
| Machine Pullover | version | `pullover__machine` | added to Pullover (stage 1 file): the machine version |
| Machine Row (Seated) | version | `seated_row__machine` | the machine version of Seated Row |
| Machine Shrug | version | `shrug__machine` |  |
| Meadows Row | movement | `meadows_row__landmine__one_side` |  |
| Muscle-Up (Bar) | version | `muscle_up__bodyweight` |  |
| Muscle-Up (Rings) | version | `muscle_up__rings` |  |
| Negative Pull-Up | movement | `negative_pull_up__bodyweight` |  |
| Neutral-Grip Lat Pulldown | version | `lat_pulldown__cable__neutral_grip` |  |
| Neutral-Grip Pull-Up | version | `pull_up__bodyweight__neutral_grip` | neutral-grip version |
| One-Arm Pull-Up | version | `pull_up__bodyweight__one_side` |  |
| Pendlay Row | movement | `pendlay_row__barbell` | own movement: a dead stop from the floor changes the numbers |
| Plate-Loaded Lat Row (Iso-Lateral) | version | `seated_row__plate_loaded_machine` | merged: merged into the plate-loaded version |
| Plate-Loaded Machine Lat Pulldown | version | `lat_pulldown__plate_loaded_machine` |  |
| Prone YTW Raise | movement | `prone_ytw_raise__dumbbell` |  |
| Pull-Up | version | `pull_up__bodyweight` |  |
| Pullover Machine (Plate-Loaded) | version | `pullover__plate_loaded_machine` | added to Pullover (stage 1 file): the plate-loaded version |
| Rack Pull | movement | `rack_pull__barbell` | its own movement, not a deadlift version (stage 2 review): programmed on its own, numbers never compare with a deadlift's. Kept although partial range |
| Renegade Row | movement | `renegade_row__dumbbell__one_side` |  |
| Reverse-Grip Lat Pulldown | version | `lat_pulldown__cable__reverse_grip` |  |
| Ring Pull-Up | version | `pull_up__rings` |  |
| Ring Row | version | `inverted_row__rings` |  |
| Rope Climb | movement | `rope_climb__bodyweight` | the rope is where the body works: bodyweight (user, 2026-10-25) |
| Rope Straight-Arm Pulldown | version | `straight_arm_pulldown__cable__rope` |  |
| Scapular Pull-Up | movement | `scapular_pull_up__bodyweight` |  |
| Seal Row | version | `seal_row__barbell` | own movement: lying flat, apart from the incline chest-supported row |
| Seated Cable Row | version | `seated_row__cable` | "Seated Cable Row" and "Machine Row (Seated)" are one movement, Seated Row, with cable and machine versions (042's grouping question) |
| Seated Good Morning | movement | `seated_good_morning__barbell` | seated changes the numbers: own movement |
| Single-Arm Dumbbell Row | version | `bent_over_row__dumbbell__one_side` | the one-arm dumbbell version of Bent-Over Row |
| Single-Arm Landmine Row | version | `meadows_row__landmine__one_side` | merged: a single-arm landmine row is the Meadows Row: merged |
| Single-Arm Lat Pulldown | version | `lat_pulldown__cable__one_side` |  |
| Single-Arm Seated Cable Row | version | `seated_row__cable__one_side` |  |
| Smith Machine Bent-Over Row | version | `bent_over_row__smith_machine` |  |
| Smith Machine Inverted Row | version | `inverted_row__bodyweight` | merged: the Smith bar is where the body works: merged into the bodyweight version |
| Smith Machine Shrug | version | `shrug__smith_machine` |  |
| Standing Single-Arm Cable Row | movement | `standing_row__cable__one_side` | standing vs seated changes the numbers (no back support): own movement |
| Straight-Arm Pulldown | version | `straight_arm_pulldown__cable` |  |
| Superman | movement | `superman__bodyweight` |  |
| Suspension Row | version | `inverted_row__suspension_trainer` | suspension version; the research's weight × reps was wrong for a bodyweight row |
| T-Bar Row | movement | `t_bar_row__landmine` |  |
| Trap Bar Shrug | version | `shrug__trap_bar` |  |
| Wall Slide | movement | `wall_slide__bodyweight` |  |
| Weighted Back Extension | version | `back_extension__added_weight` | weighted: the added_weight version |
| Weighted Chin-Up | version | `chin_up__added_weight` | weighted: the added_weight version |
| Weighted Pull-Up | version | `pull_up__added_weight` | weighted: the added_weight version |
| Wide-Grip Seated Cable Row | version | `seated_row__cable` | merged: no wide key: merged into the cable version (user, 2026-10-25; collision seated_row__cable) |
| Yates Row | movement | `yates_row__barbell` | own movement, not a reverse-grip Bent-Over Row: a named exercise |

## Stage 3: legs

195 entries: 54 movements of one version, 131 versions, 10 dropped (pause ×2,
partial range, bands on a bar ×2, a band around the knees, deficit ×2, stance ×2).
The Turkish Get-Up (full body) is here too: a full-body strength entry has no
muscle group of its own.

| Research entry | Outcome | Version id | Note |
|---|---|---|---|
| 45-Degree Hip Extension (Glute Bias) | movement | `hip_extension_45__bodyweight` | own movement, apart from Back Extension: same bodyweight equipment, glute-biased |
| Anderson Squat | movement | `anderson_squat__barbell` | own movement: a dead start from pins, like Pendlay Row |
| Assisted Pistol Squat | version | `pistol_squat__suspension_trainer__one_side` | suspension version of Pistol Squat (the straps assist) |
| B-Stance Hip Thrust | dropped |  | stance (MVP extra) |
| B-Stance Romanian Deadlift | dropped |  | stance (MVP extra) |
| Back Squat | version | `squat__barbell` | Squat is one movement; the barbell version is the back squat ("back squat" stays an alias) |
| Band Good Morning | version | `good_morning__band` |  |
| Band Hip Thrust | version | `hip_thrust__band` |  |
| Band Lateral Walk | movement | `lateral_band_walk__band` |  |
| Band Leg Curl | version | `lying_leg_curl__band` | lying band curl: band version |
| Band Leg Extension | version | `leg_extension__band` |  |
| Banded Deadlift | dropped |  | bands on a bar (MVP extra; user, 2026-10-25) |
| Banded Glute Bridge | dropped |  | a band around the knees is an extra, not the load (MVP extra) |
| Banded Kickback (Glute) | version | `glute_kickback__band` | the band is the load: band version |
| Banded Squat | dropped |  | bands on a bar (MVP extra; user, 2026-10-25) |
| Barbell Bulgarian Split Squat | version | `bulgarian_split_squat__barbell__one_side` |  |
| Barbell Calf Raise | version | `standing_calf_raise__barbell` |  |
| Barbell Curtsy Lunge | version | `curtsy_lunge__barbell__one_side` |  |
| Barbell Glute Bridge | version | `glute_bridge__barbell` |  |
| Barbell Hack Squat | movement | `barbell_hack_squat__barbell` | own movement: the bar behind the legs is a different lift from the machine hack squat |
| Barbell Hip Thrust (Single-Leg) | version | `hip_thrust__barbell__one_side` |  |
| Barbell Lateral Lunge | version | `lateral_lunge__barbell__one_side` |  |
| Barbell Lunge | version | `lunge__barbell__one_side` |  |
| Barbell Reverse Lunge | version | `reverse_lunge__barbell__one_side` |  |
| Barbell Single-Leg Romanian Deadlift | version | `romanian_deadlift__barbell__one_side` |  |
| Barbell Split Squat | version | `split_squat__barbell__one_side` |  |
| Barbell Step-Up | version | `step_up__barbell__one_side` |  |
| Barbell Walking Lunge | version | `walking_lunge__barbell__one_side` |  |
| Belt Squat | movement | `belt_squat__plate_loaded_machine` | its own movement (user, 2026-10-25), not a belt extra |
| Bodyweight Calf Raise | version | `standing_calf_raise__bodyweight` |  |
| Bodyweight Squat | version | `squat__bodyweight` |  |
| Box Squat | version | `box_squat__barbell` |  |
| Bulgarian Split Squat | version | `bulgarian_split_squat__bodyweight__one_side` |  |
| Cable Deadlift | version | `deadlift__cable` |  |
| Cable Glute Kickback | version | `glute_kickback__cable__one_side` |  |
| Cable Hip Abduction | version | `hip_abduction__cable__one_side` |  |
| Cable Hip Adduction | version | `hip_adduction__cable__one_side` |  |
| Cable Hip Flexion (Knee Drive) | movement | `hip_flexion__cable` |  |
| Cable Leg Curl (Standing) | version | `standing_leg_curl__cable__one_side` |  |
| Cable Lunge | version | `lunge__cable__one_side` |  |
| Cable Pull-Through | movement | `cable_pull_through__cable` |  |
| Cable Romanian Deadlift | version | `romanian_deadlift__cable` |  |
| Cable Squat | version | `squat__cable` |  |
| Cambered Bar Squat | version | `squat__specialty_bar` | specialty bar version |
| Clamshell | movement | `clamshell__band__one_side` |  |
| Copenhagen Plank | movement | `copenhagen_plank__bodyweight__one_side` |  |
| Cossack Squat | version | `cossack_squat__bodyweight__one_side` |  |
| Curtsy Lunge | version | `curtsy_lunge__bodyweight__one_side` |  |
| Deadlift | version | `deadlift__barbell` |  |
| Deficit Deadlift | dropped |  | deficit (MVP extra) |
| Deficit Reverse Lunge | dropped |  | deficit (MVP extra) |
| Donkey Calf Raise | movement | `donkey_calf_raise__machine` |  |
| Donkey Kick | movement | `donkey_kick__bodyweight__one_side` |  |
| Double Kettlebell Front Squat | version | `front_squat__kettlebell` | kettlebell version |
| Dumbbell Bulgarian Split Squat | version | `bulgarian_split_squat__dumbbell__one_side` |  |
| Dumbbell Calf Raise | version | `standing_calf_raise__dumbbell` |  |
| Dumbbell Curtsy Lunge | version | `curtsy_lunge__dumbbell__one_side` |  |
| Dumbbell Deadlift | version | `deadlift__dumbbell` |  |
| Dumbbell Front Squat | version | `front_squat__dumbbell` |  |
| Dumbbell Hip Thrust | version | `hip_thrust__dumbbell` |  |
| Dumbbell Lateral Lunge | version | `lateral_lunge__dumbbell__one_side` |  |
| Dumbbell Leg Curl | version | `lying_leg_curl__dumbbell` | lying, with a dumbbell between the feet: dumbbell version |
| Dumbbell Lunge | version | `lunge__dumbbell__one_side` |  |
| Dumbbell Rear Lunge to Press | movement | `rear_lunge_to_press__dumbbell__one_side` |  |
| Dumbbell Reverse Lunge | version | `reverse_lunge__dumbbell__one_side` |  |
| Dumbbell Romanian Deadlift | version | `romanian_deadlift__dumbbell` |  |
| Dumbbell Split Squat | version | `split_squat__dumbbell__one_side` |  |
| Dumbbell Squat | version | `squat__dumbbell` |  |
| Dumbbell Squat to Press | version | `squat_to_press__dumbbell` |  |
| Dumbbell Step-Up | version | `step_up__dumbbell__one_side` |  |
| Dumbbell Stiff-Leg Deadlift | version | `stiff_leg_deadlift__dumbbell` |  |
| Dumbbell Walking Lunge | version | `walking_lunge__dumbbell__one_side` |  |
| Fire Hydrant | movement | `fire_hydrant__bodyweight__one_side` |  |
| Frog Pump | movement | `frog_pump__bodyweight` |  |
| Frog Squat | movement | `frog_squat__bodyweight` |  |
| Front Squat | version | `front_squat__barbell` |  |
| Front-Foot-Elevated Split Squat | movement | `front_foot_elevated_split_squat__dumbbell__one_side` |  |
| Glute Bridge | version | `glute_bridge__bodyweight` |  |
| Glute Ham Developer Hip Extension | movement | `ghd_hip_extension__ghd` |  |
| Glute Kickback Machine | version | `glute_kickback__machine__one_side` |  |
| Glute-Ham Raise | movement | `glute_ham_raise__ghd` |  |
| Goblet Box Squat | movement | `goblet_box_squat__kettlebell` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Goblet Bulgarian Split Squat | movement | `goblet_bulgarian_split_squat__dumbbell__one_side` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Goblet Lateral Lunge | movement | `goblet_lateral_lunge__kettlebell__one_side` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Goblet Reverse Lunge | version | `goblet_reverse_lunge__dumbbell__one_side` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Goblet Split Squat | movement | `goblet_split_squat__dumbbell__one_side` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Goblet Squat | version | `goblet_squat__dumbbell` |  |
| Goblet Step-Up | movement | `goblet_step_up__dumbbell__one_side` | goblet (one weight held at the chest) is its own movement, as Goblet Squat is: the load means something different from a weight in each hand |
| Good Morning | version | `good_morning__barbell` |  |
| Hack Squat | movement | `hack_squat__plate_loaded_machine` | the machine hack squat |
| Hack Squat Calf Raise | movement | `hack_squat_calf_raise__plate_loaded_machine` |  |
| Hammer Strength Leg Press | version | `leg_press__plate_loaded_machine` | merged: Hammer Strength: merged into the plate-loaded version (collision leg_press__plate_loaded_machine) |
| Heel-Elevated Goblet Squat | version | `goblet_squat__dumbbell` | merged: heel wedge does not change the numbers much: merged into the dumbbell version |
| High-Handle Trap Bar Deadlift | movement | `high_handle_trap_bar_deadlift__trap_bar` | own movement: the high handles shorten the pull, so the numbers differ from the trap bar version |
| Hindu Squat | movement | `hindu_squat__bodyweight` |  |
| Hip Abduction Machine | version | `hip_abduction__machine` |  |
| Hip Adduction Machine | version | `hip_adduction__machine` |  |
| Hip Thrust | version | `hip_thrust__barbell` |  |
| Hip Thrust Machine | version | `hip_thrust__plate_loaded_machine` | plate-loaded version |
| Horizontal Leg Press | version | `leg_press__machine` | the selectorized machine version |
| Jefferson Deadlift | movement | `jefferson_deadlift__barbell` |  |
| Kettlebell Bulgarian Split Squat | version | `bulgarian_split_squat__kettlebell__one_side` |  |
| Kettlebell Cossack Squat | version | `cossack_squat__kettlebell__one_side` |  |
| Kettlebell Deadlift | version | `deadlift__kettlebell` |  |
| Kettlebell Goblet Reverse Lunge | version | `goblet_reverse_lunge__kettlebell__one_side` |  |
| Kettlebell Goblet Squat | version | `goblet_squat__kettlebell` |  |
| Kettlebell Lunge | version | `lunge__kettlebell__one_side` |  |
| Kettlebell Reverse Lunge | version | `reverse_lunge__kettlebell__one_side` |  |
| Kettlebell Single-Leg Deadlift | version | `romanian_deadlift__kettlebell__one_side` | a single-leg kettlebell deadlift is the one-leg kettlebell RDL |
| Kettlebell Sumo Deadlift | version | `sumo_deadlift__kettlebell` |  |
| Kettlebell Sumo Squat | version | `sumo_squat__kettlebell` |  |
| Kettlebell Swing to Squat | movement | `swing_to_squat__kettlebell` |  |
| Kettlebell Walking Lunge | version | `walking_lunge__kettlebell__one_side` |  |
| Kneeling Leg Curl | movement | `kneeling_leg_curl__machine` | kneeling machine: own position, own movement |
| Landmine Hip Thrust | version | `hip_thrust__landmine` |  |
| Landmine Reverse Lunge | version | `reverse_lunge__landmine__one_side` |  |
| Landmine Romanian Deadlift | version | `romanian_deadlift__landmine` |  |
| Landmine Squat | version | `squat__landmine` |  |
| Landmine Squat to Press | version | `squat_to_press__landmine` |  |
| Lateral Lunge | version | `lateral_lunge__bodyweight__one_side` |  |
| Lateral Step-Up | movement | `lateral_step_up__dumbbell__one_side` |  |
| Leg Extension | version | `leg_extension__machine` |  |
| Leg Extension (Plate-Loaded) | version | `leg_extension__plate_loaded_machine` |  |
| Leg Press | version | `leg_press__plate_loaded_machine` |  |
| Leg Press Calf Raise | movement | `leg_press_calf_raise__plate_loaded_machine` | own movement: the leg press changes the numbers |
| Low-Bar Back Squat | movement | `low_bar_back_squat__barbell` | own movement: the bar position changes the numbers |
| Lunge | version | `lunge__bodyweight__one_side` | Lunge, Walking Lunge, Reverse Lunge and Split Squat are four movements, as the user's notes list them |
| Lying Leg Curl | version | `lying_leg_curl__machine` | seated vs lying changes the numbers: own movements (user, 2026-10-25) |
| Lying Leg Curl (Plate-Loaded) | version | `lying_leg_curl__plate_loaded_machine` |  |
| Multi-Hip Machine | movement | `multi_hip__machine` |  |
| Nordic Hamstring Curl | movement | `nordic_hamstring_curl__bodyweight` |  |
| Pause Deadlift | dropped |  | pause (MVP extra) |
| Pause Squat | dropped |  | pause (MVP extra) |
| Pendulum Squat | movement | `pendulum_squat__plate_loaded_machine` |  |
| Pin Squat | dropped |  | partial range (MVP extra) |
| Pistol Squat | version | `pistol_squat__bodyweight__one_side` |  |
| Psoas March (Band) | movement | `psoas_march__band` |  |
| Reverse Hack Squat | movement | `reverse_hack_squat__plate_loaded_machine` |  |
| Reverse Hyperextension | movement | `reverse_hyperextension__machine` |  |
| Reverse Lunge | version | `reverse_lunge__bodyweight__one_side` |  |
| Reverse Nordic | movement | `reverse_nordic__bodyweight` |  |
| Romanian Deadlift | version | `romanian_deadlift__barbell` |  |
| Safety Bar Good Morning | version | `good_morning__safety_squat_bar` | safety squat bar version |
| Safety Bar Squat | version | `squat__safety_squat_bar` | safety squat bar version |
| Seated Band Abduction | version | `hip_abduction__band` | band version of Hip Abduction (seated, like the machine) |
| Seated Calf Raise | version | `seated_calf_raise__plate_loaded_machine` |  |
| Seated Dumbbell Calf Raise | version | `seated_calf_raise__dumbbell` |  |
| Seated Leg Curl | movement | `seated_leg_curl__machine` |  |
| Shrimp Squat | movement | `shrimp_squat__bodyweight__one_side` |  |
| Side-Lying Leg Raise | movement | `side_lying_leg_raise__bodyweight__one_side` |  |
| Single-Leg Box Squat | version | `box_squat__bodyweight__one_side` | one-leg bodyweight version of Box Squat |
| Single-Leg Calf Raise | version | `standing_calf_raise__bodyweight__one_side` | one-leg bodyweight version |
| Single-Leg Extension | version | `leg_extension__machine__one_side` | one-leg machine version |
| Single-Leg Glute Bridge | version | `glute_bridge__bodyweight__one_side` |  |
| Single-Leg Hip Thrust | version | `hip_thrust__bodyweight__one_side` |  |
| Single-Leg Leg Press | version | `leg_press__plate_loaded_machine__one_side` |  |
| Single-Leg Romanian Deadlift | version | `romanian_deadlift__dumbbell__one_side` | one-leg dumbbell version of RDL |
| Sissy Squat | movement | `sissy_squat__bodyweight` |  |
| Sled Lunge | movement | `sled_lunge__sled__one_side` | own movement: logged as weight × distance, unlike every lunge |
| Slider Hamstring Curl | version | `hamstring_curl__bodyweight` | sliders are where the body works: bodyweight version |
| Smith Machine Bulgarian Split Squat | version | `bulgarian_split_squat__smith_machine__one_side` |  |
| Smith Machine Calf Raise | version | `standing_calf_raise__smith_machine` |  |
| Smith Machine Deadlift | version | `deadlift__smith_machine` |  |
| Smith Machine Front Squat | version | `front_squat__smith_machine` |  |
| Smith Machine Glute Kickback | version | `glute_kickback__smith_machine` |  |
| Smith Machine Good Morning | version | `good_morning__smith_machine` |  |
| Smith Machine Hip Thrust | version | `hip_thrust__smith_machine` |  |
| Smith Machine Leg Press | version | `leg_press__smith_machine` | Smith version (the user's notes) |
| Smith Machine Lunge | version | `lunge__smith_machine__one_side` |  |
| Smith Machine Reverse Lunge | version | `reverse_lunge__smith_machine__one_side` |  |
| Smith Machine Romanian Deadlift | version | `romanian_deadlift__smith_machine` |  |
| Smith Machine Split Squat | version | `split_squat__smith_machine__one_side` |  |
| Smith Machine Squat | version | `squat__smith_machine` | Smith version |
| Snatch-Grip Deadlift | movement | `snatch_grip_deadlift__barbell` | own movement: no wide grip key, and the snatch grip changes the pull |
| Spanish Squat | movement | `spanish_squat__band` |  |
| Split Squat | version | `split_squat__bodyweight__one_side` |  |
| Stability Ball Hamstring Curl | version | `hamstring_curl__stability_ball` | the floor curls (ball, straps, sliders) are one movement, apart from the machine curls |
| Standing Calf Raise | version | `standing_calf_raise__machine` | seated vs standing changes the numbers: own movements (user, 2026-10-25) |
| Standing Hip Abduction Machine | movement | `standing_hip_abduction__machine` | standing vs seated changes the numbers: own movement |
| Standing Single-Leg Curl | version | `standing_leg_curl__machine__one_side` | standing is a third position: own movement |
| Step-Down (Heel Tap) | movement | `step_down__bodyweight__one_side` |  |
| Step-Up | version | `step_up__bodyweight__one_side` |  |
| Stiff-Leg Deadlift | version | `stiff_leg_deadlift__barbell` |  |
| Sumo Deadlift | version | `sumo_deadlift__barbell` |  |
| Sumo Squat | version | `sumo_squat__dumbbell` |  |
| Suspension Hamstring Curl | version | `hamstring_curl__suspension_trainer` |  |
| Tib Bar Raise | version | `tibialis_raise__tib_bar` | tib bar version of Tibialis Raise; new equipment key tib_bar (user, 2026-10-25) |
| Tibialis Raise | version | `tibialis_raise__bodyweight` |  |
| Trap Bar Deadlift | version | `deadlift__trap_bar` | trap bar version of Deadlift |
| Turkish Get-Up | movement | `turkish_get_up__kettlebell__one_side` |  |
| V-Squat | movement | `v_squat__plate_loaded_machine` |  |
| Vertical Leg Press | movement | `vertical_leg_press__plate_loaded_machine` | own movement: the same plate-loaded equipment as Leg Press but different numbers, so it cannot be a version |
| Walking Lunge | version | `walking_lunge__bodyweight__one_side` |  |
| Wall Sit | movement | `wall_sit__bodyweight` |  |
| Zercher Squat | movement | `zercher_squat__barbell` |  |

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

**Stage 2** (lats, middle back, lower back, traps, neck): 89 reference entries.
44 match by name (Rack Pulls now, and Rack Pull with Bands, whose bands are an
MVP extra), 25 are covered under another name (long-bar rows = Meadows and
T-Bar Row, "Leverage Iso Row" = Seated Row plate-loaded, "Suspended Row" = Inverted
Row suspension), 8 are in the research for a later stage (Deadlift, Good Morning,
Sled Row, the neck resistance work), 4 are MVP extras (bands, chains, deficit). **Added: 0. Skipped as niche: 8:** Gironda Sternum Chins; London Bridges;
Middle Back Shrug; Mixed Grip Chin; Rocky Pull-Ups/Pulldowns; Side To Side Chins;
Weighted Ball Hyperextension; Wide-Grip Rear Pull-Up.

**Stage 3** (quadriceps, hamstrings, glutes, calves, adductors, abductors): 139
reference entries. 75 match by name, 18 are covered under another name ("Thigh
Abductor" = Hip Abduction, "Natural Glute Ham Raise" = Nordic Hamstring Curl, "Calf
Press On The Leg Press Machine" = Leg Press Calf Raise), 17 are in the research for a
later stage (the cleans and jerks, Jump Squat, kettlebell swings, Flutter Kick), 13
are MVP extras (chains, bands, speed work, stance, pins, an elevated lunge). **Added:
0. Skipped as niche: 16:** Balance Board; Downward Facing Balance; Hip Extension with
Bands; Jefferson Squats; Kneeling Squat; Lunge Pass Through; Lunge Sprint; One-Arm
Overhead Kettlebell Squats; One-Arm Side Deadlift; Physioball Hip Bridge; Prone Manual
Hamstring; Rocking Standing Calf Raise; Squat with Plate Movers; Suspended Split
Squat; Weighted Sissy Squat; Weighted Squat.

## Added (no research entry)

| Version id | Why |
|---|---|
| `dip__added_weight` | weighted triceps dip (stage 1 review): every bodyweight dip gets its weighted version; the research had only Weighted Chest Dip |
