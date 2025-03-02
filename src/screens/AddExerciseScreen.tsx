import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';
import ScrollableScreen from '../components/ScrollableScreen';
import SearchableInputDropdown, { DropdownItem, DropdownSelection } from '../components/SearchableInputDropdown';

const predefinedExercises: { label: string; value: string; fields: string[] }[] = [
    { label: 'Bicep Curls', value: 'bicep_curls', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Leg Extensions', value: 'leg_extensions', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Rowing', value: 'rowing', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Treadmill', value: 'treadmill', fields: ['Total Time (min)', 'Incline Level', 'Speed (km/h)'] },
    { label: 'Bench Press', value: 'bench_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Deadlifts', value: 'deadlifts', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Squats', value: 'squats', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Pull-Ups', value: 'pull_ups', fields: ['Sets', 'Reps'] },
    { label: 'Cycling', value: 'cycling', fields: ['Total Time (min)', 'Resistance Level', 'Speed (km/h)'] },
    { label: 'Jump Rope', value: 'jump_rope', fields: ['Total Time (min)', 'Jumps'] },
    { label: 'Plank', value: 'plank', fields: ['Total Time (min)'] },
    { label: 'Lunges', value: 'lunges', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Lat Pulldown', value: 'lat_pulldown', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Overhead Press', value: 'overhead_press', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { label: 'Battle Ropes', value: 'battle_ropes', fields: ['Total Time (min)'] }
];

export default function AddExerciseScreen() {
    const [selectedExercise, setSelectedExercise] = useState<DropdownSelection | null>(null);
    const [customExercise, setCustomExercise] = useState('');
    const [customFields, setCustomFields] = useState<string[]>([]);
    const [exerciseData, setExerciseData] = useState<{ [key: string]: string }>({});

    const handleSelectExercise = (exercise: DropdownSelection) => {
        setSelectedExercise(exercise);
        setCustomExercise('');
        setCustomFields([]);
        setExerciseData({});
    };

    const handleSubmit = () => {
        const exerciseName = selectedExercise
            ? predefinedExercises.find((e) => e.value === selectedExercise.value)?.label
            : customExercise;
        if (!exerciseName || exerciseName.trim() === '') {
            Alert.alert('Exercise Name Required', 'Please select or enter an exercise name.');
            return;
        }
        console.log('Saved Exercise:', { name: exerciseName, data: exerciseData });
        Alert.alert('Exercise Saved', `Successfully saved: ${exerciseName}`);
    };

    return (
        <ScrollableScreen>
            <Text style={styles.heading}>Add Exercise</Text>

            {/* 🔹 Select Exercise */}
            <SearchableInputDropdown
                data={predefinedExercises.map(({ label, value }) => ({ label, value }))}
                placeholder="Exercise"
                value={selectedExercise?.value}
                onChange={handleSelectExercise}
                title="Select/Create Exercise"
            />

            {/* 🔹 Input Fields for Selected or Custom Exercise */}
            {(selectedExercise || customExercise) && (
                <>
                    <Text style={styles.subheading}>Enter Exercise Details</Text>
                    {(predefinedExercises.find((e) => e.value === selectedExercise?.value)?.fields || customFields).map((field, index) => (
                        <TextInput
                            key={index}
                            style={styles.input}
                            placeholder={field}
                            value={exerciseData[field] || ''}
                            onChangeText={(text) => setExerciseData({ ...exerciseData, [field]: text })}
                            keyboardType="numeric"
                        />
                    ))}
                </>
            )}

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
    subheading: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
        marginBottom: 10,
    },
    input: {
        backgroundColor: COLORS.textSecondary,
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        fontSize: 16,
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