import { SCREEN_NAMES } from "./commonStepNames";
import { MANAGE_WOURKOUT_STEP_NAMES } from "./manageWorkout";
import { generateStepsFromMap } from "./utils";

export const FEED_STEP_NAMES = {
  FEED: "FEED_BUTTON",
};

const FOOTER_TOUR_STEPS = {
  [FEED_STEP_NAMES.FEED]: {
    title: "View Your Feed",
    description:
      "Tap this button to see the latest updates and posts in your feed.",
    screen: SCREEN_NAMES.FOOTER,
    nextStepId: MANAGE_WOURKOUT_STEP_NAMES.WORKOUT_FOOTER_BUTTON,
  },
};

export const FOOTER_GENERATED_TOUR_STEPS =
  generateStepsFromMap(FOOTER_TOUR_STEPS);

export const PROFILE_STEP_NAMES = {
  PROFILE_BUTTON: "PROFILE_BUTTON",
  DETAILS: "PROFILE_DETAILS",
  THEMES: "PROFILE_THEME",
  START_TOUR_BUTTON: "PROFILE_START_TOUR",
};

const PROFILE_TOUR_STEPS = {
  [PROFILE_STEP_NAMES.PROFILE_BUTTON]: {
    title: "Open Your Profile",
    description: "Tap this button to view and manage your profile.",
    screen: SCREEN_NAMES.HEADER,
  },
  [PROFILE_STEP_NAMES.DETAILS]: {
    title: "Profile Details",
    description:
      "View your personal information, including your name, email, and other details.",
    screen: SCREEN_NAMES.PROFILE_SCREEN,
  },
  [PROFILE_STEP_NAMES.THEMES]: {
    title: "Customize Your Theme",
    description: "Choose a theme to personalize the look and feel of your app.",
    screen: SCREEN_NAMES.PROFILE_SCREEN,
  },
  [PROFILE_STEP_NAMES.START_TOUR_BUTTON]: {
    title: "Restart the Tour",
    description:
      "Want to see this walkthrough again later? Tap here to restart the tour anytime.",
    screen: SCREEN_NAMES.PROFILE_SCREEN,
    nextStepId: FEED_STEP_NAMES.FEED,
  },
};

export const PROFILE_GENERATED_TOUR_STEPS =
  generateStepsFromMap(PROFILE_TOUR_STEPS);

export const HOME_STEP_NAMES = {
  HOME_BUTTON: "HOME_BUTTON",
  HOME_PAGE: "HOME_PAGE",
};

const HOME_TOUR_STEPS = {
  [HOME_STEP_NAMES.HOME_BUTTON]: {
    title: "Go to Home",
    description:
      "Tap here to return to the home screen and start exploring the app.",
    screen: SCREEN_NAMES.HEADER,
  },
  [HOME_STEP_NAMES.HOME_PAGE]: {
    title: "Your Home Dashboard",
    description:
      "This area will show your profile information and app branding.",
    screen: SCREEN_NAMES.HOME_SCREEN,
    nextStepId: PROFILE_STEP_NAMES.PROFILE_BUTTON,
  },
};

export const HOME_GENERATED_TOUR_STEPS = generateStepsFromMap(HOME_TOUR_STEPS);
