import { SELECTED_INPUT_STEPS } from "./manageWorkout";


export const TOUR_STEPS = {
  WORKOUT_BUTTON: {
    id: "WORKOUT_BUTTON",
    title: "Access Your Workout Options",
    description: "Tap this button to view your Workout related options.",
    nextStepId: "MANAGE_WORKOUT_NEW_AND_UPDATE_BUTTON",
    screen: "Footer",
  },
  ...SELECTED_INPUT_STEPS,
};