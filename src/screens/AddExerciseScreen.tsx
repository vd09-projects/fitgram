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
import { WorkoutScreenNavigationProp } from '../navigation/WorkoutNavigator';
import { WorkoutRoutes } from '../constants/routes';
import { useNavigation } from '@react-navigation/native';

const predefinedExercises = {
  Strength: [
    { name: 'Bicep Curls', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { name: 'Leg Extensions', fields: ['Sets', 'Weight (kg)', 'Reps'] },
    { name: 'Rowing', fields: ['Sets', 'Weight (kg)', 'Reps'] }
  ],
  Cardio: [
    { name: 'Treadmill', fields: ['Total Time (min)', 'Incline Level', 'Speed (km/h)'] }
  ]
};

export default function AddExerciseScreen() {
  const [selectedExercise, setSelectedExercise] = useState<{ name: string; fields: string[] } | null>(null);
  const [customExercise, setCustomExercise] = useState('');
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [exerciseData, setExerciseData] = useState<{ [key: string]: string }>({});

  const handleSelectExercise = (exercise: { name: string; fields: string[] }) => {
    setSelectedExercise(exercise);
    setCustomExercise('');
    setCustomFields([]);
    setExerciseData({});
  };

  const handleAddCustomField = () => {
    if (customExercise.trim() === '') {
      Alert.alert('Enter Exercise Name', 'Please enter a custom exercise name.');
      return;
    }
    setCustomFields([...customFields, `Field ${customFields.length + 1}`]);
  };

  const handleSubmit = () => {
    const exerciseName = selectedExercise ? selectedExercise.name : customExercise;
    if (!exerciseName.trim()) {
      Alert.alert('Exercise Name Required', 'Please select or enter an exercise name.');
      return;
    }
    console.log('Saved Exercise:', { name: exerciseName, data: exerciseData });
    Alert.alert('Exercise Saved', `Successfully saved: ${exerciseName}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.heading}>Add Exercise</Text>

      {/* 🔹 Predefined Exercises Selection */}
      <Text style={styles.subheading}>Select from Predefined Exercises</Text>
      {Object.entries(predefinedExercises).map(([category, exercises]) => (
        <View key={category}>
          <Text style={styles.categoryTitle}>{category}</Text>
          {exercises.map((exercise) => (
            <TouchableOpacity
              key={exercise.name}
              style={[styles.exerciseButton, selectedExercise?.name === exercise.name && styles.selectedExercise]}
              onPress={() => handleSelectExercise(exercise)}
            >
              <Text style={styles.exerciseButtonText}>{exercise.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* 🔹 Custom Exercise Input */}
      <Text style={styles.subheading}>Or Create a Custom Exercise</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Custom Exercise Name"
        value={customExercise}
        onChangeText={setCustomExercise}
      />
      <TouchableOpacity style={styles.addFieldButton} onPress={handleAddCustomField}>
        <Ionicons name="add-circle-outline" size={20} color={COLORS.textSecondary} />
        <Text style={styles.addFieldButtonText}>Add Custom Field</Text>
      </TouchableOpacity>

      {/* 🔹 Input Fields for Selected or Custom Exercise */}
      {(selectedExercise || customExercise) && (
        <>
          <Text style={styles.subheading}>Enter Exercise Details</Text>
          {(selectedExercise?.fields || customFields).map((field, index) => (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  subheading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 5,
  },
  exerciseButton: {
    backgroundColor: COLORS.secondary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  selectedExercise: {
    backgroundColor: COLORS.accent,
  },
  exerciseButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.textSecondary,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  addFieldButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  addFieldButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.accent,
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