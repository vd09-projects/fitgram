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
            }
        },
        predefinedExercises: "predefined_exercises",
    }
}