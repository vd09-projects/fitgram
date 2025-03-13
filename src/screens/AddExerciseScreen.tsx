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
import { saveWorkoutDetails } from '../services/db/userDB';
import { useAuthUser } from '../hooks/useAuthUser';

export default function AddExerciseScreen() {
    const { user } = useAuthUser();
    
    const predefinedExercises = usePredefinedExercises();
    const workoutPlans = useWorkoutPlans();

    const [selectedExercise, setSelectedExercise] = useState<DropdownSelection | undefined>(undefined);
    const [selectedWorkout, setSelectedWorkout] = useState<DropdownSelection | undefined>(undefined);
    const [customFields, setCustomFields] = useState<string[]>([]);

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
        if (selectedExercise === undefined) {
            show.alert('Exercise Required', 'Please select an exercise.');
            return;
        }

        if (selectedWorkout === undefined) {
            show.alert('Workout Required', 'Please select a workout.');
            return;
        }

        if (!selectedExercise.label || selectedExercise.label.trim() === '') {
            show.alert('Exercise Name Required', 'Please select or enter an exercise name.');
            return;
        }

        if (!selectedWorkout.label || selectedWorkout.label.trim() === '') {
            show.alert('Workout Name Required', 'Please select or enter a workout name.');
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
        

        saveWorkoutDetails(user?.uid || "", {
            id: selectedWorkout.value,
            name: selectedWorkout.label,
            exercise: {
                label: selectedExercise.label,
                value: selectedExercise.value,
                fields: customFields
            }
        })
        handleSelectWorkout(selectedWorkout);
        show.success('Workout Details Saved', `Successfully saved: ${selectedWorkout.label} - ${selectedExercise.label}`);
    };

    return (
        <ScrollableScreen>
            <Text style={styles.heading}>Manage Workout</Text>

            {/* 🔹 Select Workout */}
            <SearchableInputDropdown
                data={workoutPlans
                    .filter(({ id }) => id !== undefined)
                    .map(({ id, name }) => ({ label: name, value: id as string }))}
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
            {selectedExercise &&
                <EditableList
                    title={"Select `" + selectedExercise.label + "` Fields"}
                    items={customFields}
                    onItemsChange={setCustomFields}
                />
            }

            {/* 🔹 Submit Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.textSecondary} />
                <Text style={styles.saveButtonText}>Save Exercise</Text>
            </TouchableOpacity>
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