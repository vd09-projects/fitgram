import React, { useState } from 'react';
import {
    Text,
    TouchableOpacity,
    Alert,
    View,
    StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import SearchableInputDropdown, { DropdownSelection } from '../components/SearchableInputDropdown';
import EditableList from '../components/EditableList';
import usePredefinedExercises from '../hooks/usePredefinedExercises';
import useWorkoutPlans from '../hooks/useWorkoutPlans';
import show from '../utils/toastUtils';
import { overrideWorkoutDetails, saveWorkoutDetails } from '../services/db/userDB';
import { useAuthUser } from '../hooks/useAuthUser';
import CollapsibleExerciseList from '../components/CollapsibleExerciseList';
import { Exercise, WorkoutPlan, WorkoutPlanDB } from '../types/workoutType';

export default function AddExerciseScreen() {
    const { user } = useAuthUser();

    const [selectedExercise, setSelectedExercise] = useState<DropdownSelection<Exercise> | undefined>(undefined);
    const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection<WorkoutPlan> | undefined>(undefined);
    const [customFields, setCustomFields] = useState<string[]>([]);
    const [workoutDetailsUpdated, setWorkoutDetailsUpdated] = useState<boolean>(false);

    const [reload, setReload] = useState<boolean>(false);

    const predefinedExercises = usePredefinedExercises();
    const workoutPlans = useWorkoutPlans(reload);

    const handleReload = () => setReload((prev) => !prev);

    const handleSelectExercise = (exercise: DropdownSelection<Exercise>) => {
        if (exercise.isCustom) {
            exercise.value = {
                id: exercise.label.replace(/\s+/g, '_'),
                name: exercise.label,
                fields: []
            };
        }
        setWorkoutDetailsUpdated(true);
        setCustomFields(exercise.value?.fields || []);
        setSelectedExercise(exercise);
    };

    const handleSelectWorkout = (workout: DropdownSelection<WorkoutPlan>) => {
        if (workout.isCustom) {
            workout.value = {
                id: workout.label.replace(/\s+/g, '_'),
                name: workout.label,
                exercises: []
            };
        }
        setCustomFields([]);
        setSelectedExercise(undefined);
        setSelectedWorkout(workout);
    };

    const handleSubmit = () => {
        if (!selectedWorkout || !selectedWorkout.value) {
            show.alert('Workout Required', 'Please select a workout.');
            return;
        }

        if (!selectedWorkout.label.trim()) {
            show.alert('Workout Name Required', 'Please select or enter a workout name.');
            return;
        }

        var wk = selectedWorkout.value
        if (selectedExercise) {
            if (!selectedExercise.value) {
                show.alert('Exercise Required', 'Please select or enter an exercise name.');
                return;
            }

            if (!selectedExercise.label.trim()) {
                show.alert('Exercise Name Required', 'Please select or enter an exercise name.');
                return;
            }

            if (customFields.length === 0) {
                show.alert('Fields Required', 'Please enter at least one field.');
                return;
            }

            if (customFields.some((field) => field.trim() === '')) {
                show.alert('Invalid Field', 'Field cannot be empty.');
                return;
            }

            wk.exercises.push({
                id: selectedExercise.value.id,
                name: selectedExercise.label,
                fields: customFields
            });
        }

        const saveWorkout = async (lwkp: WorkoutPlan) => {
            await overrideWorkoutDetails(user?.uid || "", lwkp);
            show.success('Workout Details Saved', `Successfully saved: ${selectedWorkout.label}`);
            handleSelectWorkout(selectedWorkout);
            handleReload();
            setWorkoutDetailsUpdated(false);
        };

        saveWorkout(wk);
    };

    return (
        <ScrollableScreen>
            <Text style={styles.heading}>Manage Workout</Text>

            {/* 🔹 Select Workout */}
            <SearchableInputDropdown<WorkoutPlan>
                data={workoutPlans.map((workout) => ({ label: workout.name, value: workout }))}
                placeholder="Workout"
                value={selectedWorkout}
                onChange={handleSelectWorkout}
                title={"Workout" + (selectedWorkout ? ` : ${selectedWorkout.label}` : '')}
            />


            {/* 🔹 Collapsible Exercise List Component */}
            {selectedWorkout?.value?.exercises && selectedWorkout?.value?.exercises?.length > 0 && (
                <CollapsibleExerciseList
                    exercises={selectedWorkout.value.exercises}
                    onUpdate={(index, updatedExercises) => {
                        if (!selectedWorkout?.value || !selectedWorkout.value?.exercises) return;
                        if (!updatedExercises) {
                            selectedWorkout.value.exercises.splice(index, 1);
                        } else {
                            selectedWorkout.value.exercises.splice(index, 1, updatedExercises);
                        }
                        const newWorkout = { ...selectedWorkout } as DropdownSelection<WorkoutPlan>;
                        console.log('🔥 Updated Workout:', newWorkout);
                        setWorkoutDetailsUpdated(true);
                        setSelectedWorkout(newWorkout);
                    }}
                />
            )}

            {/* 🔹 Select Exercise */}
            <SearchableInputDropdown<Exercise>
                data={predefinedExercises.map((exercise) => ({ label: exercise.name, value: exercise }))}
                placeholder="Exercise"
                value={selectedExercise}
                onChange={handleSelectExercise}
                title={"Exercise" + (selectedExercise?.value ? ` : ${selectedExercise.label}` : '')}
            />

            {/* 🔹 Input Fields for Selected or Custom Exercise */}
            {selectedExercise && (
                <EditableList
                    title={"Select `" + selectedExercise.label + "` Fields"}
                    items={customFields}
                    onItemsChange={setCustomFields}
                />
            )}

            {/* 🔹 Submit Button */}
            {workoutDetailsUpdated && (<TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.textSecondary} />
                <Text style={styles.saveButtonText}>Save Exercise</Text>
            </TouchableOpacity>)}
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
});
