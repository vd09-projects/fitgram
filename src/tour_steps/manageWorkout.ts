import { SCREEN_NAMES } from "../constants/tourSteps";
import { generateStepsFromMap } from "./utils";

export const SEARCHABLE_INPUT_STEP_NAMES = {
  NEW_BUTTON: "SEARCHABLE_INPUT_DROPDOWN_NEW_BUTTON",
  OLD_BUTTON: "SEARCHABLE_INPUT_DROPDOWN_OLD_BUTTON",
  INPUT_AND_SAVE: "SEARCHABLE_INPUT_DROPDOWN_INPUT_AND_SAVE",
}

export const MANAGE_WOURKOUT_STEP_NAMES = {
  NEW_AND_UPDATE_BUTTON: "MANAGE_WORKOUT_NEW_AND_UPDATE_BUTTON",
  WORKOUT_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_WORKOUT",
  EXERCISE_SEARCHABLE: "MANAGE_WORKOUT_SEARCHABLE_EXERCISE",
}

const TOUR_STEP1 = {
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
  [SEARCHABLE_INPUT_STEP_NAMES.OLD_BUTTON]: {
    title: "Click this button to select an existing workout",
    description: "Tap this button to select from existing workout entry.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const TOUR_STEPS = {
  [MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON]: {
    title: "You can add/update a workout",
    description: "Tap this button to add or update your workout details.",
    screen: SCREEN_NAMES.WORKOUT_SCREEN,
  },
  [MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_SEARCHABLE]: TOUR_STEP1,
};

export const SELECTED_INPUT_STEPS = generateStepsFromMap(TOUR_STEPS);