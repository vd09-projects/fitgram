import { SCREEN_NAMES } from "../constants/tourSteps";
import { generateStepsFromMap } from "./utils";

export const EDITABLE_LIST_STEP_NAMES = {

}

export const SEARCHABLE_INPUT_STEP_NAMES = {
  NEW_BUTTON: "SEARCHABLE_INPUT_DROPDOWN_NEW_BUTTON",
  OLD_BUTTON: "SEARCHABLE_INPUT_DROPDOWN_OLD_BUTTON",
  INPUT_AND_SAVE: "SEARCHABLE_INPUT_DROPDOWN_INPUT_AND_SAVE",
  DROPDOWN_BUTTON: "SEARCHABLE_INPUT_DROPDOWN_DROPDOWN_BUTTON",
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
}

const TOUR_STEP2 = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Select a Exercise",
    description: "Choose a exercise from the list to manage or log.",
    screen: SCREEN_NAMES.SEARCHABLE_INPUT_DROPDOWN,
  },
}

const TOUR_STEP3 = {
  [SEARCHABLE_INPUT_STEP_NAMES.DROPDOWN_BUTTON]: {
    title: "Select a Exercise",
    description: "Choose a exercise from the list to manage or log.",
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
  [MANAGE_WOURKOUT_STEP_NAMES.EXERCISE_SEARCHABLE]: TOUR_STEP2,
};

export const SELECTED_INPUT_STEPS = generateStepsFromMap(TOUR_STEPS);