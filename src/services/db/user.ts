import { tables } from '../../constants/tables';
import { WorkoutPlan, WorkoutPlanDB } from '../../types/workoutType';
import { db } from '../firebase/firebase';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

export const getAllWorkoutPlans = async (userId: string): Promise<WorkoutPlan[]> => {
    if (!userId) return [];

    try {
        const querySnapshot = await getDocs(collection(db, tables.users.collection, userId, tables.users.fields.workouts.collection));
        const plans = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as WorkoutPlan[];
        
        console.log('✅ Exercises fetched successfully:', plans);
        return plans;
    } catch (error) {
        console.error('❌ Error fetching exercises:', error);
        return [];
    }
};

export const saveWorkoutDetails = async (
    userId: string,
    workout: WorkoutPlanDB
): Promise<void> => {
    if (!userId || !workout.id || !workout.exercise) {
        console.error('❌ Missing required parameters');
        return;
    }

    try {
        const workoutRef = doc(db, tables.users.collection, userId, tables.users.fields.workouts.collection, workout.id);
        const workoutSnap = await getDoc(workoutRef);

        if (!workoutSnap.exists()) {
            // Workout does not exist, create it with the new exercise
            await setDoc(workoutRef, {
                id: workout.id,
                name: 'New Workout', // Default name, can be updated later
                exercises: [workout.exercise]
            });
            console.log('✅ Workout and exercise created successfully');
            return;
        }

        const workoutData = workoutSnap.data() as WorkoutPlan;
        const existingExercise = workoutData.exercises.find(ex => ex.value === workout.exercise.value);

        if (existingExercise) {
            // If exercise exists, update it (remove old and add new)
            await updateDoc(workoutRef, {
                exercises: arrayRemove(existingExercise)
            });
            await updateDoc(workoutRef, {
                exercises: arrayUnion(workout.exercise)
            });
            console.log('✅ Exercise updated successfully');
        } else {
            // If exercise does not exist, add it
            await updateDoc(workoutRef, {
                exercises: arrayUnion(workout.exercise)
            });
            console.log('✅ Exercise added successfully');
        }
    } catch (error) {
        console.error('❌ Error saving workout details:', error);
    }
};