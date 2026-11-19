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
    // One workout: every lift a card (TICKET-083).
    Session: "Session",
    // One lift's log across workouts (TICKET-084). Opened from a Session's compare, later from the Exercises tab (085b).
    Exercise: "Exercise",
    // Debug tooling, kept (TICKET-070): PlansStoreDebugScreen.
    PlansStoreDebug: "PlansStoreDebug",
} as const;