import {
  EDITABLE_LIST_STEP_NAMES,
  SCREEN_NAMES,
  SEARCHABLE_INPUT_STEP_NAMES,
} from "./commonStepNames";
import { START_WOURKOUT_STEP_NAMES } from "./startWorkout";
import { generateStepsFromMap } from "./utils";

export const MANAGE_WOURKOUT_STEP_NAMES = {
  NEW_AND_UPDATE_BUTTON: "MANAGE_WORKOUT_NEW_AND_UPDATE_BUTTON",
  WORKOUT_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_WORKOUT",
  EXERCISE_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_EXERCISE",
  EXERCISE_EDITABLE_LIST: "MANAGE_WOURKOUT_EXERCISE_EDITABLE_LIST",
  SAVE_BUTTON: "MANAGE_WORKOUT_SAVE_BUTTON",
  WORKOUT_FOOTER_BUTTON: "MANAGE_WORKOUT_FOOTER_BUTTON",
};

const WORKOUT_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.NEW_BUTTON]: {
    title: "Create a New Workout",
    description: "Tap this button to start creating a new workout entry.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
  [SEARCHABLE_INPUT_STEP_NAMES.INPUT_AND_SAVE]: {
    title: "Name Your Workout",
    description:
      "Enter the name of your new workout in the input field and press the save button on the right.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
};

const EXERCISE_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Select an Exercise",
    description: "Choose an exercise from the list to manage or log.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
};

const EXERCISE_EDITABLE_LIST_TOUR_STEPS = {
  [EDITABLE_LIST_STEP_NAMES.EXISTING_ITEM]: {
    title: "View Existing Tracking Metrics",
    description:
      "These are the current metrics for the selected exercise. You can rename them or remove any by pressing the cross icon on the right.",
    screen: SCREEN_NAMES.EDITABLE_LIST,
  },
  [EDITABLE_LIST_STEP_NAMES.ADD_NEW_ITEM]: {
    title: "Add a New Tracking Metric",
    description:
      "Press the plus button on the right to add a new tracking metric for this exercise.",
    screen: SCREEN_NAMES.EDITABLE_LIST,
  },
};

const TOUR_STEPS = {
  [MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_FOOTER_BUTTON]: {
    title: "Explore Workout Options",
    description:
      "Tap this button to explore other available workout options and start the guided tour.",
    screen: SCREEN_NAMES.FOOTER,
  },
  [MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON]: {
    title: "Add or Update a Workout",
    description:
      "Tap this button to create a new workout or update an existing one.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_SEARCHABLE]:
    WORKOUT_SEARCHABLE_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE]:
    EXERCISE_SEARCHABLE_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_EDITABLE_LIST]:
    EXERCISE_EDITABLE_LIST_TOUR_STEPS,
  [MANAGE_WOURKOUT_STEP_NAMES.SAVE_BUTTON]: {
    title: "Save Workout",
    description: "Press this button to save all the details of your workout.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
    nextStepId: START_WOURKOUT_STEP_NAMES.WORKOUT_FOOTER_BUTTON,
  },
};

export const SELECTED_INPUT_STEPS = generateStepsFromMap(TOUR_STEPS);
