import { db } from '../firebase/firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

// Firestore collection reference for predefined exercises
const predefinedExercisesCollection = collection(db, 'predefined_exercises');

/**
 * 📌 GET: Fetch all predefined exercises (Public)
 */
export const getAllPredefinedExercises = async () => {
    try {
        const snapshot = await getDocs(predefinedExercisesCollection);

        if (snapshot.empty) {
            console.warn('⚠️ No predefined exercises found.');
            return [];
        }

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('❌ Error fetching predefined exercises:', error);
        return [];
    }
};

/**
 * 📌 POST: Add a new predefined exercise (Only for Admins)
 */
export const addPredefinedExercise = async (exercise: { label: string; value: string; fields: string[] }) => {
    try {
        const exerciseDoc = doc(predefinedExercisesCollection, exercise.value);
        await setDoc(exerciseDoc, exercise);
        console.log(`✅ Exercise added: ${exercise.label}`);

        return { success: true, message: 'Exercise added successfully' };
    } catch (error : any) {
        console.error('❌ Error adding predefined exercise:', error);
        return { success: false, message: error.message };
    }
};