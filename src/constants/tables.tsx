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
        predefinedExercises: "predefined_exercises",
    },
};