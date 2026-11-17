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
    // The History home (TICKET-085a). Reached from the TEMPORARY "History (new)" hub button until 085b.
    HistoryHome: "HistoryHome",
    // TEMPORARY placeholder until TICKET-083 builds the real Session screen.
    Session: "Session",
    // Debug tooling, kept (TICKET-070): PlansStoreDebugScreen.
    PlansStoreDebug: "PlansStoreDebug",
} as const;