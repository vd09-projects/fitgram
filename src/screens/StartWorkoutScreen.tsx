import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ScrollView,
    TextInput,
    StyleSheet
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import useWorkoutPlans from "../hooks/useWorkoutPlans";
import { WorkoutPlan } from "../types/workoutType";
import { BORDER_RADIUS, COLORS } from "../constants/styles";
import ScrollableScreen from "../components/ScrollableScreen";
import SearchBox from "../components/SearchBox";
import { useWorkoutStore } from "../hooks/useWorkoutStore";
import { useSyncWorkout } from "../hooks/useSyncWorkout";
import show from "../utils/toastUtils";

export default function StartWorkoutScreen() {
    const { startWorkout, activeWorkout } = useWorkoutStore();
    const { syncWorkout } = useSyncWorkout();
    useEffect(() => {
        syncWorkout(); // Try syncing any offline data before starting a new workout
    }, []);

    const workoutPlans = useWorkoutPlans(true);
    const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Filter workouts based on search query
    let filteredWorkouts = workoutPlans.filter((workout) =>
        workout.name.trim().toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    if (selectedWorkout && filteredWorkouts.some(workout => workout.id === selectedWorkout.id)) {
        filteredWorkouts = [
            selectedWorkout,
            ...filteredWorkouts.filter((workout) => workout.id !== selectedWorkout.id),
        ];
    }

    const toggleWorkoutSelection = (workout: WorkoutPlan) => {
        setSelectedWorkout((prevSelected) =>
            prevSelected?.id === workout.id ? null : workout
        );
    };

    const handleStartWorkout = () => {
        if (selectedWorkout) {
            if (activeWorkout) {
                show.alert("Active Workout", "Finish your current workout before starting a new one.");
                return;
            }
            startWorkout(selectedWorkout);
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
            {/* 🔍 Search Box Component */}
            <SearchBox value={searchQuery} onChangeText={setSearchQuery} placeholder="Search workout..." />

            {/* 🏋️ Workout Grid Selection */}
            <FlatList
                data={filteredWorkouts}
                key={selectedWorkout ? "horizontal" : "grid"}
                keyExtractor={(item) => item.id}
                horizontal={!!selectedWorkout}
                scrollEnabled={!!selectedWorkout}
                showsHorizontalScrollIndicator={!!selectedWorkout}
                numColumns={selectedWorkout ? undefined : 2}
                columnWrapperStyle={!selectedWorkout ? styles.gridRow : null}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.workoutCard,
                            selectedWorkout?.id === item.id && styles.selectedWorkout
                        ]}
                        onPress={() => toggleWorkoutSelection(item)}
                    >
                        <Text style={styles.workoutTitle}>{item.name}</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text style={styles.noResultsText}>No workouts found</Text>
                }
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
    noResultsText: {
        textAlign: "center",
        fontSize: 18,
        color: COLORS.textSecondary,
        marginTop: 20,
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
        borderColor: COLORS.button,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
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
        borderRadius: BORDER_RADIUS,
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