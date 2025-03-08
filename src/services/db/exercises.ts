import { Exercise } from '../../types/workoutType';
import { db } from '../firebase/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

// Firestore collection reference for predefined exercises
const predefinedExercisesCollection = collection(db, 'predefined_exercises');

/**
 * 📌 GET: Fetch all predefined exercises from Firestore
 * @returns {Promise<Exercise[]>} List of predefined exercises
 */
export const getAllPredefinedExercises = async (): Promise<Exercise[]> => {
    try {
        const snapshot = await getDocs(predefinedExercisesCollection);

        if (snapshot.empty) {
            console.warn('⚠️ No predefined exercises found.');
            return [];
        }

        return snapshot.docs.map(doc => {
            const data = doc.data() as Omit<Exercise, 'id'>; // Exclude 'id' to avoid duplication
            return { id: doc.id, ...data }; // Ensure 'id' is added once
        });
    } catch (error) {
        console.error('❌ Error fetching predefined exercises:', error);
        return [];
    }
};

/**
 * 📌 POST: Add a new predefined exercise
 */
export const addPredefinedExercise = async (exercise: Exercise) => {
    try {
        const exerciseDoc = doc(predefinedExercisesCollection, exercise.value);
        await setDoc(exerciseDoc, exercise);
        console.log(`✅ Exercise added: ${exercise.label}`);

        return { success: true, message: 'Exercise added successfully' };
    } catch (error: any) {
        console.error('❌ Error adding predefined exercise:', error);
        return { success: false, message: error.message };
    }
};