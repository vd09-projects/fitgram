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
    // TEMPORARY — remove with ExerciseHistoryDebugScreen.
    HistoryDebug: "HistoryDebug",
    // TEMPORARY — remove with PendingUploadsDebugScreen.
    PendingUploadsDebug: "PendingUploadsDebug",
    // TEMPORARY — remove with CatalogDebugScreen.
    CatalogDebug: "CatalogDebug",
} as const;