import { SCREEN_NAMES } from "../constants/tourSteps";
import { SEARCH_BOX_STEP_NAMES } from "./commonStepNames";
import { generateStepsFromMap } from "./utils";

export const START_WOURKOUT_STEP_NAMES = {
  START_WORKOUT_BUTTON: "START_WORKOUT_BUTTON",
  SEARCH_BOX: "START_WORKOUT_SEARCH_BOX",
  SEARCHED_WORKOUT_ITEMS: "START_WORKOUT_SEARCHED_WORKOUT_ITEMS",
  SELECTED_WORKOUT_EXERCISE_LIST: "START_WORKOUT_SELECTED_WORKOUT_EXERCISE_LIST",
  START_SELECTED_WORKOUT_BUTTON: "START_WORKOUT_START_SELECTED_WORKOUT_BUTTON",
};

const SEARCH_BOX_TOUR_STEPS = {
  [SEARCH_BOX_STEP_NAMES.SEARCH_BOX]: {
    title: "Click this button to create a new workout",
    description: "Tap this button to create a new workout entry.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const START_WOURKOUT_TOUR_STEPS = {
  [START_WOURKOUT_STEP_NAMES.START_WORKOUT_BUTTON]: {
    title: "Start a Workout",
    description: "Tap this button to begin your workout session.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.SEARCH_BOX]: SEARCH_BOX_TOUR_STEPS,
  [START_WOURKOUT_STEP_NAMES.SEARCHED_WORKOUT_ITEMS]: {
    title: "Select a Workout",
    description: "Choose a workout from the list to start. if already selected then scroll to right side also available.",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE_LIST]: {
    title: "Selected Workout Exercises",
    description: "Here are the exercises to track in this selected workout",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.START_SELECTED_WORKOUT_BUTTON]: {
    title: "Start Workout",
    description: "Press this button to start your workout session.",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
};

export const START_WOURKOUT_GENERATED_TOUR_STEPS = generateStepsFromMap(
  START_WOURKOUT_TOUR_STEPS
);
