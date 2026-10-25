// src/constants/tables.tsx
export const tables = {
    users: {
        collection: "users",
        fields: {
            info: {
                collection: "info",
                value: "data",
                fields: {
                    name: "name",
                    email: "email",
                    uid: "uid",
                    role: "role",
                    createdAt: "createdAt",
                },
            },

            workouts: {
                collection: "workouts",
                fields: {
                    isActive: "isActive",
                    exercises: {
                        collection: "exercises",
                        fields: {
                            label: "label",
                            value: "value",
                            fields: "fields",
                        },
                    },
                },
            },

            // Exercise-first history (supersedes workout_logs). The active
            // workout flow asks "what did I do last time on THIS exercise, in
            // any workout", so exercise id is the primary key.
            sessions: {
                collection: "sessions",
            },
            exercise_sessions: {
                collection: "exercise_sessions",
            },
            exercise_stats: {
                collection: "exercise_stats",
            },

            // Legacy: written by the removed saveActiveWorkoutLog, read by
            // nothing. Deleted by the TICKET-042 wipe (wipeTestData.ts); the
            // names stay only as a record of the old shape.
            workout_logs: {
                collection: "workout_logs",
                fields: {
                    logs: {
                        collection: "logs",
                        fields: {
                            timestamp: "timestamp", // Log timestamp
                            exercises: {
                                collection: "exercises",
                                fields: {
                                    exerciseId: "exerciseId",
                                    exerciseName: "exerciseName",
                                    sets: "sets",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};