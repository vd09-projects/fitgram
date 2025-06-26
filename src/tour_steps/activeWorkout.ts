import { SCREEN_NAMES } from "../constants/tourSteps";
import { SEARCHABLE_INPUT_STEP_NAMES } from "./commonStepNames";
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
    title: "Select a Exercise",
    description: "Choose a exercise from the list to log.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const ACTIVE_WORKOUT_TOUR_STEPS = {
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_ACTIVE_WORKOUT_BUTTON]: {
    title: "Start Logging Workout",
    description: "Tap this button to begin logging your workout session.",
    screen: SCREEN_NAMES.FOOTER,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE]: EXERCISE_SEARCHABLE_TOUR_STEPS,
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_HISTORY]: {
    title: "Workout History",
    description: "View your previously logged sets and exercises for this workout.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.LOG_FIELDS]: {
    title: "Enter Exercise Details",
    description:
      "Fill in the sets, reps, and weights for your selected exercise.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SAVE_EXERCISE_SET]: {
    title: "Save Exercise Set",
    description: "Tap here to save the current set for this exercise.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.CANCEL_CURRENT_WORKOUT_LOGER]: {
    title: "Cancel Logging",
    description:
      "Click to cancel logging your current workout and discard changes.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
  [ACTIVE_WORKOUT_STEP_NAMES.SAVE_CURRENT_WORKOUT_LOGER]: {
    title: "Save Workout Log",
    description: "Press this button to save your entire workout log.",
    screen: SCREEN_NAMES.ACTIVE_WORKOUT,
  },
};

export const ACTIVE_WORKOUT_GENERATED_TOUR_STEPS = generateStepsFromMap(
  ACTIVE_WORKOUT_TOUR_STEPS
);
