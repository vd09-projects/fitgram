import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { getAllPredefinedExercises } from '../services/db/exercises';
import { Exercise } from '../types/workoutType';

export default function usePredefinedExercises() {
  const [predefinedExercises, setPredefinedExercises] = useState<Exercise[]>([]);
  const [loadingPredefinedExercises, setLoadingPredefinedExercises] = useState<boolean>(true);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoadingPredefinedExercises(true);
      try {
        const exercises = await getAllPredefinedExercises();
        setPredefinedExercises(exercises);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        Alert.alert('Error', 'Could not fetch exercises.');
      } finally {
        setLoadingPredefinedExercises(false);
      }
    };

    fetchExercises();
  }, []);

  return { predefinedExercises, loadingPredefinedExercises };
}