import { SCREEN_NAMES } from "../constants/tourSteps";
import { SEARCH_BOX_STEP_NAMES } from "./commonStepNames";
import { generateStepsFromMap } from "./utils";

export const START_WOURKOUT_STEP_NAMES = {
  START_WORKOUT_BUTTON: "START_WORKOUT_BUTTON",
  SEARCH_BOX: "START_WORKOUT_SEARCH_BOX",
  SEARCHED_WORKOUT_ITEMS: "START_WORKOUT_SEARCHED_WORKOUT_ITEMS",
  SELECTED_WORKOUT_EXERCISE_LIST:
    "START_WORKOUT_SELECTED_WORKOUT_EXERCISE_LIST",
  START_SELECTED_WORKOUT_BUTTON: "START_WORKOUT_START_SELECTED_WORKOUT_BUTTON",
};

const SEARCH_BOX_TOUR_STEPS = {
  [SEARCH_BOX_STEP_NAMES.SEARCH_BOX]: {
    title: "Search for a Workout",
    description: "Tap here to search for a workout by name.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
};

const START_WOURKOUT_TOUR_STEPS = {
  [START_WOURKOUT_STEP_NAMES.START_WORKOUT_BUTTON]: {
    title: "Start a Workout",
    description: "Tap this button to begin a new workout session.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.SEARCH_BOX]: SEARCH_BOX_TOUR_STEPS,
  [START_WOURKOUT_STEP_NAMES.SEARCHED_WORKOUT_ITEMS]: {
    title: "Select a Workout",
    description:
      "Choose a workout from the list to get started. If you’ve already selected one, you can scroll to the right to see more options.",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.SELECTED_WORKOUT_EXERCISE_LIST]: {
    title: "Exercises in This Workout",
    description:
      "These are the exercises included in the selected workout. You can track your progress for each exercise here.",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
  [START_WOURKOUT_STEP_NAMES.START_SELECTED_WORKOUT_BUTTON]: {
    title: "Begin Workout",
    description: "Press this button to start tracking your workout session.",
    screen: SCREEN_NAMES.START_WORKOUT_SCREEN,
  },
};

export const START_WOURKOUT_GENERATED_TOUR_STEPS = generateStepsFromMap(
  START_WOURKOUT_TOUR_STEPS
);
