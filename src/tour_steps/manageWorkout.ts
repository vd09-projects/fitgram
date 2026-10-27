import {
  EDITABLE_LIST_STEP_NAMES,
  EXERCISE_PICKER_STEP_NAMES,
  SCREEN_NAMES,
  SEARCH_BOX_STEP_NAMES,
  SEARCHABLE_INPUT_STEP_NAMES,
} from "./commonStepNames";
import { START_WOURKOUT_STEP_NAMES } from "./startWorkout";
import { generateStepsFromMap } from "./utils";

export const MANAGE_WOURKOUT_STEP_NAMES = {
  NEW_AND_UPDATE_BUTTON: "MANAGE_WORKOUT_NEW_AND_UPDATE_BUTTON",
  WORKOUT_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_WORKOUT",
  EXERCISE_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_EXERCISE",
  EXERCISE_PICKER: "MANAGE_WORKOUT_EXERCISE_PICKER",
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

// TICKET-043: the Exercise dropdown is gone. Its step id is kept and now marks
// the button that opens the exercise picker, so the tour's order is unchanged.
const EXERCISE_SEARCHABLE_TOUR_STEPS = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Add an Exercise",
    description: "Tap here to open the exercise catalog.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
};

const EXERCISE_PICKER_TOUR_STEPS = {
  [SEARCH_BOX_STEP_NAMES.SEARCH_BOX]: {
    title: "Search the Catalog",
    description:
      "Type a name, a muscle or equipment: \"bench\", \"chest\", \"db bench\". Typos are fine.",
    screen: SCREEN_NAMES.EXERCISE_PICKER,
  },
  [EXERCISE_PICKER_STEP_NAMES.VERSION_SHEET]: {
    title: "Choose the Version",
    description:
      "Pick the equipment and, where it applies, the angle, grip or side. Greyed out options do not exist or are already in this plan.",
    screen: SCREEN_NAMES.EXERCISE_PICKER,
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
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_PICKER]: EXERCISE_PICKER_TOUR_STEPS,
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
