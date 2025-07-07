import { SCREEN_NAMES, SEARCHABLE_INPUT_STEP_NAMES } from "./commonStepNames";
import { generateStepsFromMap } from "./utils";

export const ACTIVE_WORKOUT_STEP_NAMES = {
  LOG_ACTIVE_WORKOUT_BUTTON: "ACTIVE_WORKOUT_LOG_ACTIVE_WORKOUT_BUTTON",
  SELECTED_WORKOUT_EXERCISE: "ACTIVE_WORKOUT_SELECTED_WORKOUT_EXERCISE",
  LOG_HISTORY: "ACTIVE_WORKOUT_LOG_HISTORY",
  LOG_FIELDS: "ACTIVE_WORKOUT_LOG_FIELDS",
  SAVE_EXERCISE_SET: "ACTIVE_WORKOUT_SAVE_EXERCISE_SET",
  CANCEL_CURRENT_WORKOUT_LOGER: "ACTIVE_WORKOUT_CANCEL_CURRENT_WORKOUT_LOGER",
  SAVE_CURRENT_WORKOUT_LOGER: "ACTIVE_WORKOUT_SAVE_CURRENT_WORKOUT_LOGER",
};

const EXERCISE_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Select an Exercise",
    description: "Open the list to choose an exercise you want to log.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
};

const ACTIVE_WORKOUT_TOUR_STEPS = {
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_ACTIVE_WORKOUT_BUTTON]: {
    title: "Start Logging Your Workout",
    description: "Tap this button to begin recording your workout session.",
    screen: SCREEN_NAMES.FOOTER,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE]:
    EXERCISE_SEARCHABLE_TOUR_STEPS,
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_HISTORY]: {
    title: "View Workout History",
    description:
      "See all the sets and exercises you’ve previously logged during this workout.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_FIELDS]: {
    title: "Enter Exercise Details",
    description:
      "Provide information for the current exercise, including the number of sets, repetitions, and the weight used.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SAVE_EXERCISE_SET]: {
    title: "Save This Exercise Set",
    description:
      "Tap here to save the details of the current set you’ve entered.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.CANCEL_CURRENT_WORKOUT_LOGER]: {
    title: "Cancel Workout Logging",
    description:
      "Click this button to cancel logging your current workout and discard any unsaved changes.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SAVE_CURRENT_WORKOUT_LOGER]: {
    title: "Save Workout Log",
    description:
      "Press this button to save all exercises and sets recorded in this workout session.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
};

export const ACTIVE_WORKOUT_GENERATED_TOUR_STEPS = generateStepsFromMap(
  ACTIVE_WORKOUT_TOUR_STEPS
);
