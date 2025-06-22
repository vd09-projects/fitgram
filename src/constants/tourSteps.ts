// src/constants/tourSteps.ts

export type TourStepConfig = {
  id: string;
  title: string;
  description: string;
  nextStepId?: string | null;
  screen?: string;
};

export const TOUR_STEPS: Record<string, TourStepConfig> = {
  HOME_BUTTON: {
    id: "HOME_BUTTON",
    title: "Get Started from Home",
    description: "Tap here to begin exploring the app.",
    nextStepId: "HOME_PAGE",
    screen: "Header",
  },
  HOME_PAGE: {
    id: "HOME_PAGE",
    title: "Your App Identity",
    description:
      "This section will soon display your profile details and app branding.",
    screen: "HomeScreen",
    nextStepId: "PROFILE_BUTTON",
  },
  PROFILE_BUTTON: {
    id: "PROFILE_BUTTON",
    title: "Access Your Profile",
    description: "Tap this button to view and manage your profile settings.",
    nextStepId: "PROFILE_DETAILS",
    screen: "Header",
  },
  PROFILE_DETAILS: {
    id: "PROFILE_DETAILS",
    title: "View Profile Information",
    description:
      "Here you can see your personal details like name, email, and more.",
    nextStepId: "PROFILE_THEME",
    screen: "ProfileScreen",
  },
  PROFILE_THEME: {
    id: "PROFILE_THEME",
    title: "Customize Profile Theme",
    description:
      "Choose from various themes to personalize your app experience.",
    nextStepId: "PROFILE_START_TOUR",
    screen: "ProfileScreen",
  },
  PROFILE_START_TOUR: {
    id: "PROFILE_START_TOUR",
    title: "Restart the Tour",
    description:
      "Want to take the tour again later? Tap here to restart it anytime.",
    nextStepId: "FEED_BUTTON",
    screen: "ProfileScreen",
  },
  FEED_BUTTON: {
    id: "FEED_BUTTON",
    title: "Access Your Feed",
    description: "Tap this button to view your feed of updates and posts.",
    nextStepId: "WORKOUT_BUTTON",
    screen: "Footer",
  },
    WORKOUT_BUTTON: {
    id: "WORKOUT_BUTTON",
    title: "Access Your Workout Options",
    description: "Tap this button to view your Workout related options.",
    nextStepId: "ADD_NEW_WORKOUT_BUTTON",
    screen: "Footer",
  },
  ADD_NEW_WORKOUT_BUTTON: {
    id: "ADD_NEW_WORKOUT_BUTTON",
    title: "You can add/update a workout",
    description: "Tap this button to add or update your workout details.",
    // nextStepId: "PROFILE_DETAILS",
    screen: "WorkoutScreen",
  },
  START_WORKOUT_BUTTON: {
    id: "START_WORKOUT_BUTTON",
    title: "You can start a workout",
    description: "Tap this button to start your workout session.",
    // nextStepId: "PROFILE_DETAILS",
    screen: "WorkoutScreen",
  },
};

// Example usage:
// const feedButtonStep = TOUR_STEPS["FEED_BUTTON"];
// console.log(feedButtonStep.title); // "Access Your Feed"

export const RETAIN_SCREENS_TOUR_STEPS = [
  // TOUR_STEPS.HOME_BUTTON.screen,
  TOUR_STEPS.PROFILE_THEME.screen,
  TOUR_STEPS.FEED_BUTTON.screen,
];

export const FIRST_TOUR_STEP_ID = TOUR_STEPS.PROFILE_THEME.id;
