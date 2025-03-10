import React, { useState, useEffect } from 'react';
import {
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const assert: (condition: any, message: string) => asserts condition = (condition: any, message: string): asserts condition => {
    if (!condition) {
        console.error('❌ Assertion Failed:', condition);
        throw new Error(message);
    }
};

import { COLORS } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import SearchableInputDropdown, { DropdownSelection } from '../components/SearchableInputDropdown';
import { getAllPredefinedExercises } from '../services/db/exercises';
import { Exercise, WorkoutPlan } from '../types/workoutType';
import { useAuthUser } from '../hooks/useAuthUser';
import { getAllWorkoutPlans } from '../services/db/user';
import EditableList from '../components/EditableList';

export default function AddExerciseScreen() {
    const { user } = useAuthUser();
    // assert(user, 'User must be authenticated to access this screen.');

    const [predefinedExercises, setPredefinedExercises] = useState<Exercise[]>([]);
    const [selectedExercise, setSelectedExercise] = useState<DropdownSelection | undefined>(undefined);

    const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
    const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection | undefined>(undefined);

    const [customFields, setCustomFields] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newField, setNewField] = useState("");

    // 🔹 Fetch predefined exercises from Firestore
    useEffect(() => {
        const fetchExercises = async () => {
            // if (!user) return;
            try {
                setLoading(true);
                const exercises = await getAllPredefinedExercises();
                setPredefinedExercises(exercises);
            } catch (error) {
                console.error('Error fetching exercises:', error);
                Alert.alert('Error', 'Could not fetch exercises. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        const fetchWorkouts = async () => {
            if (!user) return;
            try {
                const workouts = await getAllWorkoutPlans(user.uid);
                setWorkoutPlans(workouts);
            }
            catch (error) {
                console.error('Error fetching workouts:', error);
                Alert.alert('Error', 'Could not fetch workouts. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkouts();
        fetchExercises();
    }, []);

    const handleSelectExercise = (exercise: DropdownSelection) => {
        setSelectedExercise(exercise);
        const selectedExerciseFields = predefinedExercises.find((e) => e.value === exercise.value)?.fields || [];
        setCustomFields(selectedExerciseFields);
    };

    const handleSelectWorkout = (workout: DropdownSelection) => {
        setSelectedWorkout(workout);
        setSelectedExercise(undefined);
        setCustomFields([]);
    };

    const handleSubmit = () => {
        const exerciseName = selectedExercise
            ? predefinedExercises.find((e) => e.value === selectedExercise.value)?.label
            : '';
        if (!exerciseName || exerciseName.trim() === '') {
            Alert.alert('Exercise Name Required', 'Please select or enter an exercise name.');
            return;
        }
        console.log('Saved Exercise:', { name: exerciseName });
        Alert.alert('Exercise Saved', `Successfully saved: ${exerciseName}`);
    };

    return (
        <ScrollableScreen>
            <Text style={styles.heading}>Manage Workout</Text>

            {/* 🔹 Loading Indicator */}
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
                <>
                    {/* 🔹 Select Workout */}
                    <SearchableInputDropdown
                        data={workoutPlans.map(({ id, name }) => {
                            assert(id, 'Workout plan id cannot be null');
                            return { label: name, value: id };
                        })}
                        placeholder="Workout"
                        value={selectedWorkout}
                        onChange={handleSelectWorkout}
                        title={"Workout" + (selectedWorkout?.value ? ` : ${selectedWorkout?.label}` : '')}
                    />

                    {/* 🔹 Select Exercise */}
                    <SearchableInputDropdown
                        data={predefinedExercises.map(({ label, value }) => ({ label, value }))}
                        placeholder="Exercise"
                        value={selectedExercise}
                        onChange={handleSelectExercise}
                        title={"Exercise" + (selectedExercise?.value ? ` : ${selectedExercise?.label}` : '')}
                    />

                    {/* 🔹 Input Fields for Selected or Custom Exercise */}
                    {selectedExercise && <EditableList title={"Select `" + selectedExercise.label + "` Fields"} items={customFields} onItemsChange={setCustomFields} />}

                    {/* 🔹 Submit Button */}
                    <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                        <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.textSecondary} />
                        <Text style={styles.saveButtonText}>Save Exercise</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollableScreen>
    );
}

const styles = StyleSheet.create({
    heading: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 20,
    },
    subheading: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
        marginBottom: 10,
        marginTop: 12,
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.button,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginLeft: 8,
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.textSecondary,
        padding: 4,
        borderRadius: 8,
        marginBottom: 10,
        justifyContent: 'space-between',
    },
    fieldText: {
        fontSize: 16,
        color: COLORS.textPrimary,
        flex: 1,
    },
    fieldInput: {
        fontSize: 16,
        color: COLORS.textPrimary,
        flex: 1,
        backgroundColor: 'white',
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    addFieldContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
    },
    newFieldInput: {
        flex: 1,
        backgroundColor: "white",
        padding: 10,
        borderRadius: 6,
        fontSize: 16,
        color: COLORS.textPrimary,
        paddingHorizontal: 8,
    },
    addButton: {
        marginLeft: 10,
        backgroundColor: COLORS.button,
        padding: 10,
        borderWidth: 1,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "white",
        paddingHorizontal: 6,
    },
});