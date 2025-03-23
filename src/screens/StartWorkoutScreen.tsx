import React, { useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ScrollView,
    StyleSheet
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import { WorkoutPlan } from "../types/workoutType";
import { COLORS } from "../constants/styles";
import ScrollableScreen from "../components/ScrollableScreen";

export default function StartWorkoutScreen() {
    const workoutPlans = useWorkoutPlans(true);
    const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);

    const handleStartWorkout = () => {
        if (selectedWorkout) {
            console.log(`Starting workout: ${selectedWorkout.name}`);
        }
    };

    return (
        <ScrollableScreen
            title={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="arm-flex-outline" size={24} color={COLORS.textPrimary} style={{ marginRight: 5 }} />
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary }}>Start Workout</Text>
                    <MaterialCommunityIcons name="arm-flex-outline" size={24} color={COLORS.textPrimary} style={{ marginLeft: 5, transform: [{ scaleX: -1 }] }} />
                </View>
            }
        >
            {/* 🏋️ Workout Grid Selection */}
            <FlatList
                data={workoutPlans}
                key={selectedWorkout ? "horizontal" : "grid"}
                keyExtractor={(item) => item.id}
                horizontal={!!selectedWorkout}
                showsHorizontalScrollIndicator={!!selectedWorkout}
                numColumns={selectedWorkout ? undefined : 2}
                columnWrapperStyle={!selectedWorkout ? styles.gridRow : null}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.workoutCard,
                            selectedWorkout?.id === item.id && styles.selectedWorkout
                        ]}
                        onPress={() => setSelectedWorkout(item)}
                    >
                        <Text style={styles.workoutTitle}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />

            {/* ▶️ Floating Start Workout Button */}
            {selectedWorkout && (
                <TouchableOpacity style={styles.startWorkoutButton} onPress={handleStartWorkout}>
                    <Text style={styles.startWorkoutText}>Start {selectedWorkout.name}</Text>
                </TouchableOpacity>
            )}

            {/* 📜 Exercise List (Shown only when a workout is selected) */}
            {selectedWorkout && (
                <ScrollView style={styles.exerciseList}>
                    <Text style={styles.exerciseHeader}>Exercises in {selectedWorkout.name}</Text>
                    {selectedWorkout.exercises.map((exercise) => (
                        <View key={exercise.id} style={styles.exerciseCard}>
                            <Ionicons name="barbell-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.exerciseText}>{exercise.name}</Text>
                        </View>
                    ))}
                </ScrollView>
            )}
        </ScrollableScreen>
    );
}

const styles = StyleSheet.create({
    header: {
        fontSize: 24,
        fontWeight: "bold",
        color: COLORS.textPrimary,
        textAlign: "center",
        marginBottom: 20,
    },
    quickStartCard: {
        backgroundColor: COLORS.primary,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 15,
    },
    quickStartText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "white",
    },
    gridRow: {
        justifyContent: "space-between",
        marginBottom: 10,
    },
    workoutCard: {
        flex: 1,
        backgroundColor: COLORS.secondary,
        padding: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 5,
    },
    selectedWorkout: {
        borderColor: COLORS.primary,
        borderWidth: 2,
    },
    workoutTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: COLORS.textPrimary,
        textAlign: "center",
    },
    exerciseList: {
        marginTop: 20,
    },
    exerciseHeader: {
        fontSize: 18,
        fontWeight: "bold",
        color: COLORS.textPrimary,
        marginBottom: 10,
    },
    exerciseCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        backgroundColor: COLORS.textPrimary,
        borderRadius: 8,
        marginBottom: 10,
    },
    exerciseText: {
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 10,
        color: COLORS.textSecondary,
    },
    startWorkoutButton: {
        marginTop: 30,
        paddingVertical: 15,
        borderRadius: 10,
        backgroundColor: COLORS.button,
        alignItems: "center",
    },
    startWorkoutText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "white",
    },
});