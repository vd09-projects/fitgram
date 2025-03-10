import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { getAllPredefinedExercises } from '../services/db/exercises';
import { Exercise } from '../types/workoutType';

export default function usePredefinedExercises() {
    const [predefinedExercises, setPredefinedExercises] = useState<Exercise[]>([]);

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const exercises = await getAllPredefinedExercises();
                setPredefinedExercises(exercises);
            } catch (error) {
                console.error('Error fetching exercises:', error);
                Alert.alert('Error', 'Could not fetch exercises.');
            }
        };

        fetchExercises();
    }, []);

    return predefinedExercises;
}