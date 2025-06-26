import { ACTIVE_WORKOUT_GENERATED_TOUR_STEPS, ACTIVE_WORKOUT_STEP_NAMES } from "./activeWorkout";
import { SELECTED_INPUT_STEPS } from "./manageWorkout";
import { START_WOURKOUT_GENERATED_TOUR_STEPS } from "./startWorkout";


export const TOUR_STEPS = {
  WORKOUT_BUTTON: {
    id: "WORKOUT_BUTTON",
    title: "Access Your Workout Options",
    description: "Tap this button to view your Workout related options.",
    // nextStepId: MANAGE_WOURKOUT_STEP_NAMES.NEW_AND_UPDATE_BUTTON,
    // nextStepId: START_WOURKOUT_STEP_NAMES.START_WORKOUT_BUTTON,
    nextStepId: ACTIVE_WORKOUT_STEP_NAMES.LOG_ACTIVE_WORKOUT_BUTTON,
    screen: "Footer",
  },
  ...SELECTED_INPUT_STEPS,
  ...START_WOURKOUT_GENERATED_TOUR_STEPS,
  ...ACTIVE_WORKOUT_GENERATED_TOUR_STEPS,
};