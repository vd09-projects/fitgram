export const AuthRoutes = {
    SignIn: "SignIn",
    SignUp: "SignUp",
} as const;

export const LayoutRoutes = {
    Feed: "Feed",
    Workout: "Workout",
    Home: "Home",
    Profile: "Profile",
    LogWorkout: "LogWorkout",
} as const;

export const WorkoutRoutes = {
    WorkoutLogs: "WorkoutLogs",
    AddExercise: "AddExercise",
    StartWorkout: "StartWorkout",
    LogWorkout: "LogWorkout",
    WorkoutHome: "WorkoutHome",
} as const;