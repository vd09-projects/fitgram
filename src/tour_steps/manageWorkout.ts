import { SCREEN_NAMES } from "../constants/tourSteps";
import { EDITABLE_LIST_STEP_NAMES, SEARCHABLE_INPUT_STEP_NAMES } from "./commonStepNames";
import { START_WOURKOUT_STEP_NAMES } from "./startWorkout";
import { generateStepsFromMap } from "./utils";

export const MANAGE_WOURKOUT_STEP_NAMES = {
  NEW_AND_UPDATE_BUTTON: "MANAGE_WORKOUT_NEW_AND_UPDATE_BUTTON",
  WORKOUT_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_WORKOUT",
  EXERCISE_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_EXERCISE",
  EXERCISE_EDITABLE_LIST: "MANAGE_WOURKOUT_EXERCISE_EDITABLE_LIST",
  SAVE_BUTTON: "MANAGE_WORKOUT_SAVE_BUTTON",
  WORKOUT_FOOTER_BUTTON: "MANAGE_WORKOUT_FOOTER_BUTTON",
}

const WORKOUT_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.NEW_BUTTON]: {
    title: "Click this button to create a new workout",
    description: "Tap this button to create a new workout entry.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
  [SEARCHABLE_INPUT_STEP_NAMES.INPUT_AND_SAVE]: {
    title: "Enter Workout Name",
    description: "Write the name of your new workout in the input field and press save on right.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const EXERCISE_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Select a Exercise",
    description: "Choose a exercise from the list to manage or log.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const EXERCISE_EDITABLE_LIST_TOUR_STEPS = {
  [EDITABLE_LIST_STEP_NAMES.EXISTING_ITEM]: {
    title: "Existing Tracking Metrics",
    description: "Here are the existing metrics for the selected exercise. you can update name and remove them by presing crose on right on each metric.",
    screen: SCREEN_NAMES.EDITABLE_LIST,
  },
  [EDITABLE_LIST_STEP_NAMES.ADD_NEW_ITEM]: {
    title: "Add New Tracking Metric",
    description: "You can add a new metric by pressing the plus button on right.",
    screen: SCREEN_NAMES.EDITABLE_LIST,
  },
}

const TOUR_STEPS = {
  [MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON]: {
    title: "You can add/update a workout",
    description: "Tap this button to add or update your workout details.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_SEARCHABLE]: WORKOUT_SEARCHABLE_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE]: EXERCISE_SEARCHABLE_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_EDITABLE_LIST]: EXERCISE_EDITABLE_LIST_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.SAVE_BUTTON]: {
    title: "Save Your Workout",
    description: "Press this button to save your workout details.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_FOOTER_BUTTON]: {
    title: "Access Your Workout Options",
    description: "Tap this button to explore tour of other Workout related options.",
    screen: SCREEN_NAMES.FOOTER,
    nextStepId: START_WOURKOUT_STEP_NAMES.SEARCH_BOX,
  },
};

export const SELECTED_INPUT_STEPS = generateStepsFromMap(TOUR_STEPS);